import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const navbar = html => html.match(/<nav class="navbar"[\s\S]*?<\/nav>/)?.[0];

test('les pages publiques utilisent la navigation générée', () => {
  execFileSync(process.execPath, [new URL('scripts/sync-navbar.mjs', root).pathname, '--check']);
  const home = navbar(read('index.html'));
  const links = home.match(/<div class="nav-links" id="navLinks">([\s\S]*?)<\/div>/)[1];
  assert.deepEqual([...links.matchAll(/<a href="([^"]+)"(?: aria-current="page")?>([^<]+)<\/a>/g)]
    .map(([, href, label]) => [href, label]), [
    ['index.html', 'Accueil'],
    ['services.html', 'Services'],
    ['formations.html', 'Formations'],
    ['projets.html', 'Projets'],
    ['actualites.html', 'Actualités'],
    ['index.html#leadForm', 'Contact']
  ]);
  assert.equal([...links.matchAll(/<a\b/g)].length, 6);
  for (const file of readdirSync(root).filter(file => file.endsWith('.html') && !['admin.html', 'projet.html'].includes(file))) {
    assert.ok(navbar(read(file)), `Navbar manquante dans ${file}`);
    const stripActive = markup => markup.replace(/ aria-current="[^"]+"/g, '');
    assert.equal(stripActive(navbar(read(file))), stripActive(home), file);
  }
});

test('les destinations et les ancres de la navbar existent', () => {
  for (const [, href] of navbar(read('index.html')).matchAll(/<a [^>]*href="([^"]+)"/g)) {
    const [page, id] = href.split('#');
    const html = read(page);
    if (id) assert.ok(html.includes(`id="${id}"`), href);
  }
});
