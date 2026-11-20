import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const calls = [];
const rows = [];
let signedRows = [];
const client = {
  from(table) {
    const query = {};
    calls.push(['from', table]);
    for (const method of ['select', 'not', 'eq', 'neq', 'order', 'range']) {
      query[method] = (...args) => { calls.push([method, ...args]); return query; };
    }
    query.then = resolve => resolve({ data: rows });
    query.maybeSingle = async () => ({ data: rows[0] || null });
    return query;
  },
  storage: {
    from(bucket) {
      calls.push(['bucket', bucket]);
      return {
        async createSignedUrls(paths, expiresIn) {
          calls.push(['sign', paths, expiresIn]);
          return { data: signedRows };
        }
      };
    }
  }
};
globalThis.projectTestClient = client;
const mock = 'data:text/javascript,' + encodeURIComponent('export const getSupabaseClient = async () => globalThis.projectTestClient;');
const hooks = registerHooks({ resolve(specifier, context, next) {
  return specifier.endsWith('supabase-client.js') ? { url: mock, shortCircuit: true } : next(specifier, context);
} });
const { getPublishedProject, listPublishedProjects, projectPhotoPath, selectHomeProjectPhotos, signProjectPhotos } = await import('../js/services/projects-service.js');
hooks.deregister();

const id = '12345678-1234-1234-1234-123456789abc';
const photo = key => ({ key, alt: key });
const project = (id, ...keys) => ({ id, title: id, photos: keys.map(photo) });

test('l’accueil privilégie une couverture par projet puis complète avec les autres photos', () => {
  assert.deepEqual(selectHomeProjectPhotos([]), []);
  const selection = projects => selectHomeProjectPhotos(projects).map(({ photo }) => photo.key);
  assert.deepEqual(selection([project('A', 'a', 'a2'), project('B', 'b'), project('C', 'c')]), ['a', 'b', 'c']);
  assert.deepEqual(selection([project('A', 'a', 'a2', 'a3'), project('B', 'b')]), ['a', 'b', 'a2']);
  assert.deepEqual(selection([project('A'), project('B', 'b')]), ['b']);
});

test('la liste publique filtre et trie les publications avec une plage bornée', async () => {
  calls.length = 0;
  await listPublishedProjects({ offset: 9, limit: 10, coversOnly: true });
  assert.deepEqual(calls.slice(2), [
    ['not', 'published_at', 'is', null], ['neq', 'photos', '[]'],
    ['order', 'published_at', { ascending: false }], ['order', 'id', { ascending: false }], ['range', 9, 18]
  ]);
});

test('une fiche refuse un ID invalide et filtre les brouillons même avec une session', async () => {
  calls.length = 0;
  assert.equal(await getPublishedProject('xxx'), null);
  assert.deepEqual(calls, []);
  assert.equal(await getPublishedProject(id), null);
  assert.deepEqual(calls.slice(2), [['not', 'published_at', 'is', null], ['eq', 'id', id]]);
});

test('une photo indisponible ne décale pas les autres URL signées', async () => {
  const a = projectPhotoPath(id, 'a', 640);
  const b = projectPhotoPath(id, 'b', 640);
  signedRows = [{ path: b, signedUrl: 'https://example.invalid/b' }, { path: a, error: 'Not found' }];
  assert.deepEqual(await signProjectPhotos([{ id, photo: photo('a') }, { id, photo: photo('b') }], 640), ['', 'https://example.invalid/b']);
  assert.deepEqual(calls.at(-1), ['sign', [a, b], 300]);
});
