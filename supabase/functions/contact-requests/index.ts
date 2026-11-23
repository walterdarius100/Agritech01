import { contactEmail, type Contact } from './emails.ts';
import { needs } from './needs.ts';

type Config = Record<string, string | undefined>;
type Job = {
  request_id: string;
  kind: 'admin_email' | 'receipt_email' | 'pipeline';
  lease_token: string;
  attempts: number;
  first_attempt_at: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const dossier = /^AGR-\d{4,}$/;
const encoder = new TextEncoder();

async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function matchesSecret(expected: string | undefined, actual: string) {
  if (!expected) return false;
  const [a, b] = await Promise.all([hmac(expected, expected), hmac(expected, actual)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const bytes = new Uint8Array(16384);
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > bytes.length) {
      void reader.cancel().catch(() => {});
      return null;
    }
    bytes.set(value, size);
    size += value.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)));
  } catch {
    return null;
  }
}

function validate(data: Record<string, unknown> | null) {
  if (!data || data.consent !== true || data.website !== '' || typeof data.id !== 'string' || !uuid.test(data.id)) return null;
  const field = (key: string, limit: number) => {
    const value = data[key];
    return typeof value === 'string' && value.length <= limit && !value.includes('\0') ? value.trim() : null;
  };
  const name = field('name', 120);
  const email = field('email', 254)?.toLowerCase();
  const phone = field('phone', 40);
  const need = field('need', 200);
  const message = field('message', 1200);
  if (!name || /[\r\n]/.test(name) || !email || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ||
      !phone || !/^\+?[\d ()-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, '')) ||
      !need || !Object.hasOwn(needs, need) || message === null) return null;
  const type = needs[need];
  if (type !== 'formation' && !message) return null;
  return { id: data.id, name, email, phone, need, type, message: type === 'formation' ? '' : message };
}

