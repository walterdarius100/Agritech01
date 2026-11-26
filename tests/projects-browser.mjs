// Requires Playwright and Chromium. Supabase and photo storage are simulated.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const origin = 'http://agritech.test';
const root = new URL('../', import.meta.url);
const id = number => `12345678-1234-1234-1234-${String(number).padStart(12, '0')}`;
const fixtures = Array.from({ length: 9 }, (_, index) => ({
  id: id(9 - index),
  title: `Projet ${9 - index}`,
  details: 'Description du projet.',
  photos: [{ key: 'cover', alt: 'Photo du projet' }],
  published_at: '2026-11-11T12:00:00+00:00'
}));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox']
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let projectCount = 0;
  let photoScenario = false;
  let releaseImages;
  let imagesReady;
  const visualFixtures = [
    { ...fixtures[0], photos: ['cover', 'broken', 'unsigned'].map(key => ({ key, alt: key })) },
    { ...fixtures[1], photos: [] }
  ];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/broken.png') return route.abort();
    if (url.pathname === '/photo.png') {
      if (photoScenario) await imagesReady;
      return route.fulfill({ contentType: 'image/png', body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=', 'base64'
      ) });
    }
    if (url.pathname === '/js/services/supabase-client.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `
        const rows = ${JSON.stringify(photoScenario ? visualFixtures : fixtures.slice(0, projectCount))};
        window.projectRanges = [];
        const client = {
          from(table) {
            let start, end, id, head, predecessorId;
            const q = {
              select(fields, options) { head = options?.head; return q; },
              not() { return q; },
              neq() { return q; },
              eq(key, value) { id = value; return q; },
              or(filter) { predecessorId = filter.match(/id\\.gt\\.([^)]*)/)[1]; return q; },
              order() { return q; },
              range(first, last) { start = first; end = last; projectRanges.push([first, last]); return q; },
              async maybeSingle() { return { data: rows.find(row => row.id === id) || null }; },
              async then(resolve) {
                if (head) return resolve({ count: rows.filter(row => !predecessorId || row.id > predecessorId).length });
                return resolve({ data: rows.slice(start, end + 1) });
              }
            };
            return q;
          },
          storage: { from: () => ({
            async createSignedUrls(paths) {
              if (${photoScenario}) await new Promise(resolve => { window.releaseSigning = resolve; });
              return { data: paths.map(path => ({
                path,
                signedUrl: path.includes('/unsigned-') ? '' : path.includes('/broken-') ? '/broken.png' : '/photo.png'
              })) };
            }
          }) }
        };
        export const getSupabaseClient = async () => client;
        export const isSupabaseConfigured = () => true;
      ` });
    }
    const file = new URL(url.pathname.slice(1), root);
    const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[extname(file.pathname)];
    try {
      return await route.fulfill({ body: await readFile(file), contentType: type });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });

  const cards = page.locator('.portfolio-project');
  const dots = page.locator('#projectsPagination .pagination-dot');
  const active = page.locator('#projectsPagination [aria-current="page"]');
  const previous = page.getByLabel('Page précédente', { exact: true });
  const next = page.getByLabel('Page suivante', { exact: true });
  for (projectCount of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    await page.goto(origin + '/projets.html');
    await page.waitForFunction(() => !document.querySelector('#projectsStatus').textContent.startsWith('Chargement'));
    assert.equal(await cards.count(), Math.min(projectCount, 2));
    assert.equal(await dots.count(), projectCount <= 2 ? 0 : Math.ceil(projectCount / 2));
    assert.equal(await page.locator('#projectsPagination').isHidden(), projectCount <= 2);
    assert.deepEqual(await page.evaluate(() => projectRanges), projectCount ? [[0, 1]] : []);
    if (!projectCount) assert.match(await page.locator('#projectsStatus').textContent(), /Aucun projet/);
  }

  await page.goto(origin + '/projets.html?page=1#projet-' + id(1));
  await active.getAttribute('aria-label').then(label => assert.equal(label, 'Page 5 actuelle'));
  assert.deepEqual(await page.evaluate(() => projectRanges), [[8, 9]]);
  assert.equal(await cards.first().getAttribute('id'), 'projet-' + id(1));
  await page.waitForFunction(() => {
    const photo = document.querySelector('.portfolio-project img');
    return photo?.complete && photo.naturalWidth > 0;
  });
  assert.equal(await next.getAttribute('aria-disabled'), 'true');
  await previous.click();
  assert.equal(await active.getAttribute('aria-label'), 'Page 4 actuelle');
  assert.deepEqual(await page.evaluate(() => projectRanges), [[6, 7]]);
  assert.deepEqual(await cards.locator('h2').allTextContents(), ['Projet 3', 'Projet 2']);
  await next.click();
  await active.getAttribute('aria-label').then(label => assert.equal(label, 'Page 5 actuelle'));
  await page.goBack();
  assert.equal(await active.getAttribute('aria-label'), 'Page 4 actuelle');
  await page.goBack();
  assert.equal(await cards.first().getAttribute('id'), 'projet-' + id(1));
  await page.goForward();
  assert.equal(await active.getAttribute('aria-label'), 'Page 4 actuelle');

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(origin + '/projets.html');
    assert.equal(await previous.getAttribute('aria-disabled'), 'true');
    assert.equal(await active.evaluate(dot => getComputedStyle(dot).backgroundColor), 'rgb(15, 61, 46)');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const photo = cards.first().locator('img');
    await photo.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.portfolio-project img')?.naturalWidth > 0);
  }
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    photoScenario = true;
    imagesReady = new Promise(resolve => { releaseImages = resolve; });
    await page.goto(origin + '/projets.html');
    const gallery = cards.first().locator('.portfolio-gallery');
    await gallery.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.releaseSigning);
    const slots = gallery.locator('.project-photo');
    const dimensions = () => slots.evaluateAll(elements => elements.map(element => [element.offsetWidth, element.offsetHeight]));
    const reserved = await dimensions();
    assert.equal(reserved.length, 3);
    assert.equal((await gallery.textContent()).trim(), '');
    assert.match(await cards.nth(1).locator('.portfolio-gallery').textContent(), /Aucune photo disponible/);
    await page.evaluate(() => { window.releaseSigning(); });
    const image = slots.first().locator('img');
    await image.waitFor({ state: 'attached' });
    assert.equal(await image.isHidden(), true);
    assert.equal(await slots.first().getByText('Photo indisponible').isHidden(), true);
    await slots.nth(1).getByText('Photo indisponible').waitFor({ state: 'visible' });
    assert.equal(await slots.nth(2).getByText('Photo indisponible').isVisible(), true);
    releaseImages();
    await image.waitFor({ state: 'visible' });
    assert.ok(await image.evaluate(element => element.naturalWidth > 0));
    assert.deepEqual(await dimensions(), reserved);

    photoScenario = false;
    projectCount = 3;
    await page.goto(origin + '/index.html');
    const homeGallery = page.locator('#homeProjectGrid');
    await homeGallery.scrollIntoViewIfNeeded();
    await homeGallery.locator('img').last().waitFor({ state: 'visible' });
    assert.equal(await homeGallery.locator('img.is-loaded').count(), 3);
    assert.equal(await homeGallery.getByText('Photo à venir').count(), 0);

    for (const [path, label] of [['services.html', 'Accompagnement complet'], ['formations.html', 'Portail Academy']]) {
      await page.goto(origin + '/' + path);
      const cardTop = page.locator('.hero-card .card-top');
      assert.equal(await cardTop.textContent(), label);
      assert.equal(await cardTop.locator('.status-dot').count(), 0);
      assert.deepEqual(await cardTop.evaluate(element => {
        const style = getComputedStyle(element);
        return [style.color, style.fontWeight, style.paddingInlineStart];
      }), ['rgb(23, 107, 72)', '900', '18px']);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  }
  assert.deepEqual(errors, []);
  console.log('Chromium : 0 à 9 projets selon les scénarios, liens directs, historique, photos et mise en page bureau/mobile : OK.');
} finally {
  await browser.close();
}
