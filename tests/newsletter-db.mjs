import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createNewsletterHandler } from '../supabase/functions/newsletter/index.ts';

const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const preview = require('../api/newsletter.js');
const db = new PGlite();
const origin = 'https://agritech.example';
const endpoint = 'https://edge.example/functions/v1/newsletter';
const config = {
  siteUrl: origin, databaseUrl: 'https://db.example', databaseKey: 'eyJ-test-legacy-key',
  linkSecret: 'test-long-link-key-000000000000000000', workerSecret: 'test-worker-key-000000000000000000',
  resendKey: 'test-resend-key', from: 'Agri-tech <newsletter@agritech.example>', admin: 'admin@agritech.example'
};

const providerCalls = [];
const providerAccepted = new Map();
const failOnce = new Set();
let loseWelcomeResponse = false;
let databaseDown = false;
let rpcCalls = 0;

async function transport(url, request) {
  const payload = JSON.parse(request.body);
  if (url === 'https://api.resend.com/emails') {
    const key = request.headers['Idempotency-Key'];
    assert.ok(key.startsWith('newsletter/'));
    assert.equal(request.headers.Authorization, 'Bearer test-resend-key');
    const kind = payload.subject.startsWith('Nouvel') ? 'admin' : 'welcome';
    providerCalls.push({ key, kind, payload });
    if (failOnce.delete(kind)) return new Response(null, { status: 503 });
    if (providerAccepted.has(key)) assert.deepEqual(providerAccepted.get(key), payload);
    providerAccepted.set(key, payload);
    if (kind === 'welcome' && loseWelcomeResponse) {
      loseWelcomeResponse = false;
      throw new Error('Simulate losing the HTTP response after provider acceptance');
    }
    return Response.json({ id: key });
  }

  rpcCalls++;
  if (databaseDown) return new Response(null, { status: 503 });
  assert.equal(request.headers.apikey, config.databaseKey);
  assert.equal(request.headers.Authorization, `Bearer ${config.databaseKey}`);
  const name = new URL(url).pathname.split('/').at(-1);
  assert.ok(['request_newsletter', 'apply_newsletter_link', 'claim_newsletter_mail', 'finish_newsletter_mail'].includes(name));
  const args = Object.values(payload);
  const query = `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(', ')}) as outcome`;
  return Response.json((await db.query(query, args)).rows[0].outcome);
}

const handler = createNewsletterHandler(config, transport);

async function submit(payload, headers = {}) {
  const response = await handler(new Request(endpoint, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload)
  }));
  return [response.status, (await response.json()).outcome];
}

function subscribe(email, source = 'footer') {
  return submit({ action: 'subscribe', email, source, ...(source === 'article' ? { consent: true } : {}) });
}

function processMail(secret = config.workerSecret) {
  return handler(new Request(endpoint + '/process', {
    method: 'POST', headers: { 'X-Newsletter-Worker-Token': secret }
  }));
}

async function select(statement) {
  return (await db.query(statement)).rows;
}

function tokenFrom(kind, action) {
  const text = providerCalls.find(call => call.kind === kind).payload.text;
  const href = text.match(new RegExp(`https://[^\\s]+#${action}=[^\\s]+`))[0];
  return new URLSearchParams(new URL(href).hash.slice(1)).get(action);
}

