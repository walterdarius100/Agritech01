// Optional browser smoke test: requires Playwright and Chromium, no production API.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(new URL('..', import.meta.url).pathname);
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[extname(path)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  page.on('console', msg => { if (msg.type() === 'error') console.error(msg.text()); });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === '/js/services/supabase-client.js') {
      await route.fulfill({ contentType: 'text/javascript', body: `
        const rows = []; window.mockWrites = []; window.failWrite = false;
        const client = {
          auth: { getSession: async () => ({data:{session:{user:{email:'simulation@example.invalid'}}}}), onAuthStateChange() {} },
          from() {
            let payload, id;
            const q = {
              select() {return q}, order() {return q}, single() {return q},
              eq(key, value) {if(key === 'id') id=value; return q},
              insert(value) {payload=value; return q}, update(value) {payload=value; return q},
              async then(resolve) {
                if (!payload) return resolve({data:rows});
                window.mockWrites.push({id, payload});
                if (window.failWrite) return resolve({error:{code:'XX000',message:'database test failure'}});
                const row = {...payload,id:id || 'created-1'};
                rows.splice(0,rows.length,row); return resolve({data:row});
              }
            }; return q;
          }
        };
        export const getSupabaseClient = async () => client;
        export const isSupabaseConfigured = () => true;
        export const getSupabaseDiagnostics = () => ({configured:true,clientInitialized:true,projectHost:'simulation'});
      ` }); return;
    }
    if (url.origin === origin || url.hostname === 'cdn.jsdelivr.net') await route.continue();
    else await route.abort(); // No Supabase, analytics, production site or remote images.
  });
  await page.goto(origin + '/admin.html');
  await page.waitForFunction(() => window.tinymce?.get('articleContentField')?.initialized);
  await page.locator('#newArticleButton').click();
  await page.locator('#articleTitle').fill('Article de test');
  await page.locator('#articleCategory').fill('Conseils');
  await page.evaluate(() => tinymce.get('articleContentField').setContent('<p>Contenu du test navigateur.</p>'));
  await page.locator('#saveDraftButton').click();
  await page.waitForFunction(() => document.querySelector('#articleId').value === 'created-1' && document.querySelector('#articleForm').getAttribute('aria-busy') === 'false');
  assert.equal(await page.evaluate(() => mockWrites.length), 1);
  await page.locator('#articleTitle').fill('Article modifié');
  await page.locator('#updateButton').click();
  await page.waitForFunction(() => mockWrites.length === 2 && document.querySelector('#articleForm').getAttribute('aria-busy') === 'false');
  assert.equal(await page.evaluate(() => mockWrites[1].id), 'created-1');
  await page.evaluate(() => window.failWrite = true);
  await page.locator('#updateButton').click();
  await page.waitForFunction(() => document.querySelector('#dashboardMessage').dataset.type === 'error');
  assert.match(await page.evaluate(() => tinymce.get('articleContentField').getContent()), /Contenu du test navigateur/);
  assert.equal(await page.locator('#updateButton').isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log('Chromium : création, modification avec le même ID, échec Database, contenu conservé et bouton réactivé : OK (Supabase simulé, TinyMCE réel).');
} finally {
  await browser?.close();
  server.close();
}
