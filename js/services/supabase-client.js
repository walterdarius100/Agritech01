import { SUPABASE_CONFIG } from '../config/supabase-config.js';

const PLACEHOLDER_VALUES = new Set([
  '',
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY',
]);

let supabaseClient = null;
let supabaseModulePromise = null;

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_CONFIG?.url
      && SUPABASE_CONFIG?.anonKey
      && !PLACEHOLDER_VALUES.has(SUPABASE_CONFIG.url)
      && !PLACEHOLDER_VALUES.has(SUPABASE_CONFIG.anonKey)
  );
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase n’est pas encore configuré.');
  }

  if (supabaseClient) return supabaseClient;

  if (!supabaseModulePromise) {
    supabaseModulePromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  }

  const { createClient } = await supabaseModulePromise;
  supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}
