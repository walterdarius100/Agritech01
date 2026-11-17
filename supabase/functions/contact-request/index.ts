// PREPARED, NOT DEPLOYED. CONTACT_ENABLED and email flags are false unless explicitly configured.
import { createContactHandler } from './handler.js';
import { createRpcDatabase, createEmailSender } from './adapters.js';
const env = (name: string) => (Deno.env.get(name) || '').trim();
const config = {
  enabled:env('CONTACT_ENABLED') === 'true',
  origins:env('CONTACT_ALLOWED_ORIGINS').split(',').map(s => s.trim()).filter(Boolean),
  hmacSecret:env('CONTACT_HMAC_SECRET'),
  emailEnabled:env('CONTACT_EMAIL_ENABLED') === 'true',
  providerVerified:env('EMAILJS_PROVIDER_VERIFIED') === 'true',
  connectedProvider:env('EMAILJS_CONNECTED_PROVIDER'),
  emailPublicKey:env('EMAILJS_PUBLIC_KEY'), emailPrivateKey:env('EMAILJS_PRIVATE_KEY'),
  serviceId:env('EMAILJS_SERVICE_ID'), templateId:env('EMAILJS_NOTIFICATION_TEMPLATE_ID'),
  replyTemplateId:env('EMAILJS_REPLY_TEMPLATE_ID'), replyVerified:env('EMAILJS_REPLY_VERIFIED') === 'true',
  linkedReplyDisabledVerified:env('EMAILJS_LINKED_REPLY_DISABLED_VERIFIED') === 'true',
  monthlyBudget:Number(env('CONTACT_MONTHLY_EMAIL_BUDGET'))
};
const url = env('SUPABASE_URL').replace(/\/$/, '');
const secret = env('SUPABASE_SERVICE_ROLE_KEY');
// Fail closed on missing server credentials, even when the public activation flag was set.
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !secret) config.enabled = false;
Deno.serve(createContactHandler({ config, db:createRpcDatabase({url,secret}), sendEmail:createEmailSender(config) }));
