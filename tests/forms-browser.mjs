// Isolated browser checks: every external request is blocked, articles simulated.
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
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let mode = 'published';
  const article = { slug: 'ancien-slug', title: 'Sol <vivant> & eau', excerpt: 'Comprendre le sol & l’eau.', author: 'Agri-tech', status: 'published', content: '<h2>Le sol</h2><p>Conseils.</p>', coverImage: 'assets/images/irrigation.jpg', publishedAt: '2026-01-01' };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/js/services/articles-service.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `
        const article = ${JSON.stringify(article)};
        export async function getArticleBySlug() { ${mode === 'outage' ? "throw new Error('simulation')" : `return ${mode === 'published' ? 'article' : 'null'}`} }
        export async function getPublishedArticles() { return [article, {...article, slug:'autre-article', title:'Autre article'}]; }
        export function getFeaturedArticle(rows) {return rows[0]}
      ` });
    }
    return route.continue();
  });

  await page.addInitScript(() => {
    window.mockCalls = [];
    window.failNotification = false;
    window.emailjs = { init() {}, async send(service, template, payload) {
      window.mockCalls.push({template});
      await new Promise(r => setTimeout(r, 80));
      if (window.failNotification) throw Error('network');
      return {status:200};
    }};
  });
  const submit = id => page.locator(id).evaluate(form => {
    form.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
    form.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
  });
  await page.goto(origin + '/index.html');
  await page.waitForFunction(() => document.querySelector('#need').options.length > 1);
  await submit('#leadForm');
  assert.match(await page.locator('#formStatus').textContent(), /compléter/);
  assert.equal(await page.evaluate(() => mockCalls.length), 0);
  await page.locator('#name').fill('Test');
  await page.locator('#email').fill('invalide');
  await page.locator('#phone').fill('12345678');
  await page.locator('#need').selectOption({index:1});
  await page.locator('#message').fill('Demande de test');
  await page.locator('#consent').check();
  await submit('#leadForm');
  assert.match(await page.locator('#formStatus').textContent(), /email valide/);
  await page.locator('#email').fill('test@example.invalid');
  await page.evaluate(() => { window.failNotification=true; });
  await submit('#leadForm');
  await page.waitForFunction(() => !document.querySelector('#submitBtn').disabled);
  assert.equal(await page.locator('#name').inputValue(), 'Test');
  assert.match(await page.locator('#formStatus').textContent(), /pas pu être confirmé/);
  await page.evaluate(() => { window.failNotification=false; });
  await submit('#leadForm');
  await page.waitForFunction(() => !document.querySelector('#submitBtn').disabled);
  assert.match(await page.locator('#formStatus').textContent(), /transmise/);
  assert.match(await page.locator('#formStatus').textContent(), /Aucun accusé/);
  await submit('#leadForm');
  await page.waitForFunction(() => !document.querySelector('#submitBtn').disabled);
  assert.equal(await page.evaluate(() => mockCalls.length), 2);
  for (const path of ['/index.html', '/services.html']) {
    await page.goto(origin + path);
    await page.waitForFunction(() => document.querySelector('#newsletterForm').dataset.newsletterBound);
    await page.locator('#newsletterEmail').fill('invalide');
    await submit('#newsletterForm');
    assert.match(await page.locator('#newsletterStatus').textContent(), /email valide/);
    const newsletterEmail = path === '/index.html' ? 'home@example.invalid' : 'secondary@example.invalid';
    await page.locator('#newsletterEmail').fill(newsletterEmail);
    await submit('#newsletterForm');
    assert.match(await page.locator('#newsletterStatus').textContent(), /accepter/);
    await page.locator('#newsletterConsent').check();
    await page.evaluate(() => { window.failNotification = true; });
    await submit('#newsletterForm');
    await page.waitForFunction(() => !document.querySelector('#newsletterSubmit').disabled);
    assert.match(await page.locator('#newsletterStatus').textContent(), /pas pu être confirmée/);
    assert.equal(await page.locator('#newsletterEmail').inputValue(), newsletterEmail);
    await page.evaluate(() => { window.failNotification = false; });
    await submit('#newsletterForm');
    await page.waitForFunction(() => !document.querySelector('#newsletterSubmit').disabled);
    assert.match(await page.locator('#newsletterStatus').textContent(), /non confirmé/);
    assert.equal(await page.locator('#newsletterEmail').inputValue(), newsletterEmail);
    await submit('#newsletterForm');
    await page.waitForFunction(() => !document.querySelector('#newsletterSubmit').disabled);
    assert.equal(await page.evaluate(() => mockCalls.length), 2);
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#newsletterForm').dataset.newsletterBound);
  await page.locator('#newsletterEmail').fill('secondary@example.invalid');
  await page.locator('#newsletterConsent').check();
  await submit('#newsletterForm');
  await page.waitForFunction(() => !document.querySelector('#newsletterSubmit').disabled);
  assert.equal(await page.evaluate(() => mockCalls.length), 0);
  assert.equal(await page.evaluate(() => Object.values(sessionStorage).some(v => v.includes('example.invalid'))), false);
  assert.deepEqual(errors, []);
  console.log('Formulaires Chromium : validation, consentement, double clic, panne, champs, boutons et doublons OK ; services externes bloqués.');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
