import { getSupabaseClient, isSupabaseConfigured as hasSupabaseConfig } from './supabase-client.js';

const LOCAL_ARTICLES_URL = 'data/articles.json';
export const ARTICLE_IMAGES_BUCKET = 'article-images';
export const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

export function isSupabaseConfigured() {
  return hasSupabaseConfig();
}

export function generateSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toPublicArticle(article) {
  return {
    id: article.id || null,
    title: article.title || '',
    slug: article.slug || '',
    category: article.category || 'Actualités',
    excerpt: article.excerpt || '',
    coverImage: article.cover_image_url || article.coverImage || '',
    cover_image_url: article.cover_image_url || article.coverImage || '',
    author: article.author || 'Agri-tech',
    content: article.content || '',
    status: article.status || 'draft',
    featured: article.featured === true,
    createdAt: article.created_at || article.createdAt || null,
    updatedAt: article.updated_at || article.updatedAt || null,
    publishedAt: article.published_at || article.publishedAt || article.created_at || article.createdAt || null,
  };
}

function sortByPublicationDate(articles) {
  return [...articles].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

export async function getLocalPublishedArticles() {
  const response = await fetch(LOCAL_ARTICLES_URL);
  if (!response.ok) throw new Error('Impossible de charger les actualités locales.');

  const articles = await response.json();
  return sortByPublicationDate(
    articles
      .filter((article) => article.status === 'published')
      .map(toPublicArticle),
  );
}

export async function getPublishedArticles() {
  if (!hasSupabaseConfig()) {
    return getLocalPublishedArticles();
  }

  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sortByPublicationDate((data || []).map(toPublicArticle));
  } catch (error) {
    return getLocalPublishedArticles().catch(() => []);
  }
}

export async function getPublishedArticleBySlug(slug) {
  if (!slug) return null;

  if (!hasSupabaseConfig()) {
    const articles = await getLocalPublishedArticles();
    return articles.find((article) => article.slug === slug) || null;
  }

  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;
    return data ? toPublicArticle(data) : null;
  } catch (error) {
    const articles = await getLocalPublishedArticles().catch(() => []);
    return articles.find((article) => article.slug === slug) || null;
  }
}

export async function getAllArticlesForAdmin() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(toPublicArticle);
}

export async function getCurrentSession() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInAdmin(email, password) {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOutAdmin() {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function onAuthStateChange(callback) {
  const supabase = await getSupabaseClient();
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function saveArticle(article) {
  const supabase = await getSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    title: article.title,
    slug: generateSlug(article.slug || article.title),
    category: article.category,
    excerpt: article.excerpt || null,
    cover_image_url: article.cover_image_url || null,
    author: article.author || 'Agri-tech',
    content: article.content,
    status: article.status,
    featured: article.featured === true,
    published_at: article.status === 'published' ? (article.published_at || now) : null,
  };

  if (payload.featured) {
    const resetQuery = supabase.from('articles').update({ featured: false }).eq('featured', true);
    if (article.id) resetQuery.neq('id', article.id);
    const { error: resetError } = await resetQuery;
    if (resetError) throw resetError;
  }

  const query = article.id
    ? supabase.from('articles').update(payload).eq('id', article.id).select('*').single()
    : supabase.from('articles').insert(payload).select('*').single();

  const { data, error } = await query;
  if (error) throw error;
  return toPublicArticle(data);
}

export async function archiveArticle(id) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('articles').update({ status: 'archived', featured: false }).eq('id', id);
  if (error) throw error;
}

export async function deleteArticle(id) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('articles').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadArticleImage(file, slugHint = 'article') {
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier sélectionné doit être une image.');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('L’image ne doit pas dépasser 4 Mo.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeSlug = generateSlug(slugHint) || 'article';
  const filePath = `${safeSlug}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const supabase = await getSupabaseClient();
  const { error } = await supabase.storage.from(ARTICLE_IMAGES_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