export function createContactHandler(config: Config, fetcher: typeof fetch = fetch) {
  const origins = (config.CONTACT_SITE_ORIGINS || 'https://agritech509ht.com').split(',').map(value => value.trim());
  const dbHeaders = {
    apikey: config.SUPABASE_SERVICE_ROLE_KEY || '',
    Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY || ''}`,
    'Content-Type': 'application/json'
  };

  async function database(path: string, args?: object) {
    const response = await fetcher(`${config.SUPABASE_URL}/rest/v1/${path}`, {
      headers: dbHeaders,
      method: args ? 'POST' : 'GET',
      body: args ? JSON.stringify(args) : undefined,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('database');
    if (response.status === 204) return null;
    return await response.json();
  }

  async function deliver(job: Job, contact: Contact) {
    if (job.kind === 'pipeline') {
      const endpoint = config.CONTACT_PIPELINE_URL;
      const secret = config.CONTACT_PIPELINE_SECRET;
      if (!endpoint || !secret) return { state: 'failed', error: 'pipeline_configuration' };
      const payload = JSON.stringify(contact);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = await hmac(secret, `v1\n${timestamp}\n${payload}`);
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, payload, signature }),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) return { state: 'pending', error: 'pipeline_http' };
      const result = await response.json();
      if (result.status === 'synced' && result.id === contact.id && dossier.test(result.dossierId) &&
          typeof result.possibleDuplicateId === 'string' &&
          (!result.possibleDuplicateId || dossier.test(result.possibleDuplicateId))) {
        return { state: 'done', result: { dossier_id: result.dossierId, possible_duplicate_id: result.possibleDuplicateId || null } };
      }
      return { state: 'pending', error: result.code === 'layout' ? 'pipeline_layout' : 'pipeline_ack' };
    }

    const to = job.kind === 'admin_email' ? config.CONTACT_ADMIN_EMAIL : contact.email;
    const resendKey = config.CONTACT_RESEND_API_KEY || config.RESEND_API_KEY;
    if (!resendKey || !config.CONTACT_FROM || !to) return { state: 'failed', error: 'email_configuration' };
    // Resend retains idempotency keys for 24 hours. Stop with a margin for dispatch.
    if (Date.now() - Date.parse(job.first_attempt_at) >= 23 * 3600000) {
      return { state: 'failed', error: 'email_idempotency_expired' };
    }
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `contact/${job.kind}/${contact.id}`
      },
      body: JSON.stringify({
        from: config.CONTACT_FROM, to,
        ...(job.kind === 'admin_email' ? { reply_to: contact.email } : {}),
        ...contactEmail(contact, job.kind === 'admin_email')
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      const retry = response.status >= 500 || [408, 409, 429].includes(response.status);
      return { state: retry ? 'pending' : 'failed', error: `resend_${response.status}` };
    }
    const result = await response.json();
    if (typeof result.id !== 'string' || !result.id) return { state: 'pending', error: 'resend_ack' };
    return { state: 'done', result: { resend_id: result.id } };
  }

  async function processJob(job: Job) {
    let outcome: { state: string; result?: object; error?: string };
    try {
      if (job.attempts > 6) {
        outcome = { state: 'failed', error: 'lease_attempts_exhausted' };
      } else {
        const [contact] = await database(`contact_requests?id=eq.${job.request_id}&select=id,name,email,phone,request_type,need,message,source,received_at`);
        if (!contact) throw new Error('missing_contact');
        outcome = await deliver(job, contact);
      }
    } catch {
      outcome = { state: 'pending', error: 'delivery_unconfirmed' };
    }
    await database('rpc/finish_contact_job', {
      p_id: job.request_id, p_kind: job.kind, p_lease: job.lease_token,
      p_state: outcome.state, p_error: outcome.error || null, p_result: outcome.result || null
    });
  }

  return async (request: Request) => {
    const origin = request.headers.get('Origin') || '';
    const allowed = origins.includes(origin) && origin !== '';
    const headers = new Headers({
      Vary: 'Origin',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type'
    });
    if (allowed) headers.set('Access-Control-Allow-Origin', origin);
    const reply = (code: number, status: string, id?: string) =>
      new Response(JSON.stringify({ status, ...(id ? { id } : {}) }), { status: code, headers });
    const worker = new URL(request.url).pathname.endsWith('/worker');
    if (request.method === 'OPTIONS' && allowed && !worker) return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, 'rejected');

    try {
      if (worker) {
        if (!await matchesSecret(config.CONTACT_WORKER_SECRET, request.headers.get('X-Contact-Worker') || '')) return reply(401, 'rejected');
        await database('rpc/prune_contact_rate', {});
        const jobs: Job[] = await database('rpc/claim_contact_jobs', {});
        const results = await Promise.allSettled(jobs.map(processJob));
        return results.some(result => result.status === 'rejected') ? reply(503, 'worker_incomplete') : reply(200, 'worker_complete');
      }
      if (!allowed || !request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return reply(400, 'rejected');
      const contact = validate(await readBody(request));
      if (!contact) return reply(400, 'rejected');

      const secret = config.CONTACT_RATE_SECRET;
      if (!secret) return reply(503, 'uncertain');
      // Only enable a header whose value is set and overwritten by the trusted ingress.
      const network = config.CONTACT_TRUSTED_IP_HEADER ? request.headers.get(config.CONTACT_TRUSTED_IP_HEADER) : null;
      const [emailHash, networkHash] = await Promise.all([
        hmac(secret, `email:${contact.email}`),
        network ? hmac(secret, `network:${network}`) : null
      ]);
      const outcome = await database('rpc/record_contact_request', {
        p_id: contact.id, p_name: contact.name, p_email: contact.email, p_phone: contact.phone,
        p_type: contact.type, p_need: contact.need, p_message: contact.message,
        p_email_hash: emailHash, p_network_hash: networkHash
      });
      if (outcome === 'recorded') return reply(200, 'recorded', contact.id);
      if (outcome === 'limited') return reply(429, 'rejected');
      if (outcome === 'conflict') return reply(409, 'uncertain');
      return reply(503, 'uncertain');
    } catch {
      return reply(503, 'uncertain');
    }
  };
}

if (typeof Deno !== 'undefined') Deno.serve(createContactHandler(Deno.env.toObject()));
