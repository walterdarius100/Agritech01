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

type RequestBody = { action?: unknown; email?: unknown; source?: unknown; consent?: unknown; token?: unknown };
type MailJob = {
  id: string;
  claim_id: string;
  subscriber_id: string;
  unsubscribe_nonce: string;
  email: string;
  source: 'article' | 'footer';
  subscribed_at: string;
  kind: 'admin' | 'welcome' | 'confirm';
  template_version?: 1 | 2 | 3 | 4;
};

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

const officialSite = 'https://agritech509ht.com/';
const logoUrl = officialSite + 'assets/images/logo-agritech.png';
const contact = 'contact@agritech509ht.com';

type EmailDetails =
  | { kind: 'admin'; email: string; source: 'article' | 'footer'; timestamp: string }
  | { kind: 'welcome'; unsubscribe: string };

function brandedEmail(title: string, content: string, footer: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f8f4ea;color:#14211b;font-family:Inter,'Segoe UI',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ea"><tr>
<td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
 style="width:100%;max-width:600px;text-align:left;background:#fff;border:1px solid #dfdfd4;border-radius:16px">
<tr><td bgcolor="#0f3d2e" style="padding:18px 22px;border-radius:15px 15px 0 0;border-bottom:4px solid #f2b84b;color:#fff">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px"><img src="${logoUrl}" width="53" height="40" alt="" style="display:block;border:0"></td>
<td style="font-size:21px;font-weight:700;color:#fff">Agri-tech</td></tr></table>
</td></tr>
<tr><td style="padding:25px 22px;font-size:16px;line-height:1.6">
<h1 style="margin:0 0 18px;color:#0f3d2e;font-size:27px;line-height:1.2">${escapeHtml(title.replace('Agri-tech', 'Agri‑tech'))}</h1>
${content}
</td></tr>
<tr><td bgcolor="#e8f5ee" style="padding:16px 22px;border-radius:0 0 15px 15px;color:#14211b;font-size:14px;line-height:1.6">
<strong>Agri-tech</strong> · <a href="${officialSite}" style="color:#0f3d2e;text-decoration:underline">agritech509ht.com</a>
${footer}
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

function renderNewsletterEmailV2(details: EmailDetails) {
  if (details.kind === 'admin') {
    const subject = 'Nouvel abonné à la newsletter — Agri-tech';
    const date = new Intl.DateTimeFormat('fr', {
      dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Port-au-Prince'
    }).format(new Date(details.timestamp)) + ' (heure de Port-au-Prince)';
    const source = details.source === 'footer' ? 'Pied de page (footer)' : 'Article';
    const rows = [
      ['Adresse e-mail', details.email], ['Date et heure', date], ['Source', source],
      ['Statut à l’inscription', 'Actif']
    ];
    const summary = 'L’inscription a bien été enregistrée dans Supabase.';
    const table = rows.map(([label, value]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #dfdfd4">
<strong style="color:#0f3d2e">${escapeHtml(label)}</strong><br>
<span style="overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</span></td></tr>`).join('');
    return {
      subject,
      text: `Nouvelle inscription à la newsletter\n\n${summary}\n\n${rows.map(([label, value]) => `${label} : ${value}`).join('\n')}\n\nAgri-tech · ${officialSite}`,
      html: brandedEmail('Nouvelle inscription à la newsletter',
        `<p style="margin:0 0 16px">${summary}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;background:#f8f4ea">${table}</table>`, '')
    };
  }

  const subject = 'Bienvenue dans la communauté Agri-tech !';
  const introduction = 'Merci de vous être inscrit à la newsletter Agri-tech. Votre demande a bien été reçue et votre adresse est inscrite.';
  const topics = 'Vous recevrez nos nouveaux articles, conseils agricoles, informations sur nos formations et opportunités. Nous vous écrirons à une cadence raisonnable.';
  const footerText = 'Si vous n’êtes pas à l’origine de cette inscription, vous pouvez vous désinscrire ou nous écrire.';
  return {
    subject,
    text: `Bonjour,\n\n${introduction}\n\n${topics}\n\nDécouvrir Agri-tech : ${officialSite}\n\nL’équipe Agri-tech\n\n${footerText}\nMe désinscrire : ${details.unsubscribe}\n${contact}`,
    html: brandedEmail(subject, `<p style="margin:0 0 14px">Bonjour,</p>
<p style="margin:0 0 14px">${introduction}</p><p style="margin:0 0 20px">${topics}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#0f3d2e" style="border-radius:8px">
<a href="${officialSite}" style="display:inline-block;padding:12px 17px;color:#fff;text-decoration:none;font-weight:700">Découvrir Agri-tech</a>
</td></tr></table><p style="margin:20px 0 0">L’équipe Agri-tech</p>`,
      `<p style="margin:10px 0 0">${footerText}<br>
<a href="${escapeHtml(details.unsubscribe)}" style="color:#0f3d2e;text-decoration:underline">Me désinscrire</a> ·
<a href="mailto:${contact}" style="color:#0f3d2e;text-decoration:underline">${contact}</a></p>`)
  };
}

function simpleEmail(title: string, content: string, footer = '', head = '') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>${head}</head>
<body style="margin:0;background:#f6f7f5;color:#14211b;font-family:Arial,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f5"><tr>
<td align="center" style="padding:24px 10px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;text-align:left;border-radius:14px">
<tr><td bgcolor="#0f3d2e" style="padding:23px 24px;border-radius:14px 14px 0 0">
<h1 style="margin:0;color:#fff;font-size:26px;line-height:1.25">${escapeHtml(title)}</h1>
</td></tr>
<tr><td style="padding:24px;color:#14211b;font-size:16px;line-height:1.6">${content}</td></tr>
${footer}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

function renderNewsletterEmailV3(details: EmailDetails) {
  if (details.kind === 'admin') {
    const title = 'Nouvelle inscription à la newsletter';
    const intro = 'Une nouvelle adresse e-mail vient de s’inscrire à la newsletter Agri-tech.';
    const date = new Intl.DateTimeFormat('fr', {
      dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Port-au-Prince'
    }).format(new Date(details.timestamp)) + ' (heure de Port-au-Prince)';
    const rows = [
      ['Adresse e-mail', details.email], ['Date', date],
      ['Source', details.source === 'footer' ? 'Footer' : 'Article'], ['Statut', 'Actif']
    ];
    const table = rows.map(([label, value]) => `<tr>
<th scope="row" width="34%" align="left" valign="top" style="width:34%;padding:10px 8px 10px 0;border-bottom:1px solid #e5ebe7;line-height:1.45">${escapeHtml(label)} :</th>
<td valign="top" style="padding:10px 0;border-bottom:1px solid #e5ebe7;line-height:1.45;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</td>
</tr>`).join('');
    return {
      subject: 'Nouvel abonné à la newsletter — Agri-tech',
      text: `${title}\n\n${intro}\n\n${rows.map(([label, value]) => `${label} : ${value}`).join('\n')}`,
      html: simpleEmail(title, `<p style="margin:0 0 16px">${intro}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;font-size:15px">${table}</table>`)
    };
  }

  const subject = 'Bienvenue dans la communauté Agri-tech !';
  const paragraphs = [
    'Bonjour,',
    'Merci de vous être inscrit à la newsletter Agri-tech !',
    'Nous avons bien reçu votre demande d’inscription. Vous recevrez nos nouveaux articles, conseils agricoles, informations sur nos formations et opportunités directement dans votre boîte e-mail.',
    'Nous veillerons à vous transmettre des informations utiles à une fréquence raisonnable.',
    'Bienvenue parmi nous !'
  ];
  return {
    subject,
    text: `${paragraphs.join('\n\n')}\n\nSe désinscrire : ${details.unsubscribe}`,
    html: simpleEmail(subject,
      paragraphs.map((paragraph, index) => `<p style="margin:0 0 ${index === paragraphs.length - 1 ? 0 : 14}px">${paragraph}</p>`).join(''),
      `<tr><td style="padding:14px 24px;border-top:1px solid #e5ebe7;font-size:13px;line-height:1.5">
<a href="${escapeHtml(details.unsubscribe)}" style="color:#0f3d2e;text-decoration:underline">Se désinscrire</a>
</td></tr>`)
  };
}

export function renderNewsletterEmail(details: EmailDetails) {
  if (details.kind === 'admin') return renderNewsletterEmailV3(details);

  const subject = 'Bienvenue chez Agri-tech !';
  const paragraphs = [
    'Bonjour,',
    'Merci pour votre inscription à la newsletter Agri-tech.',
    'Vous recevrez désormais nos articles, conseils pratiques, actualités agricoles et informations sur nos formations.',
    'Notre objectif est de partager avec vous des informations utiles, accessibles et adaptées aux réalités agricoles en Haïti.',
    'À bientôt,'
  ];
  const name = 'Walter Darius';
  const role = "Directeur général d'Agri-tech";
  const footer = 'Vous avez reçu cet e-mail parce que vous êtes abonné à la newsletter Agri-tech.';
  const content = paragraphs.map(paragraph => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`).join('');
  return {
    subject,
    text: `${paragraphs.join('\n\n')}\n\n${name}\n${role}\n\n---\n\n${footer}\n\nSe désinscrire : ${details.unsubscribe}`,
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title>
<style>.welcome-unsubscribe:focus{outline:none;text-decoration-thickness:3px!important}</style></head>
<body style="margin:0;padding:0;background:#f6f7f5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f6f7f5" style="background:#f6f7f5">
<tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-radius:8px;border-collapse:separate;font-family:Arial,sans-serif;text-align:left">
<tr><td bgcolor="#0f3d2e" style="background:#0f3d2e;border-radius:8px 8px 0 0;padding:20px 24px;color:#ffffff;font-size:22px;font-weight:bold">Agri-tech</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 8px 8px;padding:24px;color:#162f26;font-size:16px;line-height:1.6">
<h1 style="margin:0 0 20px;color:#0f3d2e;font-size:26px;line-height:1.25">${escapeHtml(subject)}</h1>
${content}
<p style="margin:0"><strong style="color:#0f3d2e">${escapeHtml(name)}</strong><br><em>${escapeHtml(role)}</em></p>
<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #dce4df;color:#5b6962;font-size:13px;line-height:1.5"><em>${escapeHtml(footer)}</em></p>
<p style="margin:6px 0 0;font-size:13px;line-height:1.5"><a class="welcome-unsubscribe" href="${escapeHtml(details.unsubscribe)}" style="color:#0f3d2e;font-weight:bold;text-decoration:underline;text-underline-offset:2px">Se désinscrire</a></p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
  };
}

export function createNewsletterHandler(config: NewsletterConfig, fetcher = fetch) {
  const origin = config.siteUrl ? new URL(config.siteUrl).origin : null;
  const { databaseUrl = '', databaseKey = '' } = config;
  let key: Promise<CryptoKey> | undefined;
  const signingKey = () => key ??= crypto.subtle.importKey(
    'raw', encoder.encode(config.linkSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );

  async function unsubscribeLink(id: string, nonce: string) {
    const signature = await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode(`unsubscribe:${id}:${nonce}`));
    const url = new URL('/newsletter/', origin ?? undefined);
    url.hash = `unsubscribe=${id}.${nonce}.${hex(signature)}`;
    return url.href;
  }

  async function verifyLink(token: unknown) {
    const match = typeof token === 'string' && tokenPattern.exec(token);
    if (!match) return null;
    const [, id, nonce, signature] = match;
    const bytes = Uint8Array.from(signature.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
    const valid = await crypto.subtle.verify('HMAC', await signingKey(), bytes, encoder.encode(`unsubscribe:${id}:${nonce}`));
    return valid ? { p_action: 'unsubscribe', p_id: id, p_nonce: nonce } : null;
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

  async function legacyMail(job: MailJob) {
    const from = config.from;
    if (job.kind === 'admin') {
      return {
        from, to: [config.admin], subject: 'Nouvelle demande newsletter Agri-tech',
        text: `Adresse : ${job.email}\nDate (UTC) : ${new Date(job.subscribed_at).toISOString()}\nSource : ${job.source}\nStatut à l’enregistrement : en attente de confirmation.`
      };
    }

    const unsubscribe = await unsubscribeLink(job.subscriber_id, job.unsubscribe_nonce);
    const title = 'Bienvenue chez Agri-tech';
    const introduction = 'Merci pour votre inscription à la newsletter Agri-tech. Retrouvez nos conseils agricoles, nouveaux articles, formations et opportunités.';
    const target = origin ?? '';
    const label = 'Visiter Agri-tech';
    const unsubscribeLabel = 'Me désinscrire';
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
    if (job.kind === 'confirm') return { p_result: 'failed', p_provider: null, p_error: 'legacy_opt_in_retired' };

    // Keep the old payload for legacy retries so the existing Resend key still matches.
    const render = job.template_version === 2 ? renderNewsletterEmailV2
      : job.template_version === 3 ? renderNewsletterEmailV3 : renderNewsletterEmail;
    const message = !job.template_version || job.template_version === 1
      ? await legacyMail(job)
      : {
        from: config.from,
        to: [job.kind === 'admin' ? config.admin : job.email],
        ...render(job.kind === 'admin'
          ? { kind: 'admin', email: job.email, source: job.source, timestamp: job.subscribed_at }
          : { kind: 'welcome', unsubscribe: await unsubscribeLink(job.subscriber_id, job.unsubscribe_nonce) })
      };
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
        if (body.source === 'article' && body.consent !== true) return json(400, 'consent_required');
        const outcome = await rpc('request_newsletter', {
          p_email: email, p_source: body.source, ...(body.consent === true ? { p_consent: true } : {})
        });
        if (outcome === 'received') return json(202, 'received');
        if (outcome === 'limited') return json(429, 'limited');
        if (outcome === 'invalid') return json(400, 'invalid');
      } else if (body?.action === 'unsubscribe') {
        const payload = await verifyLink(body.token);
        if (!payload) return json(400, 'invalid_link');
        const outcome = await rpc('apply_newsletter_link', payload);
        if (outcome === 'unsubscribed') return json(200, outcome);
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
