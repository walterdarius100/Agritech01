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
  const rows = [
    { ...article, category: 'Production végétale' },
    ...Array.from({ length: 6 }, (_, i) => ({
      ...article, slug: 'article-' + i, title: 'Publication ' + i,
      category: i === 0 ? ' PRODUCTION   VEGETALE ' : 'Production végétale',
      publishedAt: '2026-01-0' + (i + 2)
    })),
    { ...article, slug: 'publication-animale', category: 'Production animale', publishedAt: '2026-03-01' },
    { ...article, slug: 'publication-ancienne', category: 'Actualité', publishedAt: '2026-02-01' }
  ];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/js/services/articles-service.js') {
      return route.fulfill({ contentType: 'text/javascript', body: `
        export async function getArticleBySlug() { ${mode === 'outage' ? "throw new Error('simulation')" : `return ${['published', 'solo'].includes(mode) ? JSON.stringify(rows[0]) : 'null'}`} }
        export async function getPublishedArticles() { return ${JSON.stringify(mode === 'solo' ? rows.slice(0, 1) : rows)}; }
        export function getFeaturedArticle(rows) {return rows[0]}
      ` });
    }
    return route.continue();
  });
  for (const state of ['published', 'missing', 'draft', 'archived', 'outage', 'no-slug']) {
    mode = state;
    await page.goto(origin + '/article.html' + (state === 'no-slug' ? '' : '?slug=ancien-slug&utm_source=test'));
    await page.waitForSelector('#articleContent h1');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    if (state === 'published') {
      assert.equal(robots, 'index, follow');
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://agritech509ht.com/article.html?slug=ancien-slug');
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), article.excerpt);
      const schema = JSON.parse(await page.locator('#articleSchema').textContent());
      assert.equal(schema['@type'], 'Article'); assert.equal(schema.author['@type'], 'Organization');
      assert.equal(schema.datePublished, undefined); assert.equal(schema.dateModified, undefined);
      assert.equal(schema.url, 'https://agritech509ht.com/article.html?slug=ancien-slug');
      assert.ok(await page.locator('.related-article-card a[href="article.html?slug=article-5"]').count());
    } else {
      assert.equal(robots, state === 'outage' ? 'index, follow' : 'noindex, follow');
      assert.equal(await page.locator('link[rel="canonical"], #articleSchema').count(), 0);
    }
  }
  for (const anchor of ['aviculture', 'cuniculture', 'apiculture']) {
    await page.goto(origin + '/formations.html#' + anchor);
    await page.waitForSelector('#' + anchor);
    assert.equal(await page.locator('#' + anchor + ' h3').count(), 1);
  }
  mode = 'published';
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const listURL = origin + '/actualites.html';
    await page.goto(listURL + '?category=production+++vegetale&page=2');
    await page.waitForSelector('#articlesGrid .article-card');
    assert.equal(await page.locator('#featuredArticle .featured-article').count(), 1);
    assert.deepEqual(await page.locator('#articleFilters a').allTextContents(), ['Tous', 'Production végétale', 'Production animale']);
    assert.equal(await page.locator('#articlesGrid .article-card').count(), 2);
    await page.locator('#articlesPagination a[aria-label="Page précédente"]').click();
    await page.waitForSelector('#articlesGrid .article-card');
    assert.equal(await page.locator('#articlesGrid .article-card').count(), 4);
    await page.getByRole('link', { name: 'Production animale', exact: true }).click();
    assert.equal(await page.locator('#articlesGrid .article-card').count(), 1);
    await page.goBack();
    assert.equal(await page.locator('#articlesGrid .article-card').count(), 4);

    for (const [link, slug] of [['Actualité', 'publication-ancienne'], ['Apiculture', 'publication-animale']]) {
      await page.goto(listURL + '?category=' + encodeURIComponent(link));
      await page.waitForSelector('#articlesGrid .article-card');
      assert.equal(await page.locator('#articlesGrid .article-card-image').getAttribute('href'), 'article.html?slug=' + slug);
      assert.equal(new URL(page.url()).searchParams.get('category'), link);
    }
    await page.locator('#featuredArticle .featured-article-image').click();
    await page.waitForSelector('.article-related-section');
    assert.equal(await page.locator('#relatedArticlesTitle').textContent(), 'À découvrir également');
    assert.deepEqual(await page.locator('.related-article-card .article-card-image').evaluateAll(links => links.map(link => link.getAttribute('href'))),
      ['article-5', 'article-4', 'article-3'].map(slug => 'article.html?slug=' + slug));
    assert.equal(await page.locator('.article-all-news-link').getAttribute('href'), 'actualites.html');
  }
  mode = 'solo';
  await page.goto(origin + '/article.html?slug=ancien-slug');
  await page.waitForSelector('#articleContent h1');
  assert.equal(await page.locator('.article-related-section').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Chromium : SEO, filtres, pagination et recommandations sur ordinateur et mobile OK (requêtes externes bloquées).');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
