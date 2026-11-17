import { createContactHandler } from './handler.js';
import { createRpcDatabase } from './adapters.js';
const env = (name: string) => (Deno.env.get(name) || '').trim();
const url = env('SUPABASE_URL').replace(/\/$/, '');
const secret = env('SUPABASE_SERVICE_ROLE_KEY');
const config = {
  enabled: env('CONTACT_ENABLED') === 'true' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && Boolean(secret),
  origins: env('CONTACT_ALLOWED_ORIGINS').split(',').map(s => s.trim()).filter(Boolean),
  hmacSecret: env('CONTACT_HMAC_SECRET')
};
Deno.serve(createContactHandler({ config, db: createRpcDatabase({ url, secret }) }));
