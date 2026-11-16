// One-shot public REST reads only. Importing this module never makes a request.
import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FIXED_URLS = ['', 'services.html', 'formations.html', 'actualites.html', 'mentions-legales.html', 'politique-confidentialite.html'].map(path => `https://agritech509ht.com/${path}`);

export function validatePublicConfig(url, key) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) throw new Error('URL Supabase publique invalide.');
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey) {
    try {
      const parts = key.split('.');
      publicKey = parts.length === 3 && JSON.parse(Buffer.from(parts[1], 'base64url')).role === 'anon';
    } catch { /* Reject every key other than publishable or anon. */ }
  }
  if (!publicKey) throw new Error('Seule une clé publique publishable ou JWT de rôle anon est acceptée.');
}

async function readSnapshot({ url, key, fetchImpl, pageSize }) {
  const rows = [], ids = new Set();
  let total;
  for (let offset = 0; total === undefined || offset < total;) {
    const endpoint = new URL('/rest/v1/articles', url);
    endpoint.search = new URLSearchParams({ select: 'id,slug,status', status: 'eq.published', order: 'id.asc', offset: String(offset), limit: String(pageSize) });
    const headers = { apikey: key, Prefer: 'count=exact' };
    // Publishable keys are not JWTs; no user session or privileged bearer token.
    if (!key.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${key}`;
    const response = await fetchImpl(endpoint, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Échec de lecture publique Supabase. Sitemap conservé.');
    const range = response.headers.get('content-range');
    const match = /^(?:(\d+)-(\d+)|\*)\/(\d+)$/.exec(range || '');
    if (!match) throw new Error('Comptage exact ou plage de lecture absent.');
    const count = Number(match[3]);
    if (!Number.isSafeInteger(count) || (total !== undefined && count !== total)) throw new Error('Publications modifiées pendant la lecture.');
    total = count;
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Réponse publique invalide.');
    if (!total) {
      if (page.length || match[1] !== undefined) throw new Error('Plage vide incohérente.');
      break;
    }
    const start = Number(match[1]), end = Number(match[2]);
    if (match[1] === undefined || start !== offset || end < start || end >= total || page.length !== end - start + 1 || page.length > pageSize) throw new Error('Lecture incomplète ou plage incohérente.');
    for (const row of page) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || row.status !== 'published' || typeof row.slug !== 'string' || !row.slug.trim() || row.slug !== row.slug.trim()) throw new Error('Publication invalide ou répétée.');
      ids.add(row.id);
      rows.push({ id: row.id, slug: row.slug });
    }
    offset += page.length; // Honor a server cap smaller than the requested size.
  }
  return rows;
}

export function renderSitemap(rows) {
  const urls = new Set(FIXED_URLS);
  for (const row of rows) urls.add(`https://agritech509ht.com/article.html?slug=${encodeURIComponent(row.slug)}`);
  const escapeXml = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...urls].map(url => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>\n`).join('') + '</urlset>\n';
  if (urls.size > 50000 || Buffer.byteLength(xml) > 50 * 1024 * 1024) throw new Error('Limite du sitemap unique dépassée.');
  return xml;
}

export async function generateSitemap({ url, key, output, fetchImpl = fetch, pageSize = 500 }) {
  validatePublicConfig(url, key);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Taille de page invalide.');
  const options = { url, key, fetchImpl, pageSize };
  const first = await readSnapshot(options);
  const second = await readSnapshot(options);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Publications instables : relancer hors modification éditoriale.');
  const xml = renderSitemap(second);
  if (output instanceof URL) output = fileURLToPath(output);
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, xml, { flag: 'wx' });
    await rename(temporary, output); // Same-directory atomic replacement after full validation.
  } finally { await rm(temporary, { force: true }); }
  return new Set(second.map(row => row.slug)).size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--generate') {
    console.error('Usage : node scripts/generate-sitemap.mjs --generate (lecture publique réelle ; aucune écriture Supabase)');
    process.exitCode = 1;
  } else {
    try {
      const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = await import('../js/config/supabase-config.js');
      const count = await generateSitemap({ url, key, output: new URL('../sitemap.xml', import.meta.url) });
      console.log(`Sitemap remplacé : 6 pages fixes et ${count} articles publiés. Vérifier git diff -- sitemap.xml.`);
    } catch {
      // Never log request headers, credentials or server payloads.
      console.error('Génération interrompue. Sitemap précédent conservé ; vérifier réseau, clé publique/RLS, plages et stabilité des publications.');
      process.exitCode = 1;
    }
  }
}
