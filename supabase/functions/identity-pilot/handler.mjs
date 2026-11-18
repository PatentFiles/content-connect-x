/** Admin-only real-engine testing. No code in this handler grants membership. */
import {identifier,legalName,nameKey,digest,imageMime,validateCapture,MAX_IMAGE,MAX_CAPTURE,TYPES,ENGINE_REVISION} from '../identity-verification/policy.mjs';
import {BUCKET,NOTICE,NOTICE_VERSION,isPilotAdmin,pilotAvailable,pilotResult,pilotSession} from './pilot-policy.mjs';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data,status=200)=>new Response(JSON.stringify({...data,test_only:true,admission_granted:false}),{status,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class PilotError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const MESSAGES={PILOT_ADMIN_REQUIRED:'Sign in with your confirmed, admitted administrator account to run a private test.',PILOT_UNAVAILABLE:'Private testing is paused, expired, or awaiting a successful cleanup check.',PILOT_SESSION_NOT_FOUND:'Test session not found.',PILOT_DAILY_LIMIT:'The private test limit is ten attempts per day.',PILOT_SESSION_LOCKED:'This test is busy or finished. Check its status or delete it and start again.',PILOT_CONSENT_REQUIRED:'Read and accept the current private-test notice.',PILOT_EVIDENCE_IMMUTABLE:'That image is already saved. Delete this test and start again to replace it.',PILOT_EVIDENCE_INCOMPLETE:'Upload all ID pages and complete the live camera capture.',PILOT_INVALID_CAPABILITY:'The worker authorization expired or was already used.',PILOT_NAME_MISMATCH:'Use the legal name read from your ID.',PILOT_ATTEMPT_LIMIT:'This test has reached its processing retry limit. Delete it and start again.'};
export async function bounded(stream,max){
 if(!stream)return new Uint8Array();const reader=stream.getReader(),chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max)throw new PilotError('The upload is too large.',413);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const out=new Uint8Array(total);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
}
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const hashText=text=>digest(new TextEncoder().encode(text));
function uuid(value){try{return identifier(value);}catch{throw new PilotError('Invalid test identifier.');}}
function origin(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!u.hostname.endsWith('.up.railway.app'))throw new PilotError('Worker configuration is invalid.',503);return u.origin;}
export function createPilotHandler({admin,authenticate,projectOrigin,fetchImpl=fetch,clock=()=>new Date()}){
 const run=async operation=>{const {data,error}=await operation;if(error){const code=Object.keys(MESSAGES).find(k=>String(error.message).includes(k));throw new PilotError(code?MESSAGES[code]:'The private test operation failed. No account approval was created.',code?409:500);}return data;};
 const transition=(user,id,action,data={})=>run(admin.rpc('ccx_idv_pilot_transition',{p_user:user,p_session:id,p_action:action,p_data:data}));
 const own=(id,user)=>run(admin.from('ccx_idv_pilot_sessions').select('*').eq('id',uuid(id)).eq('user_id',user).maybeSingle());
 const config=()=>run(admin.from('ccx_idv_pilot_config').select('*').eq('singleton',true).single());
 const maintenance=async req=>{const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');return /^[a-f0-9]{64}$/.test(token)&&await run(admin.rpc('ccx_idv_maintenance_authorized',{p_hash:await hashText(token)}))===true;};
 const purge=async()=>{
  const candidates=await run(admin.rpc('ccx_idv_pilot_purge_candidates'));
  const paths=(candidates||[]).map(row=>row.path);
  if(paths.some(p=>typeof p!=='string'||p.includes('..')||!(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/(front|back|selfie|capture)-[a-f0-9-]{36}\.(jpg|png|json)$/.test(p)||/^system-probes\/[a-f0-9-]{36}\.png$/.test(p))))throw new PilotError('Cleanup ledger validation failed.',500);
  if(paths.length){await run(admin.storage.from(BUCKET).remove(paths));await run(admin.from('ccx_idv_pilot_uploads').delete().in('path',paths));}
  await run(admin.rpc('ccx_idv_pilot_finish_purge'));
  return {removed:paths.length};
 };
 const storageProbe=async()=>{
  // A one-pixel PNG is a storage probe, never an ID or a synthetic verification.
  const data=decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD9sAAAAASUVORK5CYII='),path=`system-probes/${crypto.randomUUID()}.png`;
  await run(admin.from('ccx_idv_pilot_uploads').insert({path,session_id:null,kind:'probe',sha256:await digest(data),bytes:data.length,content_type:'image/png'}));
  try{
   await run(admin.storage.from(BUCKET).upload(path,data,{contentType:'image/png',upsert:false,cacheControl:'0'}));
   const read=await run(admin.storage.from(BUCKET).download(path));
   if(await digest(new Uint8Array(await read.arrayBuffer()))!==await digest(data))throw new PilotError('Private storage read failed.',500);
   const publicRead=await fetchImpl(`${projectOrigin}/storage/v1/object/public/${BUCKET}/${path}`,{redirect:'error',signal:AbortSignal.timeout(10000)});
   await publicRead.body?.cancel();
   if(![400,401,403,404].includes(publicRead.status))throw new PilotError('Private storage protection failed.',500);
   await run(admin.storage.from(BUCKET).remove([path]));
   const removed=await admin.storage.from(BUCKET).download(path);
   if(!removed.error||![400,404].includes(Number(removed.error.statusCode||removed.error.status)))throw new PilotError('Storage deletion could not be verified.',500);
   await run(admin.from('ccx_idv_pilot_uploads').delete().eq('path',path));
   await run(admin.from('ccx_idv_pilot_config').update({last_probe_at:clock().toISOString()}).eq('singleton',true));
   return {private_read:true,public_read_denied:true,deletion_verified:true};
  }catch(error){await admin.storage.from(BUCKET).remove([path]).catch(()=>{});throw error;}
 };
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
   const multipart=(req.headers.get('Content-Type')||'').startsWith('multipart/form-data;');
   // Authenticate before buffering an image upload. JSON control bodies are bounded.
   let user=multipart?await authenticate(req):null;
   if(multipart&&(!user||user.is_anonymous))return reply({error:'Sign in to continue.'},401);
   const bytes=await bounded(req.body,multipart?MAX_IMAGE+65536:16384);
   let body,form;
   try{if(multipart){form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('Content-Type')}}).formData();body={action:'upload',session_id:form.get('session_id'),kind:form.get('kind')};}else body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new PilotError('Invalid request.');}
   if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.action!=='string')throw new PilotError('Invalid request.');
   if(body.action==='purge'||body.action==='maintenance_probe'){
    if(!await maintenance(req))return reply({error:'Unauthorized'},401);
    return reply(body.action==='purge'?await purge():await storageProbe());
   }
   if(body.action==='worker_claim'){
    if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'Unauthorized'},401);
    const s=await transition(null,uuid(body.session_id),'claim',{job_hash:await hashText(body.token)}),evidence={};
    if(!s.user_id)return reply({error:'Test unavailable'},403);
    for(const [kind,item] of Object.entries(s.evidence)){
     if(!['front','back','selfie','capture'].includes(kind)||!item.path.startsWith(`${s.user_id}/${s.id}/`))throw new PilotError('Evidence unavailable.',503);
     const signed=await run(admin.storage.from(BUCKET).createSignedUrl(item.path,180));
     evidence[kind]={url:signed.signedUrl,sha256:item.sha256};
    }
    return reply({id:s.id,purpose:'pilot',engine_revision:ENGINE_REVISION,document_type:s.document_type,issuing_country:s.issuing_country,challenge_id:s.challenge_id,directions:s.directions,evidence});
   }
   user=user||await authenticate(req);
   if(!user||user.is_anonymous)return reply({error:'Sign in to continue.'},401);
   const security=await run(admin.from('account_security').select('admin,banned,suspended').eq('user_id',user.id).maybeSingle());
   const admitted=await run(admin.from('member_admissions').select('id').eq('user_id',user.id).maybeSingle());
   if(!isPilotAdmin(user,security,admitted))return reply({error:MESSAGES.PILOT_ADMIN_REQUIRED},403);
   const cfg=await config();
   if(body.action==='status'){
    const s=await run(admin.from('ccx_idv_pilot_sessions').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle());
    const profile=await run(admin.from('member_profiles').select('real_name').eq('id',user.id).maybeSingle());
    return reply({enabled:pilotAvailable(cfg,clock().getTime()),email_confirmed:true,notice:NOTICE,notice_version:NOTICE_VERSION,retention_days:1,supported_countries:['US'],legal_name:profile?.real_name||'',pilot_expires_at:cfg.expires_at,last_cleanup_at:cfg.last_cleanup_at,session:pilotSession(s,clock().getTime())});
   }
   if(body.action==='start'){
    if(body.consent!==true||body.notice_version!==NOTICE_VERSION)throw new PilotError(MESSAGES.PILOT_CONSENT_REQUIRED);
    if(!TYPES.includes(body.document_type)||body.issuing_country!=='US')throw new PilotError('Choose a supported US document.');
    let name;try{name=legalName(body.legal_name);}catch{throw new PilotError('Enter the full legal name on your own ID.');}
    const s=await transition(user.id,crypto.randomUUID(),'start',{legal_name:name,document_type:body.document_type,issuing_country:body.issuing_country,consent_version:NOTICE_VERSION,consent_hash:await hashText(NOTICE),consent_notice:NOTICE});
    return reply({session:pilotSession(s)});
   }
   if(!['upload','submit','confirm_name','cancel','delete'].includes(body.action))throw new PilotError('Unsupported private-test action. No manual approval override is available.');
   const s=await own(body.session_id,user.id);if(!s)throw new PilotError('Test session not found.',404);
   if(body.action==='cancel'||body.action==='delete')return reply({session:pilotSession(await transition(user.id,s.id,'cancel'))});
   if(!pilotAvailable(cfg,clock().getTime()))throw new PilotError(MESSAGES.PILOT_UNAVAILABLE,503);
   if(body.action==='confirm_name'){
    let name;try{name=legalName(body.legal_name);if(nameKey(name)!==nameKey(s.expected_name))throw Error();}catch{throw new PilotError(MESSAGES.PILOT_NAME_MISMATCH);}
    return reply({session:pilotSession(await transition(user.id,s.id,'confirm_name',{legal_name:s.expected_name}))});
   }
   if(body.action==='upload'){
    if(s.status!=='collecting'||Date.parse(s.expires_at)<=clock().getTime())throw new PilotError(MESSAGES.PILOT_SESSION_LOCKED,409);
    if(!['front','back','capture'].includes(body.kind)||s.document_type==='passport'&&body.kind==='back')throw new PilotError('Invalid upload type.');
    const file=form?.get('file');if(!(file instanceof Blob)||!file.size)throw new PilotError('Select a JPEG or PNG.');
    const raw=new Uint8Array(await file.arrayBuffer()),assets=[];
    try{
     if(body.kind==='capture'){
      if(raw.length>MAX_CAPTURE)throw Error();
      const c=validateCapture(JSON.parse(new TextDecoder().decode(raw)),s),frames=[],hashes=new Set();
      for(const f of c.frames){const b=decode(f.frame_base64);imageMime(b);const h=await digest(b);if(hashes.has(h))throw Error();hashes.add(h);frames.push({phase:f.phase,timestamp:f.timestamp,frame_base64:f.frame_base64});}
      const clean={challenge_id:s.challenge_id,challenge_type:'head_turn',directions:s.directions,start_timestamp:c.start_timestamp,end_timestamp:c.end_timestamp,frames};
      const selfie=decode(frames[0].frame_base64);
      assets.push(['capture',new TextEncoder().encode(JSON.stringify(clean)),'application/json'],['selfie',selfie,imageMime(selfie)]);
     }else assets.push([body.kind,raw,imageMime(raw)]);
    }catch{throw new PilotError('Invalid image or camera challenge. Use a clear JPEG/PNG or capture again.');}
    let current=s;
    for(const [kind,data,mime] of assets){
     const sha256=await digest(data),extension=mime==='application/json'?'json':mime==='image/png'?'png':'jpg';
     const reserved=await transition(user.id,s.id,'reserve',{kind,sha256,bytes:data.length,content_type:mime,path:`${user.id}/${s.id}/${kind}-${crypto.randomUUID()}.${extension}`});
     if(!reserved.saved_at){
      const uploaded=await admin.storage.from(BUCKET).upload(reserved.path,data,{contentType:mime,upsert:false,cacheControl:'0'});
      if(uploaded.error&&String(uploaded.error.statusCode)!=='409'&&uploaded.error.error!=='Duplicate')throw new PilotError('The private upload failed. Retry the same file.',503);
     }
     current=await transition(user.id,s.id,'uploaded',{path:reserved.path});
    }
    return reply({session:pilotSession(current)});
   }
   const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join(''),job_hash=await hashText(token);
   const frozen=await transition(user.id,s.id,'begin',{job_hash});
   try{
    const r=await fetchImpl(`${origin(cfg.worker_origin)}/process`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:s.id,token,mode:'pilot'}),redirect:'error',signal:AbortSignal.timeout(110000)});
    if(!r.ok)throw Error('Worker unavailable');
    const report=JSON.parse(new TextDecoder().decode(await bounded(r.body,65536)));
    const result=pilotResult(report,frozen,clock().toISOString().slice(0,10));
    return reply({session:pilotSession(await transition(user.id,s.id,'finish',{job_hash,...result}))});
   }catch{
    await transition(user.id,s.id,'failed',{job_hash}).catch(()=>{});
    return reply({error:'The engine could not finish this test. No account status changed. Retry or delete the attempt.'},503);
   }
  }catch(error){return reply({error:error instanceof PilotError?error.message:'The private test could not be completed. No account approval was created.'},error instanceof PilotError?error.status:500);}
 };
}
