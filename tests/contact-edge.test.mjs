import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactHandler, validateContact } from '../supabase/functions/contact-request/handler.js';
import { createEmailSender, createRpcDatabase } from '../supabase/functions/contact-request/adapters.js';
const origin='https://example.invalid';
const body={id:'12345678-1234-4234-8234-123456789012',receipt:'a'.repeat(64),full_name:'Test',email:'test@example.invalid',phone:'+509 1234',request_type:'Formation',message:'Test',consent:true,website:''};
const config={enabled:true,origins:[origin],hmacSecret:'mock'.repeat(16),emailEnabled:true,providerVerified:true,connectedProvider:'Mock only',emailPublicKey:'mock-public',emailPrivateKey:'mock-private',serviceId:'mock-service',templateId:'mock-notification',replyTemplateId:'mock-reply',replyVerified:true,linkedReplyDisabledVerified:true,monthlyBudget:20};
function setup(patch={}, faults={}) {
  const rows=new Map(); const sends=[]; const order=[];
  const db={
    async submit(args){
      order.push('store');
      if(faults.storage) throw Error('network');
      if(faults.response) return faults.response;
      const old=rows.get(args.p_id);
      if(old && (old.hash!==args.p_receipt_hash || old.payload!==args.p_payload_hash)) return {error:'conflict'};
      const r=old || {stored:true,id:args.p_id,notification:'pending',reply:args.p_reply_enabled?'pending':'disabled',hash:args.p_receipt_hash,payload:args.p_payload_hash};
      rows.set(args.p_id,r);return {...r};
    },
    async claim(args){
      if(faults.claim) throw Error('network');
      if(faults.budget) return {claimed:false};
      const r=rows.get(args.p_id);
      if(r[args.p_kind]!=='pending')return {claimed:false};
      r[args.p_kind]='attempting';order.push('claim:'+args.p_kind);return {claimed:true};
    },
    async finish(args){
      if(faults.finish)throw Error('network');
      rows.get(args.p_id)[args.p_kind]=args.p_state;return true;
    }
  };
  const handler=createContactHandler({config:{...config,...patch},db, pause:async()=>{},sendEmail:async(kind)=>{
    order.push('email:'+kind);sends.push(kind);
    assert.equal(rows.get(body.id)?.stored,true);
    if(faults.email===kind)throw Error('network');
    return {status:faults.status || 200};
  }});
  const call=async(data=body,options={})=>handler(new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json',...options.headers},body:JSON.stringify(data),...options}));
  return {rows,sends,order,call,handler};
}
test('inactive par défaut, aucun accès réseau ou base',async()=>{
  const s=setup({enabled:false}); assert.equal((await s.call()).status,503);assert.equal(s.rows.size,0);assert.equal(s.sends.length,0);
});
for(const patch of [{consent:false},{id:[body.id]},{receipt:[body.receipt]},{full_name:'Name\r\nHeader'},{email:'bad'},{full_name:''},{phone:'abc'},{message:'x'.repeat(1201)},{status:'closed'},{receipt:'bad'},{id:'bad'},{website:'spam'},{email:'a@b.invalid\r\nBcc: victim@x.invalid'}])test(`validation ${JSON.stringify(patch).slice(0,70)}`,async()=>{
  const s=setup();assert.equal((await s.call({...body,...patch})).status,400);assert.equal(s.rows.size,0);assert.equal(s.sends.length,0);
});
test('méthode, origine et corps bornés ; aucune fuite des données',async()=>{
  const s=setup();
  assert.equal((await s.handler(new Request(origin,{headers:{origin}}))).status,405);
  assert.equal((await s.call(body,{headers:{origin:'https://other.invalid','content-type':'application/json'}})).status,403);
  const preflight=await s.handler(new Request(origin,{method:'OPTIONS',headers:{origin}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
  assert.equal((await s.call({...body,message:'x'.repeat(17000)})).status,413);
  const result=await s.call(); const text=await result.text();assert.ok(!text.includes(body.email));assert.ok(!text.includes(body.receipt));assert.equal(result.headers.get('cache-control'),'no-store');
});
test('stockage prioritaire, double clic concurrent et rejeu : une ligne, deux emails distincts',async()=>{
  const s=setup();const replies=await Promise.all([s.call(),s.call(),s.call()]);
  assert.ok(replies.every(r=>r.status===200));assert.equal(s.rows.size,1);assert.deepEqual(s.sends,['notification','reply']);
  assert.equal(s.order[0],'store');await s.call();assert.equal(s.sends.length,2);
});
for(const fault of [{storage:true},{response:{stored:true,id:'wrong',notification:'accepted',reply:'accepted'}},{response:{error:'rate_limited'}}])test(`stockage incertain/invalide/quota ${JSON.stringify(fault)}`,async()=>{
  const s=setup({},fault);const result=await (await s.call()).json();assert.notEqual(result.stored,true);assert.equal(s.sends.length,0);
});
test('identifiant réutilisé avec un autre contenu ou reçu refusé',async()=>{
  const s=setup();await s.call();assert.equal((await s.call({...body,message:'changed'})).status,409);assert.equal((await s.call({...body,receipt:'b'.repeat(64)})).status,409);assert.equal(s.rows.size,1);
});
for(const kind of ['notification','reply'])test(`panne ${kind} après stockage : pas de renvoi`,async()=>{
  const s=setup({}, {email:kind});const result=await (await s.call()).json();assert.equal(result.stored,true);assert.equal(result[kind],'unknown');
  const count=s.sends.length;await s.call();assert.equal(s.sends.length,count);
});
for(const status of [429,422,500])test(`EmailJS ${status} : demande conservée`,async()=>{
  const s=setup({}, {status});const result=await (await s.call()).json();assert.equal(result.stored,true);assert.equal(result.notification,status<500?'failed':'unknown');await s.call();assert.equal(s.sends.length,1);
});
for(const fault of [{claim:true},{budget:true},{finish:true}])test(`réservation, quota ou confirmation base défaillante ${JSON.stringify(fault)}`,async()=>{
  const s=setup({},fault);const result=await (await s.call()).json();assert.equal(result.stored,true);assert.notEqual(result.notification,'accepted');
  await s.call();assert.ok(s.sends.length<=1);
});
for(const patch of [{emailEnabled:false},{providerVerified:false},{connectedProvider:''},{linkedReplyDisabledVerified:false},{monthlyBudget:0},{emailPrivateKey:''}])test(`verrou email ${JSON.stringify(patch)}`,async()=>{
  const s=setup(patch);assert.equal((await (await s.call()).json()).stored,true);assert.deepEqual(s.sends,[]);
});
for(const patch of [{replyVerified:false},{replyTemplateId:''},{replyTemplateId:config.templateId}])test(`réponse désactivée ${JSON.stringify(patch)}`,async()=>{
  const s=setup(patch);await s.call();assert.deepEqual(s.sends,['notification']);
});
test('adaptateurs REST sans envoi réel : destinations fixées, secret uniquement serveur, contenu échappé',async()=>{
  let captured;
  const sender=createEmailSender(config,async(url,options)=>{captured={url,...options};return {status:200};});
  await sender('notification',{from_name:'<script>',from_email:body.email});
  const sent=JSON.parse(captured.body);assert.equal(sent.template_id,'mock-notification');assert.equal(sent.accessToken,'mock-private');assert.equal(sent.template_params.from_name,'&lt;script&gt;');assert.equal(sent.template_params.from_email,body.email);
  let rpcCalls=0;const db=createRpcDatabase({url:'https://mock.invalid',secret:'mock',fetcher:async(url,options)=>{
    rpcCalls++;assert.equal(options.headers.Authorization,'Bearer mock');assert.match(url,/\/rest\/v1\/rpc\/contact_submit$/);return {ok:false};
  }});
  await assert.rejects(()=>db.submit({}));assert.equal(rpcCalls,1);
});
test('normalisation et consentement recontact uniquement',()=>{
  const fields=validateContact({...body,email:'TEST@example.invalid'});assert.equal(fields.email,body.email);assert.equal(fields.consent,true);assert.equal(fields.newsletter,undefined);
});
