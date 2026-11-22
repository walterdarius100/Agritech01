import { SUPABASE_URL } from './supabase-config.js';

// Set both values in a separate static copy for staging. These values are public.
export const NEWSLETTER_SITE_ORIGIN = 'https://agritech509ht.com';
export const NEWSLETTER_API_URL = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/newsletter`;
