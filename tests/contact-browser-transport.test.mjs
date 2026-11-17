import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactHandler } from '../supabase/functions/contact-request/handler.js';
import { createStoredContactService } from '../js/components/stored-contact.js';
import { createBrowserContactSender } from '../js/components/browser-contact-email.js';
const origin='https://example.invalid';
const payload={from_name:'Client Test',from_email:'browser@example.invalid',phone:'123',need:'Consultation',message:'Test browser',consent:'Oui'};
function setup({replyEnabled=true,replyTemplate='reply-template',fault='',sdkMissing=false}={}) {
  const rows=new Map(), calls=[], order=[];
  const db={
    async submit(a){
      const old=rows.get(a.p_id);
      if(old && (old.hash!==a.p_receipt_hash || old.payload!==a.p_payload_hash))return {error:'conflict'};
      if(!old)rows.set(a.p_id,{stored:true,id:a.p_id,notification:'pending',reply:a.p_reply_enabled?'pending':'disabled',hash:a.p_receipt_hash,payload:a.p_payload_hash});
      order.push('stored');return {...rows.get(a.p_id)};
    },
    async claim(a){
      const row=rows.get(a.p_id);
      if(row[a.p_kind]!=='pending' || (a.p_kind==='reply' && row.notification!=='accepted') || fault==='claim')return {claimed:false};
      row[a.p_kind]='attempting';order.push('claim:'+a.p_kind);return {claimed:true};
    },
    async finish(a){if(fault==='finish')throw Error('network'); rows.get(a.p_id)[a.p_kind]=a.p_state;return true;}
  };
  const handler=createContactHandler({config:{enabled:true,transport:'browser',browserReplyEnabled:replyEnabled,origins:[origin],hmacSecret:'x'.repeat(32),monthlyBudget:100},db,sendEmail(){assert.fail('server email');}});
  const config={publicKey:'public',serviceId:'service_z856n3l',templateId:'template_pzsnmea',autoReplyTemplateId:replyTemplate};
  const sender=createBrowserContactSender(config,()=>sdkMissing?null:{async send(service,template,data,options){
    assert.equal(rows.get(data.request_id)?.stored,true);assert.equal(options.limitRate.throttle,1100);
    calls.push(template);order.push('email:'+template);
    if(fault==='notification' || fault==='reply' && template===replyTemplate)throw {status:422};
    if(fault==='network')throw Error('uncertain');
    return {status:200};
  }});
  const fetcher=async(url,options)=>handler(new Request(origin,{...options,headers:{...options.headers,origin}}));
  const service=createStoredContactService({enabled:true,endpoint:'https://mock.supabase.co/functions/v1/contact-request'},{fetcher,sendEmail:sender,pause:async()=>{}});
  return {service,rows,calls,order,handler,fetcher,sender};
}
test('browser transport: store, reserve, admin, finish, separate reply; concurrent/repeated submits send once',async()=>{
  const s=setup();const results=await Promise.all([s.service(payload),s.service(payload)]);
  assert.ok(results.every(r=>r.notification==='accepted' && r.reply==='accepted'));
  await s.service(payload);assert.equal(s.rows.size,1);assert.deepEqual(s.calls,['template_pzsnmea','reply-template']);
  assert.ok(s.order.indexOf('stored')<s.order.indexOf('email:template_pzsnmea'));
});
for(const options of [{replyTemplate:''},{replyTemplate:'template_pzsnmea'},{replyEnabled:false},{fault:'reply'}])test(`admin unaffected by reply configuration/failure ${JSON.stringify(options)}`,async()=>{
  const s=setup(options);const result=await s.service(payload);
  assert.equal(result.notification,'accepted');assert.equal(s.calls[0],'template_pzsnmea');
  if(options.fault==='reply')assert.equal(result.reply,'failed');
});
for(const fault of ['notification','network','finish','claim'])test(`browser failure ${fault}: retained row and no resend`,async()=>{
  const s=setup({fault});const result=await s.service(payload);assert.equal(result.stored,true);
  const count=s.calls.length;await s.service(payload);assert.equal(s.calls.length,count);
});
test('missing SDK does not reserve or send; request remains stored and pending',async()=>{
  const s=setup({sdkMissing:true});const result=await s.service(payload);
  assert.equal(result.stored,true);assert.equal(result.notification,'pending');assert.equal(s.calls.length,0);
  assert.ok(!s.order.some(e=>e.startsWith('claim:')));
});
test('invalid actions are refused before database access',async()=>{
  const s=setup();
  const request=new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'delete'})});
  assert.equal((await s.handler(request)).status,400);assert.equal(s.rows.size,0);
});

test('lost claim acknowledgement never sends an unreserved email',async()=>{
  const s=setup();let calls=0;
  const fetcher=async(url,options)=>{
    const response=await s.fetcher(url,options);
    if(JSON.parse(options.body).action?.startsWith('claim_'))throw Error('lost acknowledgement');
    return response;
  };
  const service=createStoredContactService({enabled:true,endpoint:'https://mock.supabase.co/functions/v1/contact-request'},{fetcher,sendEmail:async()=>{calls++;return {status:200};},pause:async()=>{}});
  await service(payload);await service(payload);assert.equal(calls,0);
  assert.equal(s.rows.size,1);
});
test('browser actions do not revive failed rows or bypass receipt checks',async()=>{
  const s=setup({fault:'notification'});await s.service(payload);
  const [row]=s.rows.values();assert.equal(row.notification,'failed');
  const request={id:row.id,receipt:'a'.repeat(64),full_name:payload.from_name,email:payload.from_email,phone:payload.phone,request_type:payload.need,message:payload.message,consent:true,website:'',action:'claim_notification'};
  const response=await s.handler(new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(request)}));
  assert.equal(response.status,409);assert.equal(s.calls.length,1);
});
