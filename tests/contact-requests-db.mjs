import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ACADEMY_NEED, PARTNERSHIP_NEED, serviceNeeds } from '../js/config/contact-needs.js';
import { createContactHandler } from '../supabase/functions/contact-requests/index.ts';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const db = new PGlite();
const endpoint = 'https://edge.example/functions/v1/contact-requests';
const config = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'local-fixture-only',
  CONTACT_SITE_ORIGINS: 'https://agritech.example',
  CONTACT_RATE_SECRET: 'fixture-rate',
  CONTACT_TRUSTED_IP_HEADER: 'X-Test-IP',
  CONTACT_WORKER_SECRET: 'fixture-worker',
  CONTACT_PIPELINE_URL: 'https://pipeline.example/exec',
  CONTACT_PIPELINE_SECRET: 'fixture-pipeline',
  RESEND_API_KEY: 'fixture-resend',
  CONTACT_FROM: 'Agri-tech <form@example.org>',
  CONTACT_ADMIN_EMAIL: 'admin@example.org'
};
const calls = [];
const providerAccepted = new Map();
const lost = new Set();
const failOnce = new Set();
const query = async (sql, args) => (await db.query(sql, args)).rows;
let loseDatabaseReply = false;

async function transport(url, options) {
  const path = new URL(url);
  const payload = options.body ? JSON.parse(options.body) : null;
  if (path.hostname === 'db.example') {
    assert.equal(options.headers.apikey, config.SUPABASE_SERVICE_ROLE_KEY);
    const name = path.pathname.split('/').at(-1);
    if (name === 'contact_requests') {
      const id = path.searchParams.get('id').slice(3);
      return Response.json(await query('select id,name,email,phone,request_type,need,message,source,received_at from public.contact_requests where id=$1', [id]));
    }
    if (name === 'claim_contact_jobs') return Response.json(await query('select * from public.claim_contact_jobs()'));
    const args = Object.values(payload);
    assert.ok(['record_contact_request', 'finish_contact_job', 'prune_contact_rate'].includes(name));
    if (name === 'finish_contact_job' && args[5]) args[5] = JSON.stringify(args[5]);
    const [result] = await query(`select public.${name}(${args.map((_, index) => '$' + (index + 1)).join(',')}) as outcome`, args);
    if (name === 'record_contact_request' && loseDatabaseReply) throw new Error('commit reply lost');
    return Response.json(result.outcome ?? null);
  }

  if (url === config.CONTACT_PIPELINE_URL) {
    const sign = createHmac('sha256', config.CONTACT_PIPELINE_SECRET)
      .update(`v1\n${payload.timestamp}\n${payload.payload}`).digest('hex');
    assert.equal(payload.signature, sign);
    const { id } = JSON.parse(payload.payload);
    calls.push({ id, kind: 'pipeline' });
    if (failOnce.delete('pipeline')) return Response.json({ status: 'error', code: 'layout' });
    return Response.json({ status: 'synced', id, dossierId: 'AGR-0123', possibleDuplicateId: '' });
  }

  assert.equal(url, 'https://api.resend.com/emails');
  const key = options.headers['Idempotency-Key'];
  const [, kind, id] = key.split('/');
  calls.push({ id, kind, payload });
  if (failOnce.delete(kind)) return new Response(null, { status: 503 });
  if (providerAccepted.has(key)) assert.deepEqual(providerAccepted.get(key), payload);
  providerAccepted.set(key, payload);
  if (lost.delete(kind)) throw new Error('provider accepted before connection dropped');
  return Response.json({ id: key });
}

const handler = createContactHandler(config, transport);
const makeContact = (fields = {}) => ({
  id: crypto.randomUUID(), name: '<b>Personne test</b>', email: 'test@example.org', phone: '+509 3600 0000',
  need: serviceNeeds[0], message: 'Consultation <script>test</script>', website: '', consent: true, ...fields
});
async function submit(contact, origin = config.CONTACT_SITE_ORIGINS) {
  const response = await handler(new Request(endpoint, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Test-IP': '198.51.100.10' },
    body: JSON.stringify(contact)
  }));
  return { code: response.status, ...await response.json() };
}
const worker = (secret = config.CONTACT_WORKER_SECRET) => handler(new Request(endpoint + '/worker', {
  method: 'POST', headers: { 'X-Contact-Worker': secret }
}));
const status = id => query('select kind,status,last_error,attempts,result from public.contact_request_jobs where request_id=$1 order by kind', [id]);

