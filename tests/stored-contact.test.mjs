import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoredContactService, storedContactMessage } from '../js/components/stored-contact.js';
import { CONTACT_STORAGE_CONFIG } from '../js/config.js';
import { readFile } from 'node:fs/promises';
const payload={from_name:'Test',from_email:'test@example.invalid',phone:'123',need:'Consultation',message:'Test',consent:'Oui'};
const config={enabled:true,endpoint:'https://mock.supabase.co/functions/v1/contact-request'};
function mockStorage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),values};}
test('raccordement au projet choisi, aucun secret public, désactivation explicite possible',async()=>{
  assert.equal(CONTACT_STORAGE_CONFIG.enabled,true);assert.equal(CONTACT_STORAGE_CONFIG.endpoint,'https://lxvegipzhkkujibexnkl.supabase.co/functions/v1/contact-request');
  await assert.rejects(()=>createStoredContactService({...CONTACT_STORAGE_CONFIG,enabled:false},{fetcher(){assert.fail('network');}})(payload));
  for(const file of ['js/components/stored-contact.js','js/config.js'])assert.doesNotMatch(await readFile(new URL('../'+file,import.meta.url),'utf8'),/service_role|sb_secret_|EMAILJS_PRIVATE_KEY|CONTACT_HMAC_SECRET/);
});
test('panne puis réessai, concurrence et rechargement : reçu stable, champs bruts absents du stockage',async()=>{
  const storage=mockStorage();Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage});
  try {
    const bodies=[];let fail=true;
    const fetcher=async(url,options)=>{
      const body=JSON.parse(options.body);bodies.push(body);
      await new Promise(r=>setTimeout(r,10));
      if(fail)throw Error('network');
      return {ok:true,json:async()=>({stored:true,id:body.id,notification:'failed',reply:'disabled'})};
    };
    const submit=createStoredContactService(config,{fetcher});
    const first=await Promise.all([submit(payload),submit(payload)]);assert.equal(bodies.length,1);assert.equal(first[0].stored,null);
    fail=false;assert.equal((await submit(payload)).stored,true);assert.equal(bodies[0].id,bodies[1].id);assert.equal(bodies[0].receipt,bodies[1].receipt);
    await createStoredContactService(config,{fetcher})(payload);assert.equal(bodies[2].id,bodies[0].id);
    assert.ok([...storage.values.values()].every(v=>!v.includes(payload.from_email)&&!v.includes(payload.message)));
    await submit({...payload,message:'Changed'});assert.notEqual(bodies[3].id,bodies[0].id);
  } finally {delete globalThis.sessionStorage;}
});
test('stockage navigateur refusé : même reçu en mémoire ; aucune solution de repli email-first',async()=>{
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw Error('blocked');}});
  try {
    const ids=[];const submit=createStoredContactService(config,{fetcher:async(url,opts)=>{ids.push(JSON.parse(opts.body).id);throw Error('network');}});
    await submit(payload);await submit(payload);assert.equal(ids[0],ids[1]);
  } finally {delete globalThis.sessionStorage;}
});
for(const response of [{ok:true,data:{stored:true,id:'wrong',notification:'accepted',reply:'accepted'}},{ok:false,data:{stored:null,code:'rate_limited'}},{ok:false,data:{stored:false,code:'invalid'}}])test(`réponse serveur ${JSON.stringify(response)}`,async()=>{
  const submit=createStoredContactService(config,{fetcher:async()=>({ok:response.ok,json:async()=>response.data})});
  assert.notEqual((await submit(payload)).stored,true);
});
test('messages : pas de réussite sur stockage incertain, pas de renvoi après stockage confirmé',()=>{
  assert.match(storedContactMessage({stored:null}),/pas pu être confirmé/);
  assert.match(storedContactMessage({stored:true,notification:'failed'}),/Ne renvoyez pas/);
  assert.match(storedContactMessage({stored:true,notification:'accepted',reply:'failed'}),/accusé/);
});
test('endpoint vide ou non Supabase : refus avant réseau, aucun fallback',async()=>{
  for(const endpoint of ['', 'https://other.invalid/functions/v1/contact-request']) {
    const submit=createStoredContactService({enabled:true,endpoint},{fetcher(){assert.fail('network');}});
    assert.deepEqual(await submit(payload),{stored:false,code:'configuration'});
  }
});
