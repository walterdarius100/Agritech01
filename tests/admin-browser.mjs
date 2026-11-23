// Optional browser smoke test: requires Playwright and Chromium, no production API.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { ARTICLE_CATEGORIES } from '../js/utils/article-categories.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

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
        const rows = [{
          id: 'legacy', title: 'Article historique', slug: 'historique', category: 'Ancien libellé',
          status: 'published', content: '<p>Contenu historique.</p>', excerpt: 'Résumé historique',
          featured: true, published_at: '2026-05-03T05:27:51.123Z'
        }];
        window.mockRows = rows; window.mockWrites = []; window.failWrite = false;
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
                const index = rows.findIndex(row => row.id === id);
                const row = {...rows[index], ...payload, id:id || ('created-' + window.mockWrites.length)};
                if (index >= 0) rows[index] = row; else rows.push(row); return resolve({data:row});
              }
            }; return q;
          }
        };
        export const getSupabaseClient = async () => client;
        export const isSupabaseConfigured = () => true;
        export const getSupabaseDiagnostics = () => ({configured:true,clientInitialized:true,projectHost:'simulation'});
      ` }); return;
    }
    if (process.env.LOCAL_TEST_ASSETS && url.hostname === 'cdn.jsdelivr.net') {
      const asset = url.pathname.replace(/^\/npm\/([^/@]+)@[^/]+\//, '$1/');
      const mime = { '.js': 'text/javascript', '.css': 'text/css' }[extname(asset)];
      try {
        await route.fulfill({ contentType: mime, body: await readFile(resolve(process.env.LOCAL_TEST_ASSETS, asset)) });
      } catch { await route.abort(); }
      return;
    }
    if (url.origin === origin || url.hostname === 'cdn.jsdelivr.net') await route.continue();
    else await route.abort(); // No Supabase, analytics, production site or remote images.
  });
  await page.goto(origin + '/admin.html');
  await page.waitForFunction(() => window.tinymce?.get('articleContentField')?.initialized);
  await page.locator('#newArticleButton').click();
  await page.locator('#articleTitle').fill('Article de test');
  const category = page.locator('#articleCategory');
  assert.equal(await category.inputValue(), '');
  assert.deepEqual(await category.locator('option').evaluateAll(options => options.map(o => o.value)), ['', ...ARTICLE_CATEGORIES]);
  await page.evaluate(() => tinymce.get('articleContentField').setContent('<p>Contenu du test navigateur.</p>'));
  await page.locator('#saveDraftButton').click();
  assert.equal(await page.evaluate(() => mockWrites.length), 0);
  assert.match(await page.locator('#dashboardMessage').textContent(), /catégorie officielle/);
  assert.equal(await page.locator('#articleTitle').inputValue(), 'Article de test');
  for (const [index, label] of ARTICLE_CATEGORIES.entries()) {
    if (index > 0) {
      await page.locator('[data-admin-tab="articles"]').click();
      await page.locator('#newArticleButton').click();
      assert.equal(await category.inputValue(), '');
      await page.locator('#articleTitle').fill('Article de test ' + index);
      await page.evaluate(() => tinymce.get('articleContentField').setContent('<p>Contenu du test navigateur.</p>'));
    }
    await category.selectOption(label);
    await page.locator('#saveDraftButton').click();
    await page.waitForFunction(n => document.querySelector('#articleId').value === 'created-' + n
      && document.querySelector('#articleForm').getAttribute('aria-busy') === 'false', index + 1);
    assert.equal(await page.evaluate(i => mockWrites[i].payload.category, index), label);
  }
  await page.locator('#articleTitle').fill('Article modifié');
  await page.locator('#updateButton').click();
  await page.waitForFunction(() => mockWrites.length === 4 && document.querySelector('#articleForm').getAttribute('aria-busy') === 'false');
  assert.equal(await page.evaluate(() => mockWrites[3].id), 'created-3');
  await page.evaluate(() => window.failWrite = true);
  await page.locator('#updateButton').click();
  await page.waitForFunction(() => document.querySelector('#dashboardMessage').dataset.type === 'error');
  assert.match(await page.evaluate(() => tinymce.get('articleContentField').getContent()), /Contenu du test navigateur/);
  assert.equal(await page.locator('#updateButton').isEnabled(), true);
  await page.evaluate(() => window.failWrite = false);
  await page.locator('[data-admin-tab="articles"]').click();
  await page.locator('[data-action="edit"][data-id="created-3"]').click();
  assert.equal(await category.inputValue(), ARTICLE_CATEGORIES[2]);
  await page.locator('[data-admin-tab="articles"]').click();
  await page.locator('[data-action="edit"][data-id="legacy"]').click();
  assert.equal(await category.inputValue(), '');
  assert.match(await page.locator('#articleCategoryNotice').textContent(), /Ancien libellé/);
  const before = await page.evaluate(() => mockRows.find(({id}) => id === 'legacy'));
  await page.locator('#updateButton').click();
  assert.equal(await page.evaluate(() => mockWrites.length), 5);
  await category.selectOption(ARTICLE_CATEGORIES[0]);
  await page.locator('#updateButton').click();
  await page.waitForFunction(() => mockWrites.length === 6 && document.querySelector('#articleForm').getAttribute('aria-busy') === 'false');
  assert.deepEqual(await page.evaluate(() => mockWrites.at(-1).payload), { category: ARTICLE_CATEGORIES[0] });
  assert.deepEqual(await page.evaluate(() => mockRows.find(({id}) => id === 'legacy')), { ...before, category: ARTICLE_CATEGORIES[0] });
  assert.equal(await page.locator('#articleCategoryNotice').isHidden(), true);
  assert.deepEqual(errors, []);
  console.log('Chromium : création, modification avec le même ID, échec Database, contenu conservé et bouton réactivé : OK (Supabase simulé, TinyMCE réel).');
} finally {
  await browser?.close();
  server.close();
}
