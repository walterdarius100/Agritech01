// Web-standard module, shared by Deno entrypoint and offline Node tests.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]{64}$/;
const EMAIL_STATES = ['pending', 'attempting', 'accepted', 'failed', 'unknown', 'disabled'];
const utf8 = new TextEncoder();
const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', utf8.encode(value)));
export async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', utf8.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, utf8.encode(value)));
}

export function validateContact(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('invalid');
  const allowed = ['id','receipt','full_name','email','phone','request_type','message','consent','website'];
  if (typeof body.id !== 'string' || typeof body.receipt !== 'string' || Object.keys(body).some(key => !allowed.includes(key)) || !UUID.test(body.id) || !HEX.test(body.receipt) || body.consent !== true) throw Error('invalid');
  if (body.website !== '' || typeof body.website !== 'string') throw Error('invalid');
  const fields = {};
  for (const [key, max] of [['full_name',150],['email',254],['phone',40],['request_type',200],['message',1200]]) {
    if (typeof body[key] !== 'string') throw Error('invalid');
    fields[key] = body[key].trim().normalize('NFC');
    if (!fields[key] || [...fields[key]].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(fields[key])) throw Error('invalid');
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fields.email) || /[\r\n]/.test(fields.email)) throw Error('invalid');
  if ([fields.full_name, fields.phone, fields.request_type].some(value => /[\r\n]/.test(value))) throw Error('invalid');
  fields.phone = fields.phone.replace(/[^0-9+\s-]/g, '').trim();
  if (!/[0-9]/.test(fields.phone)) throw Error('invalid');
  fields.email = fields.email.toLowerCase();
  fields.consent = true;
  return fields;
}

async function readLimitedJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw Error('invalid');
  const reader = request.body?.getReader();
  if (!reader) throw Error('invalid');
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16384) throw Error('too_large');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function createContactHandler({ config, db }) {
  return async request => {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin' };
    if (origin && config.origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (status, data) => new Response(JSON.stringify(data), { status, headers });
    // Fail closed even if someone accidentally deploys the prepared function.
    if (config.enabled !== true) return respond(503, { stored:false, code:'disabled' });
    if (!origin || !config.origins.includes(origin)) return respond(403, { stored:false, code:'origin' });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status:204, headers:{ ...headers, 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'content-type, apikey, authorization, x-client-info' } });
    }
    if (request.method !== 'POST') return respond(405, { stored:false, code:'method' });
    if (!config.hmacSecret || config.hmacSecret.length < 32) return respond(503, { stored:false, code:'configuration' });
    let body, fields;
    try {
      const input = await readLimitedJson(request);
      if (input.mode !== 'storage-only-v1') throw Error('invalid');
      const { mode, ...contact } = input;
      body = contact; fields = validateContact(body);
    }
    catch (error) { return respond(error.message === 'too_large' ? 413 : 400, { stored:false, code:'invalid' }); }
    const receiptHash = await sha256(body.receipt);
    const payloadHash = await hmac(config.hmacSecret, JSON.stringify(fields));
    const emailHash = await hmac(config.hmacSecret, 'rate:' + fields.email);
    let result;
    try {
      result = await db.submit({ p_id:body.id, p_receipt_hash:receiptHash, p_payload_hash:payloadHash,
        p_email_hash:emailHash, p_fields:fields, p_reply_enabled:false });
    } catch { return respond(503, { stored:null, code:'storage_unknown' }); }
    if (result?.error) {
      const code = ['conflict','rate_limited','invalid'].includes(result.error) ? result.error : 'storage_unknown';
      return respond(code === 'conflict' ? 409 : code === 'rate_limited' ? 429 : code === 'invalid' ? 400 : 503,
        { stored:['storage_unknown','rate_limited'].includes(code) ? null : false, code });
    }
    if (result?.stored !== true || result.id !== body.id || !EMAIL_STATES.includes(result.notification) || !EMAIL_STATES.includes(result.reply)) {
      return respond(503, { stored:null, code:'storage_unknown' });
    }
    return respond(200, { stored:true, id:body.id, transport:'storage-only-v1' });
  };
}
