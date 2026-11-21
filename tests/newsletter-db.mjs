import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const handler = require('../api/newsletter.js');
const db = new PGlite();
const originalFetch = globalThis.fetch;

async function request(body, headers = {}, method = 'POST') {
  let status;
  let json;
  await handler({
    method, body,
    headers: {
      host: 'preview.example', origin: 'https://preview.example',
      'content-type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.1',
      ...headers
    }
  }, {
    setHeader() {},
    status(value) { status = value; return this; },
    json(value) { json = value; }
  });
  return [status, json.outcome];
}

try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/202611210001_newsletter_subscribers.sql', import.meta.url), 'utf8'));

  process.env.SUPABASE_URL = 'https://test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-key';
  process.env.NEWSLETTER_RATE_LIMIT_SECRET = 'local-test-secret';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://test.invalid/rest/v1/rpc/subscribe_newsletter');
    assert.equal(options.headers.Authorization, 'Bearer local-test-key');
    const { p_email, p_source, p_bucket } = JSON.parse(options.body);
    const { rows } = await db.query(
      'select public.subscribe_newsletter($1, $2, $3) as outcome', [p_email, p_source, p_bucket]
    );
    return Response.json(rows[0].outcome);
  };

  assert.deepEqual(await request({ email: 'invalid', source: 'footer' }), [400, 'invalid']);
  assert.deepEqual(await request({ email: 'a@example.org', source: 'contact' }), [400, 'invalid']);
  assert.deepEqual(await request({}, { origin: 'https://other.example' }), [403, 'forbidden']);
  assert.deepEqual(await request({}, {}, 'GET'), [405, 'method_not_allowed']);
  assert.deepEqual(await request({ email: 'a@example.org', source: 'footer' }, {
    'x-vercel-forwarded-for': 'invalid'
  }), [503, 'unavailable']);

  await db.exec('set role service_role;');
  const concurrent = await Promise.all([
    request({ email: ' WALTer@Example.org ', source: 'article' }),
    request({ email: 'walter@example.org', source: 'footer' })
  ]);
  assert.deepEqual(concurrent.map(([status]) => status).sort(), [200, 201]);
  const { rows } = await db.query('select email, source, status from public.newsletter_subscribers');
  assert.deepEqual(rows, [{ email: 'walter@example.org', source: concurrent[0][0] === 201 ? 'article' : 'footer', status: 'active' }]);
  await db.exec("reset role; update public.newsletter_subscribers set status = 'unsubscribed'; set role service_role;");
  assert.deepEqual(await request({ email: 'walter@example.org', source: 'footer' }), [200, 'contact_required']);
  await db.exec("reset role; update public.newsletter_subscribers set status = 'pending'; set role service_role;");
  assert.deepEqual(await request({ email: 'walter@example.org', source: 'footer' }), [200, 'pending']);
  assert.deepEqual(await request({ email: 'autre@example.org', source: 'footer' }), [201, 'subscribed']);
  assert.deepEqual(await request({ email: 'trois@example.org', source: 'footer' }), [429, 'limited']);
  await db.exec("reset role; update public.newsletter_request_limits set attempts = 120 where bucket = 'global'; set role service_role;");
  assert.deepEqual(await request({ email: 'trois@example.org', source: 'footer' }, {
    'x-vercel-forwarded-for': '192.0.2.2'
  }), [429, 'limited']);
  assert.equal((await db.query('select count(*)::int as total from public.newsletter_subscribers')).rows[0].total, 2);

  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role};`);
    for (const statement of [
      'select email from public.newsletter_subscribers',
      "insert into public.newsletter_subscribers (email, source) values ('a@example.org', 'footer')",
      "update public.newsletter_subscribers set status = 'active'",
      'select bucket from public.newsletter_request_limits',
      `select public.subscribe_newsletter('a@example.org', 'footer', repeat('a', 64))`
    ]) {
      await assert.rejects(db.query(statement), /permission denied/);
    }
  }

  globalThis.fetch = async () => { throw new Error('Simulated network failure'); };
  assert.deepEqual(await request({ email: 'a@example.org', source: 'article' }), [503, 'unavailable']);
  console.log('Newsletter SQL et API : normalisation, doublons, quotas, statuts, droits et panne vérifiés.');
} finally {
  globalThis.fetch = originalFetch;
  await db.close();
}
