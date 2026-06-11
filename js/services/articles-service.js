import { getSupabaseClient, validateSupabaseConfig } from './supabase-client.js';

const ARTICLE_DATA_URL = 'data/articles.json';
const STORAGE_BUCKET = 'article-images';
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function generateSlug(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeArticle(article = {}) {
  const publishedAt = article.published_at || article.publishedAt || article.created_at || article.createdAt || null;
  return {
    id: article.id,
    title: article.title || '',
    slug: article.slug || '',
    category: article.category || 'Actualités',
    excerpt: article.excerpt || '',
    coverImage: article.cover_image_url || article.coverImage || 'assets/images/logo-agritech.png',
    cover_image_url: article.cover_image_url || article.coverImage || '',
    author: article.author || 'Agri-tech',
    content: article.content || '',
    status: article.status || 'draft',
    featured: Boolean(article.featured),
    createdAt: article.created_at || article.createdAt || null,
    updatedAt: article.updated_at || article.updatedAt || null,
    publishedAt: publishedAt || null,
    published_at: publishedAt || null
  };
}

function toDatabaseArticle(article = {}) {
  const status = article.status || 'draft';
  const publishedAt = status === 'published'
    ? (toIsoDate(article.published_at || article.publishedAt) || new Date().toISOString())
    : toIsoDate(article.published_at || article.publishedAt);

  return {
    title: article.title?.trim(),
    slug: generateSlug(article.slug || article.title),
    category: article.category?.trim(),
    excerpt: article.excerpt?.trim() || null,
    cover_image_url: article.cover_image_url || article.coverImage || null,
    author: article.author?.trim() || 'Agri-tech',
    content: article.content?.trim(),
    status,
    featured: Boolean(article.featured),
    published_at: publishedAt
  };
}

function sortPublishedArticles(articles) {
  return [...articles]
    .filter((article) => article.status === 'published')
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

async function fetchLocalArticles() {
  const response = await fetch(ARTICLE_DATA_URL);
  if (!response.ok) throw new Error('Impossible de charger les actualités locales.');
  const articles = await response.json();
  return articles.map(normalizeArticle);
}

async function getConfiguredClient() {
  const config = validateSupabaseConfig();
  if (!config.ok) return null;
  return getSupabaseClient();
}

export async function getPublishedArticles({ fallback = true } = {}) {
  const client = await getConfiguredClient();

  if (client) {
    const { data, error } = await client
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false });

    if (!error) return sortPublishedArticles((data || []).map(normalizeArticle));
    console.error('Erreur Supabase articles publiés:', error.message);
    if (!fallback) throw error;
  }

  if (!fallback) return [];
  return sortPublishedArticles(await fetchLocalArticles());
}

export async function getAllArticlesForAdmin() {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');

  const { data, error } = await client
    .from('articles')
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data || []).map(normalizeArticle);
}

export async function getArticleBySlug(slug, { fallback = true, publicOnly = true } = {}) {
  const safeSlug = generateSlug(slug);
  if (!safeSlug) return null;
  const client = await getConfiguredClient();

  if (client) {
    let query = client.from('articles').select('*').eq('slug', safeSlug).limit(1).maybeSingle();
    if (publicOnly) query = client.from('articles').select('*').eq('slug', safeSlug).eq('status', 'published').limit(1).maybeSingle();
    const { data, error } = await query;
    if (!error) return data ? normalizeArticle(data) : null;
    console.error('Erreur Supabase article:', error.message);
    if (!fallback) throw error;
  }

  if (!fallback) return null;
  const articles = publicOnly ? sortPublishedArticles(await fetchLocalArticles()) : await fetchLocalArticles();
  return articles.find((article) => article.slug === safeSlug) || null;
}

async function clearOtherFeaturedArticles(client, keepId = null) {
  let query = client.from('articles').update({ featured: false }).eq('featured', true);
  if (keepId) query = query.neq('id', keepId);
  const { error } = await query;
  if (error) throw error;
}

export async function createArticle(article) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  const payload = toDatabaseArticle(article);
  if (payload.featured) await clearOtherFeaturedArticles(client);

  const { data, error } = await client.from('articles').insert(payload).select('*').single();
  if (error) throw error;
  return normalizeArticle(data);
}

export async function updateArticle(id, article) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  const payload = toDatabaseArticle(article);
  if (payload.featured) await clearOtherFeaturedArticles(client, id);

  const { data, error } = await client.from('articles').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return normalizeArticle(data);
}

export async function archiveArticle(id) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  const { data, error } = await client
    .from('articles')
    .update({ status: 'archived', featured: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalizeArticle(data);
}

export async function publishArticle(id) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  const { data, error } = await client
    .from('articles')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalizeArticle(data);
}

export async function deleteArticle(id) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  const { error } = await client.from('articles').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export function splitFeaturedArticle(articles = []) {
  const published = sortPublishedArticles(articles.map(normalizeArticle));
  const featured = published.find((article) => article.featured) || published[0] || null;
  const others = featured ? published.filter((article) => article.slug !== featured.slug) : published;
  return { featured, others };
}

export async function uploadArticleImage(file, slug) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');
  if (!file) return '';
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Le fichier sélectionné doit être une image JPG, PNG, WebP ou GIF.');
  if (file.size > MAX_IMAGE_SIZE) throw new Error('L’image dépasse la limite recommandée de 4 Mo.');

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const safeSlug = generateSlug(slug) || 'article';
  const path = `${Date.now()}-${safeSlug}.${extension}`;
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;

  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}
