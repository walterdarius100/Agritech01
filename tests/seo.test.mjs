import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { courses } from '../js/data/formations.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pages = ['index.html', 'services.html', 'formations.html', 'actualites.html', 'projets.html', 'mentions-legales.html', 'politique-confidentialite.html'];
const origin = 'https://agritech509ht.com/';
test('XML valide : exactement sept pages fixes uniques, aucun article ni administration', () => {
  const urls = JSON.parse(execFileSync('python3', ['-c', `import xml.etree.ElementTree as E,json,sys
root=E.parse(sys.argv[1]).getroot()
assert root.tag=='{http://www.sitemaps.org/schemas/sitemap/0.9}urlset'
assert all(len(u)==1 for u in root)
print(json.dumps([u.find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc').text for u in root]))`, new URL('../sitemap.xml', import.meta.url).pathname], { encoding: 'utf8' }));
  assert.deepEqual(urls, pages.map(p => origin + (p === 'index.html' ? '' : p)));
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(u => !/admin|preview|test/.test(new URL(u).pathname)));
});
test('métadonnées fixes uniques, canonical, langue, titres et images', () => {
  const titles = new Set(), descriptions = new Set();
  for (const page of pages) {
    const html = read(page);
    const title = [...html.matchAll(/<title>([^<]+)<\/title>/g)];
    const description = [...html.matchAll(/<meta name="description" content="([^"]+)"/g)];
    assert.equal(title.length, 1); assert.equal(description.length, 1);
    titles.add(title[0][1]); descriptions.add(description[0][1]);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(html.includes(`rel="canonical" href="${origin}${page === 'index.html' ? '' : page}"`));
    assert.match(html, /<html lang="fr">/);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
    for (const image of html.matchAll(/<img\b[^>]*>/g)) assert.match(image[0], /\balt="[^"]*"/);
  }
  assert.equal(titles.size, pages.length); assert.equal(descriptions.size, pages.length);
});
test('administration exclue et ressources explorables ; pas de canonical article générique', () => {
  assert.match(read('admin.html'), /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(read('robots.txt'), /Disallow:/);
  assert.match(read('robots.txt'), /Sitemap: https:\/\/agritech509ht.com\/sitemap.xml/);
  assert.doesNotMatch(read('article.html'), /rel="canonical"/);
});
test('ancres historiques des formations uniques et rendues après insertion', () => {
  const anchors = courses.map(c => c.anchor).filter(Boolean);
  assert.equal(new Set(anchors).size, anchors.length);
  for (const [, anchor] of read('index.html').matchAll(/href="formations.html#([^"]+)"/g)) assert.ok(anchors.includes(anchor));
  assert.match(read('js/pages/formations-page.js'), /id="\$\{escapeHtml\(course.anchor\)\}"/);
  assert.match(read('js/pages/formations-page.js'), /target\?\.scrollIntoView\(\)/);
});
