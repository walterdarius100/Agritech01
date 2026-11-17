import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createContactRequest } from '../js/components/contact-request.js';
import { createContactHandler } from '../supabase/functions/contact-request/handler.js';
globalThis.crypto ||= webcrypto;
const config = { publicKey:'public', serviceId:'service', templateId:'admin', autoReplyTemplateId:'client' };
const payload = { from_name:'Marie', from_email:'marie@example.org', phone:'12345', need:'Conseil', message:'Bonjour', consent:'Oui' };
function fixture({ fail, fetchFailure = false } = {}) {
  const calls = [], items = new Map();
  const storage = () => ({ getItem: k => items.get(k), setItem: (k,v) => items.set(k,v) });
  const fetcher = async (url, options) => {
    calls.push('store'); if (fetchFailure) throw Error('network');
    const body = JSON.parse(options.body);
    return { ok:true, json:async () => ({ stored:true, id:body.id, transport:'storage-only-v1' }) };
  };
  const emailjs = () => ({ send: async (service, template) => { calls.push(template); if (template === fail) throw Error('send'); } });
  return { calls, items, submit:createContactRequest({ endpoint:'https://test.invalid', emailConfig:config, storage, fetcher, emailjs, pause:async () => {} }) };
}
test('enregistre puis transmet les deux templates et évite les renvois en session', async () => {
  const f=fixture(); assert.deepEqual(await f.submit(payload), { stored:true, notification:'accepted', reply:'accepted' });
  assert.deepEqual(f.calls,['store','admin','client']);
  await f.submit(payload); assert.deepEqual(f.calls,['store','admin','client','store']);
  assert.ok([...f.items.values()].every(v => !v.includes(payload.from_email) && !v.includes(payload.message)));
});
test('échec de l’accusé après notification ; échec de notification ne bloque pas l’accusé', async () => {
  for (const fail of ['client','admin']) {
    const f=fixture({fail}); const r=await f.submit(payload);
    assert.equal(r[fail === 'client' ? 'reply' : 'notification'],'failed');
    assert.deepEqual(f.calls,['store','admin','client']);
  }
});
test('erreur stockage et double soumission : aucun email ni appel concurrent', async () => {
  const f=fixture({fetchFailure:true}); assert.equal((await f.submit(payload)).stored,false); assert.deepEqual(f.calls,['store']);
  const g=fixture(); const [a,b]=await Promise.all([g.submit(payload),g.submit(payload)]);
  assert.equal(a.stored,true); assert.equal(b.busy,true); assert.deepEqual(g.calls,['store','admin','client']);
});
test('ancienne fonction sans contrat explicite : aucun email navigateur', async () => {
  let sent=0;
  const submit=createContactRequest({endpoint:'x',emailConfig:config,storage:()=>null,pause:async()=>{},emailjs:()=>({send:async()=>sent++}),fetcher:async(u,o)=>({ok:true,json:async()=>({stored:true,id:JSON.parse(o.body).id})})});
  assert.equal((await submit(payload)).stored,false); assert.equal(sent,0);
});
test('fonction Edge : stockage seul et refus du protocole historique', async () => {
  let writes=0; const id=crypto.randomUUID(); const receipt='a'.repeat(64);
  const db={submit:async args=>{writes++; assert.equal(args.p_reply_enabled,false); return {stored:true,id,notification:'pending',reply:'disabled'};}};
  const handler=createContactHandler({config:{enabled:true,origins:['https://example.org'],hmacSecret:'x'.repeat(32)},db});
  const body={id,receipt,full_name:'Marie',email:'marie@example.org',phone:'12345',request_type:'Conseil',message:'Bonjour',consent:true,website:''};
  const req=b=>new Request('https://edge.invalid',{method:'POST',headers:{origin:'https://example.org','content-type':'application/json'},body:JSON.stringify(b)});
  assert.equal((await handler(req(body))).status,400); assert.equal(writes,0);
  const res=await handler(req({...body,mode:'storage-only-v1'}));
  assert.deepEqual(await res.json(),{stored:true,id,transport:'storage-only-v1'}); assert.equal(writes,1);
});

test('newsletter existante : un email administratif et stockage Sheets, sans accusé', async () => {
  let ready, submit, reset=false; const calls=[];
  const form={ addEventListener:(event, fn)=>{submit=fn;}, reset:()=>{reset=true;} };
  const elements={'#newsletterForm':form,'#newsletterEmail':{value:'personne@example.org'},'#newsletterSubmit':{},'#newsletterStatus':{}};
  globalThis.document={addEventListener:(event,fn)=>{ready=fn;},querySelector:s=>elements[s]};
  globalThis.window={emailjs:{init:()=>{},send:async (...args)=>calls.push(args)},setTimeout:()=>1,clearTimeout:()=>{}};
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (...args)=>{calls.push(args); return {};};
  try {
    await import('../js/pages/footer-newsletter.js'); ready(); await submit({preventDefault(){}});
    assert.equal(calls.length,2); assert.equal(calls[0][1],'template_pzsnmea');
    assert.equal(calls[0][2].TYPE_CONTACT,'Newsletter'); assert.match(calls[1][0],/script\.google\.com/);
    assert.equal(reset,true); assert.match(elements['#newsletterStatus'].textContent,/confirmée/);
  } finally { globalThis.fetch=originalFetch; delete globalThis.window; delete globalThis.document; }
});
