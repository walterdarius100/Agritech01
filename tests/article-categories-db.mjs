import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ARTICLE_CATEGORIES } from '../js/utils/article-categories.js';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const db = new PGlite();
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const setup = await read('../docs/SUPABASE_SETUP.md');
const schema = setup.match(/create table if not exists public\.articles \([\s\S]+?\n\);/)[0];
const guide = await read('../docs/article-categories.md');
const diagnostic = guide.match(/begin read only;[\s\S]+?commit;/)[0];
const migration = await read('../supabase/migrations/202611230001_article_categories.sql');
try {
  await db.exec(schema);
  await db.exec(`
    insert into public.articles (title, slug, category, content, status) values
      ('Un', 'un', 'Actualités et analyses', '<p>Publié</p>', 'published'),
      ('Deux', 'deux', 'Production végétale', '<p>Brouillon</p>', 'draft'),
      ('Trois', 'trois', 'Ancien libellé', '<p>Archivé</p>', 'archived')
  `);
  const rows = () => db.query('select * from public.articles order by slug').then(result => result.rows);
  const before = await rows();
  await db.exec(diagnostic);
  await assert.rejects(db.exec(migration), /1 article\(s\) à reclasser/);
  await db.exec('rollback');
  assert.deepEqual(await rows(), before);
  await db.exec("update public.articles set category = 'Production animale' where slug = 'trois'");
  const afterEditorialUpdate = await rows();
  await db.exec(migration);
  await db.exec(diagnostic);
  assert.deepEqual(await rows(), afterEditorialUpdate);
  for (const category of ARTICLE_CATEGORIES) {
    await db.query("update public.articles set category = $1 where slug = 'trois'", [category]);
  }
  for (const category of ['', 'Inconnue', 'production végétale', 'Production vegetale', 'Production végétale ']) {
    await assert.rejects(db.query("update public.articles set category = $1 where slug = 'un'", [category]), {
      code: '23514', constraint: 'articles_category_check'
    });
  }
  await assert.rejects(db.exec("update public.articles set category = null where slug = 'deux'"), { code: '23502' });
  await assert.rejects(db.exec(migration), { code: '42710' });
  await db.exec('rollback');
  assert.deepEqual(await rows(), afterEditorialUpdate);
  console.log('PostgreSQL local : blocage des anciennes valeurs, intégrité et préservation des lignes vérifiés.');
} finally {
  await db.close();
}
