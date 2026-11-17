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
  let mode = 'unknown';
  const submissions = [];
  await page.addInitScript(() => {
    window.emailjs = { init() {}, async send(...args) { window.newsletterCalls.push(args); } };
    window.newsletterCalls = [];
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/functions/v1/contact-request')) {
      const body = route.request().postDataJSON();
      submissions.push(body);
      await new Promise(r => setTimeout(r, 80));
      return route.fulfill({contentType:'application/json',body:JSON.stringify(mode === 'unknown'
        ? {stored:null,code:'storage_unknown'}
        : {stored:true,id:body.id,notification:'accepted',reply:mode})});
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/js/services/articles-service.js') return route.fulfill({contentType:'text/javascript',body:'export async function getPublishedArticles(){return []} export function getFeaturedArticle(){return null}'});
    return route.continue();
  });
  await page.goto(origin + '/index.html#leadForm');
  await page.locator('#name').fill('Client Test');
  await page.locator('#email').fill('test@example.invalid');
  await page.locator('#phone').fill('+509 12345678');
  await page.locator('#need').selectOption({label:'Partenariat'});
  await page.locator('#message').fill('Projet de test isolé.');
  await page.locator('#consent').check();
  const submit = () => page.locator('#leadForm').evaluate(form => {
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  });
  await submit();
  await page.waitForFunction(() => document.querySelector('#formStatus').textContent.includes('pas pu être confirmé'));
  assert.equal(submissions.length,1);
  assert.equal(await page.locator('#name').inputValue(),'Client Test');
  mode='failed';
  await submit();
  await page.waitForFunction(() => document.querySelector('#formStatus').textContent.includes('accusé de réception'));
  assert.equal(submissions.length,2);
  assert.equal(submissions[0].id,submissions[1].id);
  assert.equal(await page.evaluate(() => window.newsletterCalls.length),0);
  await page.waitForFunction(() => document.querySelector('#name').value === '');
  await page.locator('#newsletterEmail').fill('newsletter@example.invalid');
  await page.locator('#newsletterForm').evaluate(form => form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await page.waitForFunction(() => window.newsletterCalls.length === 1);
  assert.equal(submissions.length,2);
  const sent = await page.evaluate(() => window.newsletterCalls[0]);
  assert.equal(sent[1],'template_pzsnmea');
  assert.equal(sent[2].from_email,'newsletter@example.invalid');
  assert.deepEqual(errors,[]);
  console.log('Contact navigateur : double clic, reprise stable, échec partiel, remise à zéro et newsletter indépendante OK. Services simulés, réseau externe bloqué.');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
