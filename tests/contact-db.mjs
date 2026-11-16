// Disposable PostgreSQL only. No ports, no network, no production URL, no external email.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createContactHandler } from '../supabase/functions/contact-request/handler.js';
const container='agritech-contact-test-'+randomUUID().slice(0,8);
const image='postgres:17-alpine'; // Pull explicitly beforehand. This runner never downloads or deploys.
function run(args,input='') {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';
    child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);
    child.on('error',reject);child.on('close',code=>code===0?resolve(out.trim()):reject(Error(err||out||'docker failed')));
    child.stdin.end(input);
  });
}
const sql=text=>run(['exec','-i',container,'psql','-U','postgres','-XAtq','-v','ON_ERROR_STOP=1'],text);
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const fields={full_name:'Test',email:'test@example.invalid',phone:'123',request_type:'Consultation',message:'Test',consent:true};
const rh='a'.repeat(64),ph='b'.repeat(64),eh='c'.repeat(64);
const submitSql=(id,hash=ph,emailHash=eh,reply=false)=>`select public.contact_submit('${id}','${rh}','${hash}','${emailHash}',${literal(JSON.stringify(fields))}::jsonb,${reply});`;
let started=false;
try {
  await run(['image','inspect',image]);
  await run(['run','--detach','--name',container,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);started=true;
  let ready=false;
  for(let n=0;n<100;n++) {
    try {await run(['exec',container,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch {await new Promise(r=>setTimeout(r,100));}
  }
  assert.ok(ready,'Postgres ready');
  await sql(`create role anon;create role authenticated;create role service_role nologin bypassrls;
    create table public.articles(id integer primary key,status text);alter table public.articles enable row level security;
    create policy test_article_policy on public.articles for select to anon using(status='published');
    insert into public.articles values(1,'published');`);
  const before=await sql("select row_to_json(p) from pg_policies p where tablename='articles';");
  await sql(await readFile(new URL('../supabase/migrations/202611160001_contact_requests.sql',import.meta.url),'utf8'));
  assert.equal(await sql("select row_to_json(p) from pg_policies p where tablename='articles';"),before);
  assert.equal(await sql('select count(*) from public.articles;'),'1');
  console.log('SQL : migration locale appliquée ; articles et leur politique inchangés.');
  for(const role of ['anon','authenticated','service_role']) {
    for(const statement of ['select * from public.contact_requests;',"insert into public.contact_requests(id) values(gen_random_uuid());","update public.contact_requests set status='closed';",'delete from public.contact_requests;','select * from contact_internal.limits;']) {
      await assert.rejects(()=>sql(`set role ${role};${statement}`),/permission denied/);
    }
  }
  for(const role of ['anon','authenticated']) {
    for(const statement of [submitSql(randomUUID()),`select public.contact_claim_email('${randomUUID()}','${rh}','notification',20);`,`select public.contact_finish_email('${randomUUID()}','${rh}','notification','accepted');`]) {
      await assert.rejects(()=>sql(`set role ${role};${statement}`),/permission denied/);
    }
  }
  assert.equal(await sql("select count(*) from pg_policies where schemaname in ('public','contact_internal') and tablename in ('contact_requests','limits');"),'0');
  assert.equal(await sql("select bool_and(relrowsecurity) from pg_class where oid in ('public.contact_requests'::regclass,'contact_internal.limits'::regclass);"),'t');
  console.log('SQL : SELECT/INSERT/UPDATE/DELETE directs refusés ; RPC publics refusés ; RLS actif sans policy publique.');
  const id=randomUUID();
  const concurrent=await Promise.all(Array.from({length:10},()=>sql('set role service_role;'+submitSql(id))));
  assert.ok(concurrent.every(row=>JSON.parse(row).stored===true));
  assert.equal(await sql('select count(*) from public.contact_requests;'),'1');
  assert.equal(JSON.parse(await sql('set role service_role;'+submitSql(id,'d'.repeat(64)))).error,'conflict');
  assert.equal(JSON.parse(await sql('set role service_role;'+submitSql(randomUUID(),ph,eh))).stored,true);
  assert.equal(JSON.parse(await sql('set role service_role;'+submitSql(randomUUID(),ph,eh))).stored,true);
  assert.equal(JSON.parse(await sql('set role service_role;'+submitSql(randomUUID(),ph,eh))).error,'rate_limited');
  const claims=await Promise.all(Array.from({length:10},()=>sql(`set role service_role;select public.contact_claim_email('${id}','${rh}','notification',1);`)));
  assert.equal(claims.filter(row=>JSON.parse(row).claimed).length,1);
  assert.equal(await sql(`set role service_role;select public.contact_finish_email('${id}','${rh}','notification','accepted');`),'t');
  assert.equal(await sql(`set role service_role;select public.contact_finish_email('${id}','${rh}','notification','failed');`),'f');
  await sql("update contact_internal.limits set window_start=clock_timestamp()-interval '2 seconds' where key='send:slot';");
  const another=JSON.parse(concurrent[0]).id;
  assert.equal(JSON.parse(await sql(`set role service_role;select public.contact_claim_email('${another}','${rh}','reply',1);`)).claimed,false);
  // Independent pending request: slot and monthly budget both fail closed.
  const pendingId = randomUUID();
  await sql('set role service_role;' + submitSql(pendingId, ph, 'e'.repeat(64)));
  await sql("update contact_internal.limits set window_start=clock_timestamp() where key='send:slot';");
  assert.equal(JSON.parse(await sql(`set role service_role;select public.contact_claim_email('${pendingId}','${rh}','notification',20);`)).claimed,false);
  await sql("update contact_internal.limits set window_start=clock_timestamp()-interval '2 seconds' where key='send:slot';");
  assert.equal(JSON.parse(await sql(`set role service_role;select public.contact_claim_email('${pendingId}','${rh}','notification',1);`)).claimed,false);
  console.log('SQL : dix soumissions concurrentes → une ligne ; conflits, limite email et réservation unique vérifiés.');
  // Integration: real handler + real SQL transactions, EmailJS replaced by an in-process fake.
  await sql('truncate public.contact_requests,contact_internal.limits;');
  const body={id:randomUUID(),receipt:'f'.repeat(64),...fields,website:''};
  const calls=[];
  const rpc=async(name,args)=>{
    const spec={contact_submit:['p_id','p_receipt_hash','p_payload_hash','p_email_hash','p_fields','p_reply_enabled'],contact_claim_email:['p_id','p_receipt_hash','p_kind','p_monthly_budget'],contact_finish_email:['p_id','p_receipt_hash','p_kind','p_state']}[name];
    const values=spec.map(key=>typeof args[key]==='object'?literal(JSON.stringify(args[key]))+'::jsonb':typeof args[key]==='boolean'||typeof args[key]==='number'?String(args[key]):literal(args[key]));
    const result=await sql(`set role service_role;select public.${name}(${values.join(',')});`);
    return result==='t'?true:result==='f'?false:JSON.parse(result);
  };
  const handler=createContactHandler({config:{enabled:true,origins:['https://example.invalid'],hmacSecret:'mock'.repeat(16),emailEnabled:true,providerVerified:true,connectedProvider:'mock',emailPublicKey:'mock',emailPrivateKey:'mock',serviceId:'mock',templateId:'mock',replyVerified:false,linkedReplyDisabledVerified:true,monthlyBudget:1},
    db:{submit:a=>rpc('contact_submit',a),claim:a=>rpc('contact_claim_email',a),finish:a=>rpc('contact_finish_email',a)},sendEmail:async()=>{calls.push('mock');throw Error('simulated network');}});
  const invoke=()=>handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify(body)}));
  const responses=await Promise.all(Array.from({length:5},invoke));
  assert.ok((await Promise.all(responses.map(r=>r.json()))).every(r=>r.stored===true));
  await invoke();assert.equal(calls.length,1);assert.equal(await sql('select count(*) from public.contact_requests;'),'1');
  assert.equal(await sql('select notification_state from public.contact_requests;'),'unknown');
  // Monthly contact quota, independently of a newsletter quota that this DB cannot observe.
  const other=randomUUID();assert.equal(JSON.parse(await sql('set role service_role;'+submitSql(other,ph,eh))).stored,true);
  await sql("update contact_internal.limits set window_start=clock_timestamp()-interval '2 seconds' where key='send:slot';");
  assert.equal(JSON.parse(await sql(`set role service_role;select public.contact_claim_email('${other}','${rh}','notification',1);`)).claimed,false);
  // A committed insert whose HTTP acknowledgement is lost must be replayable without a second row.
  await sql('truncate public.contact_requests,contact_internal.limits;');
  let loseAcknowledgement = true;
  let acknowledgedEmails = 0;
  const recovering = createContactHandler({config:{enabled:true,origins:['https://example.invalid'],hmacSecret:'mock'.repeat(16),emailEnabled:true,providerVerified:true,connectedProvider:'mock',emailPublicKey:'mock',emailPrivateKey:'mock',serviceId:'mock',templateId:'mock',replyVerified:false,linkedReplyDisabledVerified:true,monthlyBudget:10},
    db:{submit:async a=>{const r=await rpc('contact_submit',a);if(loseAcknowledgement){loseAcknowledgement=false;throw Error('lost acknowledgement');}return r;},claim:a=>rpc('contact_claim_email',a),finish:a=>rpc('contact_finish_email',a)},
    sendEmail:async()=>{acknowledgedEmails++;return {status:200};}});
  const recoverCall=()=>recovering(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify(body)}));
  assert.equal((await (await recoverCall()).json()).stored,null);
  assert.equal(acknowledgedEmails,0);assert.equal(await sql('select count(*) from public.contact_requests;'),'1');
  assert.equal((await (await recoverCall()).json()).stored,true);
  await recoverCall();assert.equal(acknowledgedEmails,1);assert.equal(await sql('select count(*) from public.contact_requests;'),'1');
  await sql("insert into contact_internal.limits values ('attempts',date_trunc('minute',clock_timestamp()),30) on conflict(key) do update set window_start=excluded.window_start,count=30;");
  assert.equal(JSON.parse(await sql('set role service_role;'+submitSql(randomUUID()))).error,'rate_limited');
  console.log('Intégration : accusé de commit perdu puis reçu rejoué → une ligne/un email ; limite globale vérifiée.');
  console.log('Intégration handler + PostgreSQL : panne EmailJS, stockage conservé, concurrence/rejeu sans renvoi, budget mensuel contact respecté.');
} finally {
  if(started)await run(['rm','--force',container]);
}
