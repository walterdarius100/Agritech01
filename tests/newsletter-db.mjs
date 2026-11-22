import assert from 'node:assert/strict';
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
const failOnce = new Set(['admin', 'welcome']);
let loseConfirmationResponse = true;
let databaseDown = false;
let rpcCalls = 0;

async function transport(url, request) {
  const payload = JSON.parse(request.body);
  if (url === 'https://api.resend.com/emails') {
    const key = request.headers['Idempotency-Key'];
    assert.ok(key.startsWith('newsletter/'));
    assert.equal(request.headers.Authorization, 'Bearer test-resend-key');
    const kind = payload.subject.startsWith('Nouvelle') ? 'admin' : payload.subject.startsWith('Confirmez') ? 'confirm' : 'welcome';
    providerCalls.push({ key, kind, payload });
    if (failOnce.delete(kind)) return new Response(null, { status: 503 });
    if (providerAccepted.has(key)) assert.deepEqual(providerAccepted.get(key), payload);
    providerAccepted.set(key, payload);
    if (kind === 'confirm' && loseConfirmationResponse) {
      loseConfirmationResponse = false;
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
  return submit({ action: 'subscribe', email, source });
}

function processMail(secret = config.workerSecret) {
  return handler(new Request(endpoint + '/process', {
    method: 'POST', headers: { 'X-Newsletter-Worker-Token': secret }
  }));
}

async function select(statement) {
  return (await db.query(statement)).rows;
}

async function retryQueued() {
  await db.exec("update public.newsletter_mail set next_at = now() where status = 'queued';");
  assert.equal((await processMail()).status, 200);
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

  databaseDown = true;
  assert.deepEqual(await subscribe('valid@example.org'), [503, 'unavailable']);
  databaseDown = false;
  assert.deepEqual(await Promise.all([
    subscribe(' WALTer@Example.org ', 'article'), subscribe('walter@example.org')
  ]), [[202, 'received'], [202, 'received']]);
  const [subscriber] = await select('select email, source, status from public.newsletter_subscribers');
  assert.equal(subscriber.email, 'walter@example.org');
  assert.ok(['article', 'footer'].includes(subscriber.source));
  assert.equal(subscriber.status, 'pending');
  assert.equal((await select('select id from public.newsletter_subscribers')).length, 1);
  assert.equal((await select('select kind from public.newsletter_mail')).length, 2);

  assert.equal((await processMail()).status, 200);
  assert.equal(providerCalls.length, 2);
  assert.deepEqual(await select('select distinct status from public.newsletter_mail'), [{ status: 'queued' }]);
  assert.equal(providerAccepted.size, 1);
  const token = tokenFrom('confirm', 'confirm');
  const unsubscribe = tokenFrom('confirm', 'unsubscribe');
  const wrongSignature = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
  assert.deepEqual(await submit({ action: 'confirm', token: wrongSignature }), [400, 'invalid_link']);
  assert.deepEqual(await submit({ action: 'unsubscribe', token }), [400, 'invalid_link']);
  await retryQueued();
  assert.equal(providerAccepted.size, 2);
  assert.equal(providerCalls.find(call => call.kind === 'admin').payload.to[0], config.admin);
  assert.match(providerCalls.find(call => call.kind === 'admin').payload.text, /en attente de confirmation/);
  assert.equal(providerCalls.filter(call => call.kind === 'confirm')[0].key, providerCalls.filter(call => call.kind === 'confirm')[1].key);
  assert.equal((await select("select id from public.newsletter_mail where kind = 'welcome'")).length, 0);

  const confirms = await Promise.all([
    submit({ action: 'confirm', token }), submit({ action: 'confirm', token })
  ]);
  assert.deepEqual(confirms.map(result => result[0]).sort(), [200, 400]);
  assert.deepEqual(await select('select status from public.newsletter_subscribers'), [{ status: 'active' }]);
  assert.equal((await select("select id from public.newsletter_mail where kind = 'welcome'")).length, 1);

  assert.equal((await processMail()).status, 200);
  assert.deepEqual(await select("select status, last_error from public.newsletter_mail where kind = 'welcome'"),
    [{ status: 'queued', last_error: 'provider_503' }]);
  assert.deepEqual(await select('select status from public.newsletter_subscribers'), [{ status: 'active' }]);
  await retryQueued();
  assert.equal(providerAccepted.size, 3);
  assert.equal(tokenFrom('welcome', 'unsubscribe'), unsubscribe);
  assert.equal((await select("select id from public.newsletter_mail where status = 'accepted' and provider_id is not null")).length, 3);

  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await submit({ action: 'unsubscribe', token: unsubscribe }), [200, 'unsubscribed']);
  }
  assert.deepEqual(await subscribe('walter@example.org'), [202, 'received']);
  assert.deepEqual(await select('select status from public.newsletter_subscribers'), [{ status: 'unsubscribed' }]);
  assert.equal((await select('select id from public.newsletter_mail')).length, 3);

  assert.deepEqual(await subscribe('autre@example.org', 'footer'), [202, 'received']);
  assert.equal((await processMail()).status, 200);
  const another = providerCalls.find(call => call.kind === 'confirm' && call.payload.to[0] === 'autre@example.org');
  const expired = another.payload.text.match(/#confirm=([^\s]+)/)[1];
  await db.exec("update public.newsletter_subscribers set confirmation_expires_at = now() - interval '1 minute' where email = 'autre@example.org';");
  assert.deepEqual(await submit({ action: 'confirm', token: expired }), [400, 'invalid_link']);
  assert.deepEqual(await subscribe('autre@example.org'), [202, 'received']);
  assert.equal((await select("select id from public.newsletter_mail where kind = 'confirm'")).length, 3);
  await db.exec("update public.newsletter_mail set first_attempt_at = now() - interval '21 hours' where status = 'queued';");
  const calls = providerCalls.length;
  assert.equal((await processMail()).status, 200);
  assert.equal(providerCalls.length, calls);
  assert.deepEqual(await select("select last_error from public.newsletter_mail where status = 'failed'"),
    [{ last_error: 'retry_window_or_attempt_limit' }]);

  assert.deepEqual(await subscribe('annulation@example.org'), [202, 'received']);
  assert.equal((await processMail()).status, 200);
  const cancelMail = providerCalls.find(call => call.kind === 'confirm' && call.payload.to[0] === 'annulation@example.org');
  const cancelToken = cancelMail.payload.text.match(/#unsubscribe=([^\s]+)/)[1];
  const unusedConfirmation = cancelMail.payload.text.match(/#confirm=([^\s]+)/)[1];
  assert.deepEqual(await submit({ action: 'unsubscribe', token: cancelToken }), [200, 'unsubscribed']);
  assert.deepEqual(await submit({ action: 'confirm', token: unusedConfirmation }), [400, 'invalid_link']);
  assert.equal((await select("select id from public.newsletter_subscribers where status = 'active'")).length, 0);

  await db.exec("update public.newsletter_request_limits set attempts = 30 where bucket = 'global';");
  assert.deepEqual(await subscribe('nouveau@example.org'), [429, 'limited']);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role};`);
    for (const sql of [
      'select email from public.newsletter_subscribers',
      'select provider_id from public.newsletter_mail',
      'select bucket from public.newsletter_request_limits',
      "update public.newsletter_subscribers set status = 'active'",
      "select public.request_newsletter('test@example.org','footer')",
      "select public.apply_newsletter_link('confirm', gen_random_uuid(), gen_random_uuid())",
      'select public.claim_newsletter_mail()'
    ]) await assert.rejects(db.query(sql), /permission denied/);
  }

  for (const environment of ['production', 'preview', 'development']) {
    process.env.VERCEL_ENV = environment;
    for (const method of ['GET', 'POST']) {
      let status;
      preview({ method, url: '/api/newsletter?previewNewsletter=1' }, {
        setHeader() {},
        status(value) { status = value; return this; },
        json() {}
      });
      assert.equal(status, method === 'GET' && environment !== 'production' ? 200 : 404);
    }
  }
  delete process.env.VERCEL_ENV;
  console.log('Newsletter : migrations PostgreSQL, Edge, confidentialité, double opt-in, désinscription et reprises vérifiés.');
} finally {
  await db.close();
}
