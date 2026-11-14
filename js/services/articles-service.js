import { getSupabaseClient, isSupabaseConfigured } from './supabase-client.js';

const IMAGE_BUCKET = 'article-images';
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

export function generateSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeArticle(article = {}) {
  const publishedAt = article.published_at || article.publishedAt || article.created_at || article.createdAt || '';
  return {
    id: article.id,
    title: article.title || '',
    slug: article.slug || '',
    category: article.category || '',
    excerpt: article.excerpt || '',
    coverImage: article.cover_image_url || article.coverImage || '',
    cover_image_url: article.cover_image_url || article.coverImage || '',
    author: article.author || 'Agri-tech',
    content: Array.isArray(article.content) ? article.content.join('\n\n') : (article.content || ''),
    status: article.status || 'draft',
    featured: Boolean(article.featured),
    createdAt: article.created_at || article.createdAt || '',
    created_at: article.created_at || article.createdAt || '',
    updatedAt: article.updated_at || article.updatedAt || '',
    updated_at: article.updated_at || article.updatedAt || '',
    publishedAt,
    published_at: publishedAt
  };
}

function toDatabasePayload(article) {
  const status = article.status || 'draft';
  const publishedAt = status === 'published'
    ? (article.published_at || article.publishedAt || new Date().toISOString())
    : (article.published_at || article.publishedAt || null);

  return {
    title: String(article.title || '').trim(),
    slug: generateSlug(article.slug || article.title),
    category: String(article.category || '').trim(),
    excerpt: String(article.excerpt || '').trim(),
    cover_image_url: String(article.cover_image_url || article.coverImage || '').trim() || null,
    author: String(article.author || 'Agri-tech').trim() || 'Agri-tech',
    content: String(article.content || '').trim(),
    status,
    featured: Boolean(article.featured),
    published_at: publishedAt
  };
}

function sortByPublicationDate(articles) {
  return [...articles].sort((a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0));
}

async function getPublicReadClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Configuration du service des articles indisponible.');
  }
  const client = await getSupabaseClient();
  if (!client) throw new Error('Connexion au service des articles impossible.');
  return client;
}

async function unsetOtherFeaturedArticles(client, currentArticleId = null) {
  let query = client.from('articles').update({ featured: false }).eq('featured', true);
  if (currentArticleId) query = query.neq('id', currentArticleId);
  const { error } = await query;
  if (error) throw error;
}


function getCleanImageExtension(file) {
  return file.name.split('.').pop().toLowerCase();
}

function sanitizeStorageFileName(fileName) {
  const baseName = String(fileName || 'image')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

  return baseName || 'image';
}

export async function validateArticleImageFile(file) {
  const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
  if (!file || !file.size) fail('IMAGE_FORMAT', 'Veuillez sélectionner une image valide.');
  if (file.size > MAX_IMAGE_SIZE_BYTES) fail('IMAGE_SIZE', 'L’image dépasse 4 Mio.');
  const extensions = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'] };
  const ext = String(file.name || '').split('.').pop().toLowerCase();
  if (!extensions[file.type]?.includes(ext)) fail('IMAGE_FORMAT', 'Formats acceptés : JPEG, PNG, WebP et GIF. SVG refusé.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (a, b) => String.fromCharCode(...bytes.slice(a, b));
  const valid = {
    'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    'image/png': [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v),
    'image/webp': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
    'image/gif': ['GIF87a', 'GIF89a'].includes(ascii(0, 6))
  };
  if (!valid[file.type]) fail('IMAGE_FORMAT', 'Le contenu du fichier ne correspond pas à son format.');
}

async function uploadImageFileToBucket(file, path) {
  const client = await getClientOrThrow();
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  });

  if (error) throw error;
  const { data } = client.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('URL Storage indisponible après upload.');
  return data.publicUrl;
}

async function getClientOrThrow() {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  return client;
}

// Supabase is authoritative. A static copy cannot confirm a publication's
// current status, even during an outage. Never fall back to local articles.
export async function getPublishedArticles() {
  const client = await getPublicReadClient();
  const { data, error } = await client
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Réponse du service des articles invalide.');
  return sortByPublicationDate(data.map(normalizeArticle).filter((article) => article.status === 'published'));
}

export async function getAllArticlesForAdmin() {
  const client = await getClientOrThrow();
  const { data, error } = await client
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeArticle);
}

export async function getArticleBySlug(slug, { publishedOnly = true } = {}) {
  if (!slug) return null;
  const client = await getPublicReadClient();
  let query = client.from('articles').select('*').eq('slug', slug);
  if (publishedOnly) query = query.eq('status', 'published');
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Réponse du service des articles invalide.');
  }
  const article = normalizeArticle(data);
  return publishedOnly && article.status !== 'published' ? null : article;
}

export function getFeaturedArticle(articles) {
  const published = sortByPublicationDate((articles || []).filter((article) => article.status === 'published'));
  const featured = published.find((article) => article.featured === true);
  return featured || published[0] || null;
}

export async function createArticle(article) {
  const client = await getClientOrThrow();
  const payload = toDatabasePayload(article);

  const { data, error } = await client.from('articles').insert(payload).select('*').single();
  if (error) throw error;
  return finishFeaturedWrite(client, data, payload.featured);
}

export async function updateArticle(id, article) {
  const client = await getClientOrThrow();
  const payload = toDatabasePayload(article);

  const { data, error } = await client.from('articles').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return finishFeaturedWrite(client, data, payload.featured);
}

export async function publishArticle(id) {
  const client = await getClientOrThrow();
  const { data, error } = await client
    .from('articles')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeArticle(data);
}

export async function archiveArticle(id) {
  const client = await getClientOrThrow();
  const { data, error } = await client
    .from('articles')
    .update({ status: 'archived', featured: false })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeArticle(data);
}

export async function deleteArticle(id) {
  const client = await getClientOrThrow();
  const { error } = await client.from('articles').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function setFeaturedArticle(id) {
  const client = await getClientOrThrow();
  const { data, error } = await client.from('articles').update({ featured: true }).eq('id', id).select('*').single();
  if (error) throw error;
  return finishFeaturedWrite(client, data, true);
}

export async function uploadArticleImage(file, slug) {
  if (!file) return '';
  await validateArticleImageFile(file);

  const extension = getCleanImageExtension(file);
  const cleanSlug = generateSlug(slug) || 'article';
  const path = `${crypto.randomUUID()}-${cleanSlug}.${extension}`;
  return uploadImageFileToBucket(file, path);
}

export async function uploadArticleContentImage(file, articleKey = '') {
  await validateArticleImageFile(file);

  const extension = getCleanImageExtension(file);
  const cleanArticleKey = generateSlug(articleKey) || `draft-${Date.now()}`;
  const cleanFileName = sanitizeStorageFileName(file.name);
  const path = `articles/${cleanArticleKey}/content/${crypto.randomUUID()}-${cleanFileName}.${extension}`;
  return uploadImageFileToBucket(file, path);
}

async function finishFeaturedWrite(client, data, featured) {
  const saved = normalizeArticle(data);
  if (featured) {
    try { await unsetOtherFeaturedArticles(client, saved.id); }
    catch (error) {
      throw Object.assign(new Error('Article enregistré, mais mise à la une partiellement effectuée.'), {
        code: 'ARTICLE_PARTIAL', savedArticle: saved, cause: error
      });
    }
  }
  return saved;
}
