import { getSupabaseClient } from './supabase-client.js';
import { generateSlug } from './articles-service.js';

export const ARTICLE_IMAGES_BUCKET = 'article-images';
export const MAX_ARTICLE_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

const IMAGE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

function getRandomSuffix() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

function getCleanExtension(file) {
  const mimeExtension = IMAGE_EXTENSION_BY_MIME[file.type];
  const fileExtension = String(file.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return mimeExtension || fileExtension || 'jpg';
}

function sanitizeFileBaseName(fileName, fallback = 'image') {
  const withoutExtension = String(fileName || '').replace(/\.[^.]+$/, '');
  return generateSlug(withoutExtension) || fallback;
}

function assertValidImageFile(file) {
  if (!file) throw new Error('Aucun fichier image sélectionné.');
  if (!file.type?.startsWith('image/')) throw new Error('Le fichier sélectionné doit être une image.');
  if (file.size > MAX_ARTICLE_IMAGE_SIZE_BYTES) throw new Error('L’image dépasse la limite de 4 Mo.');
}

export function createArticleStorageId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${getRandomSuffix()}`;
}

export function buildArticleImagePath({ file, articleId, slug = 'article', slot = 'content' }) {
  const safeArticleId = generateSlug(articleId) || createArticleStorageId();
  const safeSlot = slot === 'cover' ? 'cover' : 'content';
  const safeSlug = generateSlug(slug) || 'article';
  const safeName = sanitizeFileBaseName(file?.name, safeSlot);
  const extension = getCleanExtension(file || {});
  return `articles/${safeArticleId}/${safeSlot}/${Date.now()}-${getRandomSuffix()}-${safeSlug}-${safeName}.${extension}`;
}

export async function uploadArticleImageToStorage({ file, articleId, slug, slot = 'content' }) {
  assertValidImageFile(file);

  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured');

  const path = buildArticleImagePath({ file, articleId, slug, slot });
  const { error } = await client.storage.from(ARTICLE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false
  });

  if (error) throw error;

  const { data } = client.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Impossible de récupérer l’URL publique de l’image.');
  return data.publicUrl;
}
