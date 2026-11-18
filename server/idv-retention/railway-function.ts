/** Railway scheduled function: run every 15 minutes, then exit.
 * Only a scoped maintenance capability is held here, never the Supabase service key.
 * No credentials enter pg_net, browser code, GitHub, or application logs.
 */
const origin='https://yxuqbygykpfbioslljlf.supabase.co';
const worker='https://ccx-identity-worker-staging.up.railway.app';
const token=Bun.env.IDV_MAINTENANCE_TOKEN||'';
if(!/^[a-f0-9]{64}$/.test(token))throw Error('Maintenance credential is not configured');
async function readJson(response:Response){
 const text=await response.text();
 if(text.length>16384)throw Error('Oversized maintenance response');
 try{return JSON.parse(text);}catch{throw Error('Invalid maintenance response');}
}
async function call(endpoint:string,action:string){
 const response=await fetch(`${origin}/functions/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action}),redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(`${endpoint}:${action} returned HTTP ${response.status}`);
 return readJson(response);
}
const healthResponse=await fetch(`${worker}/health`,{redirect:'error',signal:AbortSignal.timeout(15000)});
if(!healthResponse.ok)throw Error('Identity worker health check failed');
const health=await readJson(healthResponse);
if(health.status!=='ok'||health.ocr_self_test!==true||!health.modes?.includes('pilot'))throw Error('The worker does not have the tested pilot build');
// Anonymous requests must be rejected by the actual handler, not just the UI.
for(const action of ['status','purge','maintenance_probe']){
 const response=await fetch(`${origin}/functions/v1/identity-pilot`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),redirect:'error',signal:AbortSignal.timeout(15000)});
 await response.body?.cancel();
 if(response.status!==401)throw Error(`Pilot authentication probe failed for ${action}`);
}
const production=await call('identity-verification','purge');
const probe=await call('identity-pilot','maintenance_probe');
if(probe.private_read!==true||probe.public_read_denied!==true||probe.deletion_verified!==true)throw Error('Private storage self-test failed');
// Heartbeat is updated only after the actual private storage round-trip and deletion.
const pilot=await call('identity-pilot','purge');
console.log(JSON.stringify({event:'identity_cleanup_complete',production_removed:production.removed,pilot_removed:pilot.removed,private_storage_probe:'passed',anonymous_access:'denied',worker_pilot_ready:true}));
