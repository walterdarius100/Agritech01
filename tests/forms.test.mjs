import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionService, storeLead, contactResultMessage } from '../js/components/contact-form.js';
const config = { publicKey: 'mock', serviceId: 'mock', templateId: 'notification', autoReplyTemplateId: 'reply', autoReplyVerified: true, sheetEndpoint: 'https://invalid.test' };
const payload = { from_name: 'Test', from_email: 'test@example.invalid', phone: '123', need: 'Test', message: 'Test' };
for (const replyFails of [false, true]) test(`notification acceptée, autoréponse ${replyFails ? 'échouée' : 'acceptée'}`, async () => {
  const calls = [];
  const submit = createSubmissionService(config, { emailjs: { async send(s, t, p, opts) { calls.push(t); if (t === 'reply') { assert.equal(opts.limitRate.id, 'agritech-auto-reply'); if (replyFails) throw Error('mock'); } } }, fetcher: async () => ({ type: 'opaque' }) });
  const [a, b] = await Promise.all([submit(payload), submit(payload)]);
  assert.deepEqual(a, b);
  assert.deepEqual(calls, ['notification', 'reply']);
  assert.equal(a.notification, 'accepted');
  assert.equal(a.reply, replyFails ? 'failed' : 'accepted');
  assert.equal(a.storage.state, 'unconfirmed');
  assert.match(contactResultMessage(a), /transmise/);
  await submit({ ...payload, date: 'later' });
  assert.equal(calls.length, 2);
});
test('notification échouée : aucune opération secondaire ; nouvelle tentative possible', async () => {
  let count = 0;
  const submit = createSubmissionService(config, { emailjs: { async send() { count++; throw Error('network'); } }, fetcher() { assert.fail('storage'); } });
  assert.equal((await submit(payload)).notification, 'failed');
  await submit(payload); assert.equal(count, 2);
});
for (const patch of [{autoReplyTemplateId:''}, {autoReplyVerified:false}, {autoReplyTemplateId:'notification'}]) test(`autoréponse verrouillée ${JSON.stringify(patch)}`, async () => {
  let count = 0;
  const submit = createSubmissionService({...config,...patch}, { emailjs:{async send(){count++;}}, fetcher:async()=>({}) });
  assert.equal((await submit(payload)).reply, 'unconfigured'); assert.equal(count,1);
});
test('newsletter : pas d’autoréponse, doublon normalisé, stockage réseau incertain', async () => {
  let calls=0;
  const submit=createSubmissionService(config,{emailjs:{async send(){calls++;}},fetcher:async()=>{throw Error('network');}});
  const a=await submit(payload,true);
  assert.equal(a.storage.state,'unknown');
  await submit({...payload,from_email:'TEST@example.invalid'},true);
  assert.equal(calls,1);
});
test('stockage absent, opaque ou erreur serveur : jamais confirmé',async()=>{
  assert.equal((await storeLead({},payload)).state,'unconfigured');
  for(const response of [{type:'opaque'},{ok:false,status:500},{ok:true,json:async()=>({ok:true})}]) {
    assert.equal((await storeLead(config,payload,async(url,opts)=>{assert.equal(opts.mode,'no-cors');return response;})).state,'unconfirmed');
  }
});
test('configuration principale absente : aucun appel externe', async () => {
  const submit = createSubmissionService({}, {emailjs:{send(){assert.fail('EmailJS');}}, fetcher(){assert.fail('Apps Script');}});
  assert.equal((await submit(payload)).notification, 'failed');
});
test('sessionStorage refusé : garde mémoire toujours active', async () => {
  Object.defineProperty(globalThis, 'sessionStorage', {configurable:true,get(){throw Error('Denied');}});
  try {
    let calls=0;
    const submit=createSubmissionService(config,{emailjs:{async send(){calls++;}},fetcher:async()=>({})});
    await submit(payload,true); await submit(payload,true);
    assert.equal(calls,1);
  } finally { delete globalThis.sessionStorage; }
});
