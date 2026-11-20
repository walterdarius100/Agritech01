import { getSupabaseClient } from './supabase-client.js';

export const PROJECT_PHOTO_BUCKET = 'project-photos';
export const PROJECT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const CARD_FIELDS = 'id,title,summary,location,period,domain,photos,published_at';
const SIGNED_URL_LIFETIME = 300;

export function projectHref(id) {
  return `projet.html?id=${encodeURIComponent(id)}`;
}

export function projectPhotoPath(id, key, width) {
  return `${id}/${key}-${width}.webp`;
}

async function requireClient() {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Connexion Supabase indisponible.');
  return client;
}

function publishedQuery(client, fields) {
  return client.from('projects').select(fields).not('published_at', 'is', null);
}

export async function listPublishedProjects({ limit = 12, offset = 0, coversOnly = false } = {}) {
  const client = await requireClient();
  let query = publishedQuery(client, CARD_FIELDS);
  if (coversOnly) query = query.neq('photos', '[]');
  const { data, error } = await query.order('published_at', { ascending: false })
    .order('id', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function getPublishedProject(id) {
  if (!PROJECT_ID.test(id)) return null;
  const client = await requireClient();
  const { data, error } = await publishedQuery(client, `${CARD_FIELDS},details`).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function signProjectPhotos(entries, width, client) {
  const paths = entries.map(({ id, photo }) => projectPhotoPath(id, photo.key, width));
  if (!paths.length) return [];
  const supabase = client || await requireClient();
  const { data, error } = await supabase.storage.from(PROJECT_PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_LIFETIME);
  if (error) throw error;
  const urls = new Map(data.filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]));
  return paths.map(path => urls.get(path) || '');
}

// One cover per project first, in publication order, then fill with additional photos.
export function selectHomeProjectPhotos(projects) {
  const entries = [];
  for (let index = 0; index < 4; index += 1) {
    for (const project of projects) {
      const photo = project.photos[index];
      if (photo) entries.push({ id: project.id, title: project.title, photo });
      if (entries.length === 3) return entries;
    }
  }
  return entries;
}