try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for (const file of ['202611210001_newsletter_subscribers.sql', '202611220001_newsletter_double_opt_in.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`
    select public.request_newsletter('ancienne@example.org', 'article');
    insert into public.newsletter_subscribers (email, source, status) values ('ancien-actif@example.org', 'article', 'active');
    insert into public.newsletter_mail (subscriber_id, kind)
      select id, 'welcome' from public.newsletter_subscribers where email = 'ancien-actif@example.org';
    update public.newsletter_mail set status = 'accepted' where kind = 'admin';
  `);
  const [legacy] = await select("select id, confirmation_nonce, unsubscribe_nonce from public.newsletter_subscribers where email = 'ancienne@example.org'");
  await db.exec(await readFile(new URL('../supabase/migrations/202611220002_newsletter_direct_opt_in.sql', import.meta.url), 'utf8'));
  await db.exec("select public.request_newsletter('v2@example.org', 'footer', true);");
  await db.exec(await readFile(new URL('../supabase/migrations/202611220003_newsletter_footer_and_templates.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611220004_newsletter_welcome_signature.sql', import.meta.url), 'utf8'));
  await db.exec('set role service_role;');

  const cors = await handler(new Request(endpoint, { method: 'OPTIONS', headers: { Origin: origin } }));
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await handler(new Request(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example' } }))).status, 403);
  assert.equal((await handler(new Request(endpoint, { headers: { Origin: origin } }))).status, 405);
  assert.equal((await processMail('wrong')).status, 404);
  assert.equal(rpcCalls, 0);
  assert.deepEqual(await subscribe('invalid'), [400, 'invalid']);
  assert.deepEqual(await subscribe('valid@example.org', 'contact'), [400, 'invalid']);
  assert.deepEqual(await subscribe('a'.repeat(2200) + '@example.org'), [400, 'invalid']);
  assert.deepEqual(await submit({ action: 'subscribe', source: 'article', email: 'valid@example.org' }), [400, 'consent_required']);

  function legacyToken(action, nonce) {
    const signature = createHmac('sha256', config.linkSecret).update(`${action}:${legacy.id}:${nonce}`).digest('hex');
    return `${legacy.id}.${nonce}.${signature}`;
  }
  assert.deepEqual(await select("select status, consented_at, confirmation_nonce from public.newsletter_subscribers where email = 'ancienne@example.org'"),
    [{ status: 'pending', consented_at: null, confirmation_nonce: null }]);
  assert.deepEqual(await select("select kind, status from public.newsletter_mail where subscriber_id = (select id from public.newsletter_subscribers where email = 'ancienne@example.org') order by kind"),
    [{ kind: 'admin', status: 'accepted' }, { kind: 'confirm', status: 'cancelled' }]);
  assert.deepEqual(await submit({ action: 'confirm', token: legacyToken('confirm', legacy.confirmation_nonce) }), [400, 'invalid']);
  assert.equal((await processMail()).status, 200);
  assert.equal(providerCalls.length, 3);
  assert.equal(providerCalls.find(call => call.payload.to[0] === 'ancien-actif@example.org').payload.subject,
    'Bienvenue chez Agri-tech · Agri-tech');
  assert.match(providerCalls.find(call => call.payload.to[0] === 'v2@example.org').payload.html, /logo-agritech\.png/);
  assert.deepEqual(await subscribe('ancienne@example.org'), [202, 'received']);
  assert.deepEqual(await select("select status, source, consent_source, consent_version from public.newsletter_subscribers where email = 'ancienne@example.org'"),
    [{ status: 'active', source: 'article', consent_source: 'footer', consent_version: 'newsletter-footer-submit-v1' }]);
  assert.deepEqual(await submit({ action: 'unsubscribe', token: legacyToken('unsubscribe', legacy.unsubscribe_nonce) }), [200, 'unsubscribed']);

  databaseDown = true;
  assert.deepEqual(await subscribe('valid@example.org'), [503, 'unavailable']);
  databaseDown = false;
  assert.deepEqual(await Promise.all([
    subscribe(' WALTer@Example.org ', 'article'), subscribe('walter@example.org')
  ]), [[202, 'received'], [202, 'received']]);
  const subscribers = await select("select email, source, status, consent_version, consented_at from public.newsletter_subscribers where email = 'walter@example.org'");
  assert.equal(subscribers.length, 1);
  assert.ok(['article', 'footer'].includes(subscribers[0].source));
  assert.equal(subscribers[0].status, 'active');
  assert.equal(subscribers[0].consent_version, subscribers[0].source === 'article'
    ? 'newsletter-direct-v1' : 'newsletter-footer-submit-v1');
  assert.ok(subscribers[0].consented_at);
  const messages = "from public.newsletter_mail where subscriber_id = (select id from public.newsletter_subscribers where email = 'walter@example.org')";
  assert.deepEqual(await select(`select kind, status ${messages} order by kind`),
    [{ kind: 'admin', status: 'queued' }, { kind: 'welcome', status: 'queued' }]);

  // Keep the transition fixture separate while exercising the new signup retries.
  await db.exec("update public.newsletter_mail set next_at = now() + interval '1 day' where subscriber_id = (select id from public.newsletter_subscribers where email = 'ancienne@example.org') and template_version = 4;");
  providerCalls.length = 0;
  failOnce.add('admin');
  loseWelcomeResponse = true;
  assert.equal((await processMail()).status, 200);
  assert.equal(providerCalls.length, 2);
  assert.deepEqual(await select(`select distinct status ${messages}`), [{ status: 'queued' }]);
  const unsubscribe = tokenFrom('welcome', 'unsubscribe');
  const wrongSignature = unsubscribe.slice(0, -1) + (unsubscribe.endsWith('0') ? '1' : '0');
  assert.deepEqual(await submit({ action: 'unsubscribe', token: wrongSignature }), [400, 'invalid_link']);
  assert.equal((await select("select status from public.newsletter_subscribers where email = 'walter@example.org'"))[0].status, 'active');
  // Force only this subscriber’s tasks due, leaving the transition fixture untouched.
  await db.exec(`update public.newsletter_mail set next_at = now() where status = 'queued' and subscriber_id = (select id from public.newsletter_subscribers where email = 'walter@example.org');`);
  assert.equal((await processMail()).status, 200);
  assert.equal(providerCalls.filter(call => call.kind === 'welcome').length, 2);
  assert.equal(providerCalls.filter(call => call.kind === 'welcome')[0].key, providerCalls.filter(call => call.kind === 'welcome')[1].key);
  assert.equal(providerCalls.filter(call => call.kind === 'admin')[0].key, providerCalls.filter(call => call.kind === 'admin')[1].key);
  const admin = providerCalls.find(call => call.kind === 'admin').payload;
  assert.deepEqual(admin.to, [config.admin]);
  assert.match(admin.text, /vient de s’inscrire/);
  assert.match(admin.text, /Statut : Actif/);
  const welcome = providerCalls.find(call => call.kind === 'welcome').payload;
  assert.equal(welcome.subject, 'Bienvenue chez Agri-tech !');
  assert.doesNotMatch(welcome.html, /<img|Découvrir Agri-tech|mailto:/);
  const unsubscribeUrl = `${origin}/newsletter/#unsubscribe=${unsubscribe}`;
  assert.ok(welcome.html.includes(`href="${unsubscribeUrl}"`));
  assert.equal(welcome.text, [
    'Bonjour,',
    'Merci pour votre inscription à la newsletter Agri-tech.',
    'Vous recevrez désormais nos articles, conseils pratiques, actualités agricoles et informations sur nos formations.',
    'Notre objectif est de partager avec vous des informations utiles, accessibles et adaptées aux réalités agricoles en Haïti.',
    'À bientôt,',
    "Walter Darius\nDirecteur général d'Agri-tech",
    '---',
    'Vous avez reçu cet e-mail parce que vous êtes abonné à la newsletter Agri-tech.',
    `Se désinscrire : ${unsubscribeUrl}`
  ].join('\n\n'));
  assert.doesNotMatch(welcome.html, /Confirmer mon inscription|#confirm=/);
  assert.equal((await select(`select id ${messages} and status = 'accepted' and provider_id is not null`)).length, 2);
  assert.equal(providerAccepted.size, 5); // Two new messages plus three historical sends.

  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await submit({ action: 'unsubscribe', token: unsubscribe }), [200, 'unsubscribed']);
  }
  assert.deepEqual(await subscribe('walter@example.org'), [202, 'received']);
  assert.deepEqual(await select("select status from public.newsletter_subscribers where email = 'walter@example.org'"), [{ status: 'unsubscribed' }]);
  assert.equal((await select(`select id ${messages}`)).length, 2);

  assert.deepEqual(await subscribe('autre@example.org'), [202, 'received']);
  await db.exec("update public.newsletter_mail set first_attempt_at = now() - interval '21 hours' where status = 'queued' and next_at <= now();");
  const calls = providerCalls.length;
  assert.equal((await processMail()).status, 200);
  assert.equal(providerCalls.length, calls);
  assert.equal((await select("select id from public.newsletter_mail where last_error = 'retry_window_or_attempt_limit'")).length, 2);
  await db.exec("update public.newsletter_request_limits set attempts = 60 where bucket = 'daily';");
  assert.deepEqual(await subscribe('nouveau@example.org'), [429, 'limited']);
  await db.exec("update public.newsletter_request_limits set attempts = 30 where bucket = 'global';");
  await db.exec("update public.newsletter_request_limits set attempts = 5 where bucket = 'daily';");
  assert.deepEqual(await subscribe('nouveau@example.org'), [429, 'limited']);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role};`);
    for (const sql of [
      'select email from public.newsletter_subscribers',
      'select provider_id from public.newsletter_mail',
      'select bucket from public.newsletter_request_limits',
      "update public.newsletter_subscribers set status = 'active'",
      "select public.request_newsletter('test@example.org','footer',true)",
      "select public.apply_newsletter_link('confirm', gen_random_uuid(), gen_random_uuid())",
      'select public.claim_newsletter_mail()'
    ]) await assert.rejects(db.query(sql), /permission denied/);
  }

  for (const environment of ['production', 'preview', 'development']) {
    process.env.VERCEL_ENV = environment;
    for (const method of ['GET', 'POST']) {
      let status;
      await preview({ method, url: '/api/newsletter?previewNewsletter=1' }, {
        setHeader() {},
        status(value) { status = value; return this; },
        json() {}
      });
      assert.equal(status, method === 'GET' && environment !== 'production' ? 200 : 404);
    }
  }
  for (const env of ['production', 'preview']) {
    process.env.VERCEL_ENV = env;
    for (const kind of ['welcome', 'admin']) {
      let status;
      let html;
      await preview({ method: 'GET', url: `/api/newsletter?previewMail=${kind}` }, {
        setHeader() {},
        status(value) { status = value; return this; },
        json() {},
        send(value) { html = value; }
      });
      assert.equal(status, env === 'preview' ? 200 : 404);
      if (env === 'preview') {
        assert.match(html, kind === 'welcome' ? /<h1[^>]+color:#0f3d2e/ : /<h1[^>]+color:#fff/);
      }
    }
  }
  delete process.env.VERCEL_ENV;
  console.log('Newsletter : migrations PostgreSQL, inscription directe, consentement, transition, désinscription et reprises vérifiés.');
} finally {
  await db.close();
}
