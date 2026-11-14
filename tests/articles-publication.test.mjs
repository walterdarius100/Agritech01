import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// Exercise the real service, replacing only its Supabase boundary. No network,
// authentication, Storage or production data is used by these tests.
const calls = [];
let result;
let configured;
let initializationFails;
let requestFailure;
let localRequests = 0;
const client = {
  from(table) {
    calls.push(['from', table]);
    const query = {
      select(value) { calls.push(['select', value]); return this; },
      eq(...args) { calls.push(['eq', ...args]); return this; },
      limit(value) { calls.push(['limit', value]); return this; },
      order(...args) { calls.push(['order', ...args]); return this; },
      maybeSingle() { return this; },
      then(resolve, reject) {
        return (requestFailure ? Promise.reject(requestFailure) : Promise.resolve(result)).then(resolve, reject);
      }
    };
    return query;
  }
};
globalThis.__articleReadTest = {
  getSupabaseClient: async () => initializationFails ? null : client,
  isSupabaseConfigured: () => configured
};
const mockUrl = 'data:text/javascript,' + encodeURIComponent(
  'export const getSupabaseClient = (...args) => globalThis.__articleReadTest.getSupabaseClient(...args);' +
  'export const isSupabaseConfigured = () => globalThis.__articleReadTest.isSupabaseConfigured();'
);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './supabase-client.js' && context.parentURL?.endsWith('/js/services/articles-service.js')) {
      return { url: mockUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});
const { getArticleBySlug, getPublishedArticles, getFeaturedArticle } = await import('../js/services/articles-service.js');
hooks.deregister();
const article = { id: 'published-1', slug: 'article-existant', title: 'Article publié', status: 'published', category: 'Conseils', published_at: '2026-06-10' };

test('lecture publique et contrôle du JSON', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { localRequests++; throw new Error('JSON local indisponible'); };
  t.after(() => { globalThis.fetch = originalFetch; delete globalThis.__articleReadTest; });
  t.beforeEach(() => {
    calls.length = 0;
    result = { data: article, error: null };
    configured = true;
    initializationFails = false;
    requestFailure = null;
    localRequests = 0;
  });
  t.afterEach(() => assert.equal(localRequests, 0, 'aucune copie locale ne doit autoriser une publication'));

  await t.test('article publié et ancien slug conservés', async () => {
    assert.equal((await getArticleBySlug(article.slug)).slug, article.slug);
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'slug' && call[2] === article.slug));
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'status' && call[2] === 'published'));
  });
  await t.test('absence autoritative : aucun retour au JSON, même avec ancienne option', async () => {
    result = { data: null, error: null };
    assert.equal(await getArticleBySlug(article.slug, { useFallback: true }), null);
  });
  for (const status of ['draft', 'archived']) {
    await t.test(`${status} refusé même si le serveur renvoie la ligne`, async () => {
      result = { data: { ...article, status }, error: null };
      assert.equal(await getArticleBySlug(article.slug), null);
    });
  }
  for (const [name, error] of [
    ['réseau', new TypeError('Failed to fetch')],
    ['service indisponible', { status: 503, message: 'Service unavailable' }],
    ['autorisation', { status: 403, code: '42501', message: 'permission denied' }],
    ['session expirée', { status: 401, message: 'JWT expired' }]
  ]) {
    await t.test(`erreur ${name} propagée pour article et liste`, async () => {
      result = { data: null, error };
      for (const read of [() => getArticleBySlug(article.slug), () => getPublishedArticles()]) {
        await assert.rejects(read, caught => caught === error);
      }
    });
  }
  await t.test('rejet réseau propagé sans secours', async () => {
    requestFailure = new TypeError('Network unavailable');
    await assert.rejects(() => getArticleBySlug(article.slug), error => error === requestFailure);
    await assert.rejects(() => getPublishedArticles(), error => error === requestFailure);
  });
  await t.test('Supabase non configuré : rejet explicite pour les deux lectures', async () => {
    configured = false;
    await assert.rejects(() => getArticleBySlug(article.slug), /Configuration du service/);
    await assert.rejects(() => getPublishedArticles(), /Configuration du service/);
    assert.equal(calls.length, 0);
  });
  await t.test('échec initialisation SDK : rejet explicite', async () => {
    initializationFails = true;
    await assert.rejects(() => getArticleBySlug(article.slug), /Connexion au service/);
    await assert.rejects(() => getPublishedArticles(), /Connexion au service/);
  });
  await t.test('liste filtrée, triée et article à la une préservé', async () => {
    result = { data: [
      { ...article, id: 'draft', status: 'draft' },
      { ...article, id: 'archive', status: 'archived' },
      { ...article, featured: true },
      { ...article, id: 'new', slug: 'nouveau', published_at: '2026-06-20' }
    ], error: null };
    const articles = await getPublishedArticles();
    assert.deepEqual(articles.map(item => item.id), ['new', article.id]);
    assert.equal(getFeaturedArticle(articles).id, article.id);
    assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'status' && call[2] === 'published'));
  });
  await t.test('liste vide autoritative', async () => {
    result = { data: [], error: null };
    assert.deepEqual(await getPublishedArticles(), []);
  });
  await t.test('réponse de liste invalide signalée', async () => {
    result = { data: null, error: null };
    await assert.rejects(() => getPublishedArticles(), /Réponse.*invalide/);
  });
  await t.test('réponse individuelle invalide signalée', async () => {
    result = { data: [], error: null };
    await assert.rejects(() => getArticleBySlug(article.slug), /Réponse.*invalide/);
  });
  await t.test('slug absent sans requête', async () => {
    assert.equal(await getArticleBySlug(''), null);
    assert.equal(calls.length, 0);
  });
  await t.test('JSON indisponible sans effet sur une lecture Supabase valide', async () => {
    assert.equal((await getArticleBySlug(article.slug)).id, article.id);
  });
  await t.test('JSON invalide jamais consulté pendant une panne', async () => {
    globalThis.fetch = async () => { localRequests++; return { ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } }; };
    result = { data: null, error: { status: 503, message: 'Service unavailable' } };
    await assert.rejects(() => getArticleBySlug(article.slug), error => error.status === 503);
  });
  await t.test('le fichier public ne contient que des publications', async () => {
    const articles = JSON.parse(await readFile(new URL('../data/articles.json', import.meta.url), 'utf8'));
    assert.ok(Array.isArray(articles));
    assert.ok(articles.every(item => item && item.status === 'published'), 'retirer tout brouillon ou archive du JSON public');
    assert.ok(articles.every(item => typeof item.slug === 'string' && item.slug.length > 0));
    assert.equal(new Set(articles.map(item => item.slug)).size, articles.length);
  });
});
