// Configuration publique Supabase pour le frontend statique Agri-tech.
// Remplacez ces placeholders par les valeurs du projet Supabase :
// - URL du projet : https://xxxxx.supabase.co
// - clé Publishable (sb_publishable_...) ou ancienne clé anon public.
// N'utilisez jamais de clé secrète, service_role, DATABASE_URL ou JWT_SECRET ici.

export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY';

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};