try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/202611230002_contact_requests.sql', import.meta.url), 'utf8'));
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    await assert.rejects(db.exec('select * from public.contact_requests;'), /permission denied/);
    await assert.rejects(db.exec('update public.contact_requests set name = NULL;'), /permission denied/);
    await assert.rejects(db.exec('delete from public.contact_requests;'), /permission denied/);
    await assert.rejects(db.exec('select * from public.contact_request_jobs;'), /permission denied/);
    await assert.rejects(db.exec('select public.claim_contact_jobs();'), /permission denied/);
    await assert.rejects(db.exec('select public.record_contact_request(null,null,null,null,null,null,null,null,null);'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await worker('wrong')).status, 401);
  assert.equal((await worker('')).status, 401);
  assert.equal((await submit(makeContact(), 'https://other.example')).code, 400);
  for (const fields of [
    { email: 'invalid' }, { phone: '+1' }, { name: '' }, { need: 'Newsletter' }, { need: '__proto__' },
    { message: '' }, { message: 'a'.repeat(17000) }, { consent: false }, { website: 'hidden spam' }
  ]) assert.equal((await submit(makeContact(fields))).code, 400);

  const service = makeContact();
  loseDatabaseReply = true;
  assert.equal((await submit(service)).code, 503);
  loseDatabaseReply = false;
  assert.deepEqual(await submit(service), { code: 200, status: 'recorded', id: service.id });
  assert.equal((await submit({ ...service, message: 'Changed request' })).code, 409);
  assert.equal((await status(service.id)).length, 3);
  assert.equal(calls.length, 0);

  failOnce.add('admin_email').add('pipeline');
  lost.add('receipt_email');
  assert.equal((await worker()).status, 200);
  const failures = await status(service.id);
  assert.deepEqual(failures.map(job => [job.kind, job.last_error]), [
    ['admin_email', 'resend_503'], ['pipeline', 'pipeline_layout'], ['receipt_email', 'delivery_unconfirmed']
  ]);
  assert.equal((await query('select status from public.contact_requests where id=$1', [service.id]))[0].status, 'pending');

  await db.exec("update public.contact_request_jobs set next_attempt_at = now() - interval '1 second';");
  const parallel = await Promise.all([worker(), worker()]);
  assert.ok(parallel.every(response => response.status === 200));
  assert.deepEqual((await status(service.id)).map(job => [job.status, job.attempts]), [['done', 2], ['done', 2], ['done', 2]]);
  assert.equal((await query('select status from public.contact_requests where id=$1', [service.id]))[0].status, 'processed');
  assert.equal(providerAccepted.size, 2);
  assert.match(calls.find(call => call.kind === 'admin_email').payload.html, /&lt;script&gt;/);
  assert.doesNotMatch(calls.find(call => call.kind === 'receipt_email').payload.html, /Personne test|3600|Consultation/);

  const formation = makeContact({ need: ACADEMY_NEED, message: '' });
  const partnership = makeContact({ need: PARTNERSHIP_NEED });
  const concurrent = await Promise.all([submit(formation), submit(partnership), submit(formation)]);
  assert.ok(concurrent.every(result => result.code === 200));
  assert.deepEqual(await query('select request_type, count(*)::int as count from public.contact_requests group by request_type order by request_type'), [
    { request_type: 'formation', count: 1 }, { request_type: 'partenariat', count: 1 }, { request_type: 'service', count: 1 }
  ]);

  assert.equal((await submit(makeContact())).code, 200);
  assert.equal((await submit(makeContact())).code, 429);
  assert.equal((await submit(formation)).code, 200);
  await db.exec("update public.contact_request_jobs set first_attempt_at = now() - interval '25 hours' where status = 'pending';");
  await worker();
  assert.equal((await status(formation.id)).find(job => job.kind === 'receipt_email').last_error, 'email_idempotency_expired');
  assert.equal((await query('select status from public.contact_requests where id=$1', [formation.id]))[0].status, 'attention');
  console.log('Migration SQL, permissions, réception, quotas, concurrence de requêtes, relances et prestataires simulés : OK.');
} finally {
  await db.close();
}
