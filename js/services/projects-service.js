import { getSupabaseClient } from './supabase-client.js';

export const PROJECT_PHOTO_BUCKET = 'project-photos';
export const PROJECT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const PORTFOLIO_FIELDS = 'id,title,location,period,domain,photos,details';
const SIGNED_URL_LIFETIME = 300;

export function projectAnchor(id) {
  return `projet-${encodeURIComponent(id)}`;
}

export function projectHref(id) {
  return `projets.html#${projectAnchor(id)}`;
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

export async function listPublishedProjects({ limit = 12, offset = 0, coversOnly = false, includeDetails = false } = {}) {
  const client = await requireClient();
  let query = publishedQuery(client, includeDetails ? PORTFOLIO_FIELDS : 'id,title,photos');
  if (coversOnly) query = query.neq('photos', '[]');
  const { data, error } = await query.order('published_at', { ascending: false })
    .order('id', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export function projectPhotoSlot(photo, index) {
  return photo.slot ?? index;
}

export function projectPhotos(project) {
  return [0, 1, 2].map(slot =>
    project.photos.find((photo, index) => projectPhotoSlot(photo, index) === slot)).filter(Boolean);
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
  const galleries = projects.map(project => ({ project, photos: projectPhotos(project) }));
  for (let index = 0; index < 3; index += 1) {
    for (const { project, photos } of galleries) {
      const photo = photos[index];
      if (photo) entries.push({ id: project.id, title: project.title, photo });
      if (entries.length === 3) return entries;
    }
  }
  return entries;
}
