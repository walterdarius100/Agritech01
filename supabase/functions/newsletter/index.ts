import { createNewsletterHandler } from './handler.mjs';

Deno.serve(createNewsletterHandler({
  databaseUrl: Deno.env.get('SUPABASE_URL'),
  databaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  siteUrl: Deno.env.get('NEWSLETTER_SITE_URL'),
  linkSecret: Deno.env.get('NEWSLETTER_LINK_SECRET'),
  workerSecret: Deno.env.get('NEWSLETTER_WORKER_SECRET'),
  resendKey: Deno.env.get('RESEND_API_KEY'),
  from: Deno.env.get('NEWSLETTER_FROM'),
  admin: Deno.env.get('NEWSLETTER_ADMIN')
}));
