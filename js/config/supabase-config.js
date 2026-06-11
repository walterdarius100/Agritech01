// Configuration publique Supabase pour le frontend statique Agri-tech.
// Remplacez uniquement par l'URL du projet et la clé anon public / Publishable key.
// Ne jamais coller de service_role key, sb_secret_xxx, DATABASE_URL ou JWT_SECRET ici.
export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY';

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};
