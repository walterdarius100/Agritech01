type NewsletterConfig = {
  databaseUrl?: string;
  databaseKey?: string;
  siteUrl?: string;
  linkSecret?: string;
  workerSecret?: string;
  resendKey?: string;
  from?: string;
  admin?: string;
};

type LinkAction = 'confirm' | 'unsubscribe';
type RequestBody = { action?: unknown; email?: unknown; source?: unknown; token?: unknown };
type MailJob = {
  id: string;
  claim_id: string;
  subscriber_id: string;
  unsubscribe_nonce: string;
  email: string;
  source: 'article' | 'footer';
  subscribed_at: string;
} & ({ kind: 'confirm'; nonce: string } | { kind: 'admin' | 'welcome'; nonce: null });

const encoder = new TextEncoder();
const uuidPattern = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const tokenPattern = new RegExp(`^(${uuidPattern})\\.(${uuidPattern})\\.([a-f0-9]{64})$`);
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return value.replace(/[&<>"']/g, char => entities[char]);
}

async function readBody(request: Request): Promise<RequestBody | null> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !request.body) {
    return null;
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      void reader.cancel().catch(() => {});
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

export function createNewsletterHandler(config: NewsletterConfig, fetcher = fetch) {
  const origin = config.siteUrl ? new URL(config.siteUrl).origin : null;
  const { databaseUrl = '', databaseKey = '' } = config;
  let key: Promise<CryptoKey> | undefined;
  const signingKey = () => key ??= crypto.subtle.importKey(
    'raw', encoder.encode(config.linkSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );

  async function link(action: LinkAction, id: string, nonce: string) {
    const signature = await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode(`${action}:${id}:${nonce}`));
    const url = new URL('/newsletter/', origin ?? undefined);
    url.hash = `${action}=${id}.${nonce}.${hex(signature)}`;
    return url.href;
  }

  async function verifyLink(action: LinkAction, token: unknown) {
    const match = typeof token === 'string' && tokenPattern.exec(token);
    if (!match) return null;
    const [, id, nonce, signature] = match;
    const bytes = Uint8Array.from(signature.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
    const valid = await crypto.subtle.verify('HMAC', await signingKey(), bytes, encoder.encode(`${action}:${id}:${nonce}`));
    return valid ? { p_action: action, p_id: id, p_nonce: nonce } : null;
  }

  async function rpc<T = unknown>(name: string, payload: object = {}): Promise<T> {
    const headers: Record<string, string> = { apikey: databaseKey, 'Content-Type': 'application/json' };
    if (databaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${databaseKey}`;
    const response = await fetcher(`${databaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3500)
    });
    if (!response.ok) throw new Error('database_unavailable');
    return response.json();
  }

  async function mail(job: MailJob) {
    const from = config.from;
    if (job.kind === 'admin') {
      return {
        from, to: [config.admin], subject: 'Nouvelle demande newsletter Agri-tech',
        text: `Adresse : ${job.email}\nDate (UTC) : ${new Date(job.subscribed_at).toISOString()}\nSource : ${job.source}\nStatut à l’enregistrement : en attente de confirmation.`
      };
    }

    const unsubscribe = await link('unsubscribe', job.subscriber_id, job.unsubscribe_nonce);
    const confirmation = job.kind === 'confirm' ? await link('confirm', job.subscriber_id, job.nonce) : null;
    const title = confirmation ? 'Confirmez votre inscription' : 'Bienvenue chez Agri-tech';
    const introduction = confirmation
      ? 'Une demande d’inscription à la newsletter Agri-tech a été reçue pour cette adresse. Le lien expire 24 heures après la demande. Si vous n’êtes pas à l’origine de la demande, vous pouvez ignorer ce message.'
      : 'Merci pour votre inscription à la newsletter Agri-tech. Retrouvez nos conseils agricoles, nouveaux articles, formations et opportunités.';
    const target = confirmation || (origin ?? '');
    const label = confirmation ? 'Confirmer mon inscription' : 'Visiter Agri-tech';
    const unsubscribeLabel = confirmation ? 'Annuler la demande' : 'Me désinscrire';
    return {
      from, to: [job.email], subject: `${title} · Agri-tech`,
      text: `${introduction}\n\n${label} : ${target}\n\n${unsubscribeLabel} : ${unsubscribe}\nVous pouvez aussi écrire à contact@agritech509ht.com.`,
      html: `<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width, initial-scale=1">
        <body style="margin:0;background:#f6f2e8;color:#0f3d2e;font-family:Arial,sans-serif">
        <div style="max-width:560px;margin:auto;padding:24px"><h1 style="font-size:26px">${title}</h1>
        <p style="line-height:1.6">${introduction}</p>
        <p><a href="${escapeHtml(target)}" style="display:inline-block;background:#0f3d2e;color:#fff;padding:13px 18px;border-radius:6px">${label}</a></p>
        <p style="margin-top:24px;line-height:1.6"><a style="color:#0f3d2e" href="${escapeHtml(unsubscribe)}">${unsubscribeLabel}</a>
        ou écrivez à <a style="color:#0f3d2e" href="mailto:contact@agritech509ht.com">contact@agritech509ht.com</a>.</p></div></body></html>`
    };
  }

  async function send(job: MailJob) {
    const message = await mail(job);
    try {
      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `newsletter/${job.id}`
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const { id } = await response.json();
        if (typeof id === 'string' && id) return { p_result: 'accepted', p_provider: id, p_error: null };
        throw new Error('missing_provider_id');
      }
      const retryable = response.status === 429 || response.status >= 500;
      return { p_result: retryable ? 'retry' : 'failed', p_provider: null, p_error: `provider_${response.status}` };
    } catch {
      return { p_result: 'retry', p_provider: null, p_error: 'provider_response_unknown' };
    }
  }

  async function processMail() {
    let processed = 0;
    // Keep the invocation bounded. Cron picks up remaining work on its next run.
    const deadline = Date.now() + 30_000;
    while (processed < 8 && Date.now() < deadline) {
      const job = await rpc<MailJob | null>('claim_newsletter_mail');
      if (!job) break;
      const result = await send(job);
      await rpc('finish_newsletter_mail', { p_id: job.id, p_claim: job.claim_id, ...result });
      processed++;
    }
    return processed;
  }

  return async function handle(request: Request) {
    const worker = new URL(request.url).pathname.endsWith('/process');
    const requestOrigin = request.headers.get('origin');
    const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
    const json = (status: number, outcome: string) => Response.json({ outcome }, { status, headers });

    if (worker) {
      if (request.method !== 'POST' || (config.workerSecret?.length ?? 0) < 32 ||
          request.headers.get('X-Newsletter-Worker-Token') !== config.workerSecret) return json(404, 'not_found');
    } else {
      if (!origin || requestOrigin !== origin) return json(403, 'forbidden');
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') return json(405, 'method_not_allowed');
    }

    if (!origin || !databaseUrl || !databaseKey || !config.linkSecret || config.linkSecret.length < 32) {
      return json(503, 'unavailable');
    }

    try {
      if (worker) {
        if (!config.resendKey || !config.from || !config.admin) return json(503, 'unavailable');
        const processed = await processMail();
        return Response.json({ processed }, { headers });
      }

      const body = await readBody(request).catch(() => null);
      if (body?.action === 'subscribe') {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email.length > 254 || !emailPattern.test(email) || (body.source !== 'article' && body.source !== 'footer')) {
          return json(400, 'invalid');
        }
        const outcome = await rpc('request_newsletter', { p_email: email, p_source: body.source });
        if (outcome === 'received') return json(202, 'received');
        if (outcome === 'limited') return json(429, 'limited');
        if (outcome === 'invalid') return json(400, 'invalid');
      } else if (body?.action === 'confirm' || body?.action === 'unsubscribe') {
        const payload = await verifyLink(body.action, body.token);
        if (!payload) return json(400, 'invalid_link');
        const outcome = await rpc('apply_newsletter_link', payload);
        if (outcome === 'confirmed' && body.action === 'confirm') return json(200, outcome);
        if (outcome === 'unsubscribed' && body.action === 'unsubscribe') return json(200, outcome);
        if (outcome === 'invalid_link') return json(400, outcome);
      } else {
        return json(400, 'invalid');
      }
    } catch {
      // Logs contain neither addresses nor tokens nor provider response bodies.
      console.error('[newsletter] operation unavailable');
    }
    return json(503, 'unavailable');
  };
}

// Supabase loads this module in Deno. Node tests import the same handler with a fake transport.
if (typeof Deno !== 'undefined') {
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
}
