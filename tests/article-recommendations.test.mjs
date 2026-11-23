import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRelatedArticles } from '../js/utils/article-recommendations.js';
import { normalizeArticle } from '../js/services/articles-service.js';

const current = { id: 'current', slug: 'current', category: 'Production végétale', status: 'published' };
function article(slug, day, category = 'Production animale', status = 'published') {
  return { id: slug, slug, published_at: day ? `2026-01-${day}T00:00:00Z` : '', category, status };
}
const matching = [
  article('m1', '01', ' PRODUCTION    VEGETALE '),
  article('m2', '02', 'Production végétale'),
  article('m3', '03', 'Production VÉGÉTALE'),
  article('m4', '04', 'Production végétale')
];
const others = [article('a', '09'), article('b', '11'), article('c', '10', 'Agriculture biologique')];
const slugs = (rows, source = current) => getRelatedArticles(rows, source).map(({ slug }) => slug);

test('priorité à la catégorie, puis complément par ordre de publication', () => {
  assert.deepEqual(slugs([...others, ...matching]), ['m4', 'm3', 'm2']);
  assert.deepEqual(slugs([...others, ...matching.slice(0, 2)]), ['m2', 'm1', 'b']);
  assert.deepEqual(slugs([...others, matching[0]]), ['m1', 'b', 'c']);
  assert.deepEqual(slugs(others), ['b', 'c', 'a']);
  assert.deepEqual(slugs(others.slice(0, 2)), ['b', 'a']);
  assert.deepEqual(slugs([others[0]]), ['a']);
});

test('exclusion de l’article courant, des non-publiés et des doublons', () => {
  const duplicateId = { ...matching[3], slug: 'renamed' };
  const hidden = [article('draft', '31', current.category, 'draft'), article('archived', '30', current.category, 'archived')];
  const aliases = [current, { ...current, slug: 'alias' }, { ...current, id: 'other-id' }];
  assert.deepEqual(slugs([...matching.slice(2), ...aliases, ...hidden, matching[3], duplicateId]), ['m4', 'm3']);
  assert.deepEqual(slugs([...aliases, ...hidden]), []);
});

test('dates identiques, absentes ou invalides et catégorie de repli', () => {
  const invalid = { ...article('c', null, ''), published_at: 'invalide' };
  const missing = normalizeArticle({ ...article('b', null), created_at: '2026-02-01' });
  const ties = [article('z', '01'), article('a', '01')];
  assert.deepEqual(slugs([invalid, missing, ...ties], { ...current, category: null }), ['a', 'z', 'b']);
  assert.deepEqual(slugs([invalid, missing]), ['b', 'c']);
  assert.deepEqual(slugs([...matching, ...others], { ...current, category: 'Divers' }), ['b', 'c', 'a']);
});
