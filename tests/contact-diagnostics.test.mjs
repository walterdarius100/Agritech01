import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailSender } from '../supabase/functions/contact-request/adapters.js';
const config = { serviceId:'service-secret-marker', templateId:'template-marker', replyTemplateId:'reply-marker', emailPublicKey:'public-marker', emailPrivateKey:'private-secret-marker' };
const payload = { from_name:'Personal Name',from_email:'private@example.invalid',message:'Personal message' };
for (const [status, message, code] of [
  [403,'API calls are disabled for non-browser applications','server_access_disabled'],
  [400,'The Public Key is invalid','public_key'],
  [403,'Invalid private key','private_key'],
  [401,'Invalid accessToken','private_key'],
  [400,'Service ID not found','service'],
  [400,'Template ID invalid','template'],
  [429,'Monthly quota exceeded','quota'],
  [429,'Too Many Requests','rate_limit'],
  [403,'Forbidden','authorization'],
  [502,'Bad Gateway','provider_unavailable'],
  [422,'Unrecognized error','provider_rejected']
]) test(`diagnostic ${code} without provider text or personal data`,async()=>{
  const events=[];
  const sender=createEmailSender(config,async(url,options)=>{
    const body=JSON.parse(options.body);
    assert.equal(body.accessToken,config.emailPrivateKey);
    assert.equal(body.user_id,config.emailPublicKey);
    assert.equal(body.service_id,config.serviceId);
    assert.equal(body.template_id,config.templateId);
    return new Response(message+' '+JSON.stringify({config,payload}),{status});
  },e=>events.push(e));
  assert.deepEqual(await sender('notification',payload),{status});
  assert.deepEqual(events,[{event:'contact_email',kind:'notification',status,code}]);
});
test('network exceptions are sanitized and never retried',async()=>{
  const events=[];let calls=0;
  const sender=createEmailSender(config,async()=>{calls++;throw Error(JSON.stringify({config,payload}));},e=>events.push(e));
  await assert.rejects(()=>sender('reply',payload),/^Error: email_unconfirmed$/);
  assert.equal(calls,1);
  assert.deepEqual(events,[{event:'contact_email',kind:'reply',status:0,code:'network_unknown'}]);
});
test('accepted send does not read provider body or emit failure diagnostics',async()=>{
  const sender=createEmailSender(config,async()=>({status:200,get body(){assert.fail('body read');}}),()=>assert.fail('failure diagnostic'));
  assert.deepEqual(await sender('reply',payload),{status:200});
});
test('bounded body and failing log sink cannot change provider rejection',async()=>{
  const sender=createEmailSender(config,async()=>new Response('x'.repeat(50000),{status:400}),()=>{throw Error('logger');});
  assert.deepEqual(await sender('notification',payload),{status:400});
});
