// Type-check the prepared Edge entrypoint without starting a server or accessing any network.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const name='agritech-deno-check-'+randomUUID().slice(0,8);
const run=(...args)=>execFileSync('docker',args,{encoding:'utf8'});
let created=false;
try {
  run('image','inspect','denoland/deno:alpine');
  run('create','--name',name,'--network','none','denoland/deno:alpine','deno','check','--no-remote','/app/index.ts');created=true;
  run('cp',fileURLToPath(new URL('../supabase/functions/contact-request/.',import.meta.url)),name+':/app');
  process.stdout.write(run('start','--attach',name));
  const status=run('inspect','--format','{{.State.ExitCode}}',name).trim();
  if(status!=='0')throw Error('Deno check failed: '+status);
  console.log('Deno : entrée Edge vérifiée, aucun serveur démarré, conteneur sans réseau.');
} finally {if(created)run('rm','--force',name);}
