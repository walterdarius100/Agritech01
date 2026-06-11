import { getSupabaseClient, isSupabaseConfigured } from './supabase-client.js';

const ARTICLE_DATA_URL = 'data/articles.json';
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

async function fetchLocalArticles() {
  const response = await fetch(ARTICLE_DATA_URL);
  if (!response.ok) throw new Error('Impossible de charger les actualités locales.');
  const articles = await response.json();
  return articles.map(normalizeArticle);
}

async function unsetOtherFeaturedArticles(client, currentArticleId = null) {
  let query = client.from('articles').update({ featured: false }).eq('featured', true);
  if (currentArticleId) query = query.neq('id', currentArticleId);
  const { error } = await query;
  if (error) throw error;
}

async function getClientOrThrow() {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  return client;
}

export async function getPublishedArticles({ useFallback = true } = {}) {
  const client = await getSupabaseClient();

  if (client && isSupabaseConfigured()) {
    const { data, error } = await client
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false });

    if (!error && Array.isArray(data)) return sortByPublicationDate(data.map(normalizeArticle));
    console.warn('Fallback local articles after Supabase read error', error?.message || error);
  }

  if (!useFallback) return [];
  const articles = await fetchLocalArticles();
  return sortByPublicationDate(articles.filter((article) => article.status === 'published'));
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

export async function getArticleBySlug(slug, { publishedOnly = true, useFallback = true } = {}) {
  if (!slug) return null;
  const client = await getSupabaseClient();

  if (client && isSupabaseConfigured()) {
    let query = client.from('articles').select('*').eq('slug', slug).limit(1).maybeSingle();
    if (publishedOnly) query = client.from('articles').select('*').eq('slug', slug).eq('status', 'published').limit(1).maybeSingle();
    const { data, error } = await query;
    if (!error && data) return normalizeArticle(data);
    if (error) console.warn('Fallback local article after Supabase read error', error.message || error);
  }

  if (!useFallback) return null;
  const articles = await fetchLocalArticles();
  return articles.find((article) => article.slug === slug && (!publishedOnly || article.status === 'published')) || null;
}

export function getFeaturedArticle(articles) {
  const published = sortByPublicationDate((articles || []).filter((article) => article.status === 'published'));
  const featured = published.find((article) => article.featured === true);
  return featured || published[0] || null;
}

export async function createArticle(article) {
  const client = await getClientOrThrow();
  const payload = toDatabasePayload(article);
  if (payload.featured) await unsetOtherFeaturedArticles(client);

  const { data, error } = await client.from('articles').insert(payload).select('*').single();
  if (error) throw error;
  return normalizeArticle(data);
}

export async function updateArticle(id, article) {
  const client = await getClientOrThrow();
  const payload = toDatabasePayload(article);
  if (payload.featured) await unsetOtherFeaturedArticles(client, id);

  const { data, error } = await client.from('articles').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return normalizeArticle(data);
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
  await unsetOtherFeaturedArticles(client, id);
  const { data, error } = await client.from('articles').update({ featured: true }).eq('id', id).select('*').single();
  if (error) throw error;
  return normalizeArticle(data);
}

export async function uploadArticleImage(file, slug) {
  const client = await getClientOrThrow();
  if (!file) return '';
  if (!file.type?.startsWith('image/')) throw new Error('Le fichier sélectionné doit être une image.');
  if (file.size > MAX_IMAGE_SIZE_BYTES) throw new Error('L’image dépasse la limite de 4 Mo.');

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const cleanSlug = generateSlug(slug) || 'article';
  const path = `${Date.now()}-${cleanSlug}.${extension}`;
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  });

  if (error) throw error;
  const { data } = client.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}
