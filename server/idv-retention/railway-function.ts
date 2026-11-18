/** Railway scheduled function: every 15 minutes, then exit.
 * Scoped maintenance capability only; no Supabase service key or pg_net secret.
 * Deletion runs independently of worker health and other cleanup failures.
 */
const origin='https://yxuqbygykpfbioslljlf.supabase.co';
const worker='https://ccx-identity-worker-staging.up.railway.app';
const token=Bun.env.IDV_MAINTENANCE_TOKEN||'';
if(!/^[a-f0-9]{64}$/.test(token))throw Error('Maintenance credential is not configured');
async function readJson(response:Response){
 if(!response.body)throw Error('Empty maintenance response');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16384)throw Error('Oversized maintenance response');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('Invalid maintenance response');}
}
async function call(endpoint:string,action:string){
 const response=await fetch(`${origin}/functions/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action}),redirect:'error',signal:AbortSignal.timeout(60000)});
 const data=await readJson(response);
 if(!response.ok){
  const known:Record<string,string>={'Private storage read failed.':'PROBE_READ','Private storage protection failed.':'PROBE_PRIVACY','Storage deletion could not be verified.':'PROBE_DELETION','The private test operation failed. No account approval was created.':'BACKEND_OPERATION'};
  console.error(JSON.stringify({event:'maintenance_check_failed',endpoint,action,http_status:response.status,code:known[data.error]||'UNCLASSIFIED'}));
  throw Error('Maintenance endpoint failed');
 }
 return data;
}
const failures:string[]=[];
let productionRemoved:number|null=null,pilotRemoved:number|null=null,probePassed=false,anonymousDenied=true,workerReady=false;
try{productionRemoved=(await call('identity-verification','purge')).removed;}catch{failures.push('production_cleanup');}
try{pilotRemoved=(await call('identity-pilot','purge')).removed;}catch{failures.push('pilot_cleanup');}
try{const p=await call('identity-pilot','maintenance_probe');probePassed=p.private_read===true&&p.public_read_denied===true&&p.deletion_verified===true;if(!probePassed)failures.push('private_storage_probe');}catch{failures.push('private_storage_probe');}
for(const action of ['status','purge','maintenance_probe']){
 try{const response=await fetch(`${origin}/functions/v1/identity-pilot`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),redirect:'error',signal:AbortSignal.timeout(15000)});await response.body?.cancel();if(response.status!==401)anonymousDenied=false;}catch{anonymousDenied=false;}
}
if(!anonymousDenied)failures.push('anonymous_access_probe');
try{const response=await fetch(`${worker}/health`,{redirect:'error',signal:AbortSignal.timeout(15000)});if(response.ok){const h=await readJson(response);workerReady=h.status==='ok'&&h.ocr_self_test===true&&h.modes?.includes('pilot')===true;}else await response.body?.cancel();}catch{}
console.log(JSON.stringify({event:'identity_cleanup_complete',production_removed:productionRemoved,pilot_removed:pilotRemoved,private_storage_probe:probePassed?'passed':'failed',anonymous_access:anonymousDenied?'denied':'failed',worker_pilot_ready:workerReady,failed_checks:failures}));
if(failures.length)throw Error('Identity maintenance checks failed: '+failures.join(','));
