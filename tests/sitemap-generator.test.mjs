import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateSitemap, validatePublicConfig } from '../scripts/generate-sitemap.mjs';
const url = 'https://simulation.supabase.co', key = 'sb_publishable_simulation';
const row = (id, slug = id) => ({ id, slug, status: 'published' });
const response = (data, range, status = 200) => new Response(JSON.stringify(data), {status, headers:{'content-range':range}});
function source(rows, cap = 2) {
  return async (endpoint, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.apikey, key);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(endpoint.searchParams.get('status'), 'eq.published');
    assert.equal(endpoint.searchParams.get('order'), 'id.asc');
    assert.equal(options.headers.Prefer, 'count=exact');
    const start = Number(endpoint.searchParams.get('offset'));
    const page = rows.slice(start, start + Math.min(cap, Number(endpoint.searchParams.get('limit'))));
    return response(page, rows.length ? `${start}-${start + page.length - 1}/${rows.length}` : '*/0');
  };
}
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'agritech-sitemap-'));
  t.after(() => rm(dir, {recursive:true, force:true}));
  const output = join(dir, 'sitemap.xml');
  await writeFile(output, 'previous sitemap');
  return {dir, output};
}
test('pagination plafonnée, déduplication, URL historiques et XML réel', async t => {
  const {output} = await fixture(t);
  const rows = [row('1', 'été & <sol> "\'/?#'), row('2', 'ancien-slug'), row('3', 'ancien-slug')];
  assert.equal(await generateSitemap({url,key,output,fetchImpl:source(rows, 1)}), 2);
  const xml = await readFile(output, 'utf8');
  const urls = JSON.parse(execFileSync('python3', ['-c', "import xml.etree.ElementTree as E,json,sys; print(json.dumps([e.text for e in E.parse(sys.argv[1]).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]))",output], {encoding:'utf8'}));
  assert.equal(urls.length, 8);
  assert.equal(new Set(urls).size, 8);
  assert.ok(urls.includes('https://agritech509ht.com/article.html?slug=' + encodeURIComponent(rows[0].slug)));
  assert.ok(xml.includes('&apos;'));
  assert.doesNotMatch(xml, /lastmod|admin.html/);
});
test('régénération retire les dépublications et suppressions ; zéro publication valide', async t => {
  const {output} = await fixture(t);
  await generateSitemap({url,key,output,fetchImpl:source([row('1'),row('2')])});
  await generateSitemap({url,key,output,fetchImpl:source([row('2')])});
  assert.doesNotMatch(await readFile(output,'utf8'), /slug=1</);
  await generateSitemap({url,key,output,fetchImpl:source([])});
  assert.doesNotMatch(await readFile(output,'utf8'), /article.html/);
});
const failures = {
  réseau: async () => { throw new TypeError('offline'); },
  HTTP: async () => response({}, '*/0', 503),
  JSON: async () => new Response('{', {headers:{'content-range':'0-0/1'}}),
  objet: async () => response({}, '0-0/1'),
  'compte absent': async () => response([], '*/ *'),
  'page tronquée': async () => response([row('1')], '0-1/2'),
  'page vide prématurée': async () => response([], '*/2'),
  'mauvaise plage': async () => response([row('1')], '1-1/2'),
  brouillon: async () => response([{...row('1'),status:'draft'}], '0-0/1'),
  archive: async () => response([{...row('1'),status:'archived'}], '0-0/1'),
  'slug invalide': async () => response([row('1','')], '0-0/1'),
  'ID répété': async () => response([row('1'),row('1')], '0-1/2'),
};
for (const [name, fetchImpl] of Object.entries(failures)) test(`${name} : fichier existant intact`, async t => {
  const {dir, output} = await fixture(t);
  await assert.rejects(generateSitemap({url,key,output,fetchImpl}));
  assert.equal(await readFile(output,'utf8'), 'previous sitemap');
  assert.deepEqual(await readdir(dir), ['sitemap.xml']);
});
test('échec en page suivante et changement entre deux lectures : conservation', async t => {
  const {output} = await fixture(t);
  for (const changed of [false,true]) {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (!changed && calls > 1) throw new Error('offline');
      return response([row(String(calls))], changed ? '0-0/1' : '0-0/2');
    };
    await assert.rejects(generateSitemap({url,key,output,fetchImpl,pageSize:1}));
    assert.equal(await readFile(output,'utf8'),'previous sitemap');
  }
});
test('clés privilégiées et rôles inconnus refusés avant toute requête', async t => {
  const {output} = await fixture(t);
  for (const value of ['sb_secret_invalid', 'service_role', 'invalid', ...['service_role','authenticated'].map(role => 'e30.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature')]) {
    await assert.rejects(generateSitemap({url,key:value,output,fetchImpl:()=>assert.fail('network forbidden')}));
  }
  validatePublicConfig(url, 'e30.' + Buffer.from('{"role":"anon"}').toString('base64url') + '.signature');
});
test('plus de 1000 publications et compte changeant entre pages', async t => {
  const {output} = await fixture(t);
  const rows = Array.from({length:1201}, (_, i) => row(String(i).padStart(5,'0')));
  assert.equal(await generateSitemap({url,key,output,fetchImpl:source(rows,500)}),1201);
  const previous = await readFile(output,'utf8');
  let calls = 0;
  await assert.rejects(generateSitemap({url,key,output,pageSize:1,fetchImpl:async () => ++calls === 1 ? response([row('1')],'0-0/2') : response([row('2')],'1-1/3')}));
  assert.equal(await readFile(output,'utf8'),previous);
});
