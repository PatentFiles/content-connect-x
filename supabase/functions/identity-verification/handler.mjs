/** Transport and authorization for the first-party capture flow.
 * Private IDs are accepted only after verified sign-in and recorded consent.
 * Raw OCR and worker verdicts never come from the browser.
 */
import {POLICY,ENGINE_REVISION,MAX_IMAGE,MAX_CAPTURE,TYPES,identifier,legalName,nameKey,digest,imageMime,validateCapture,decide,publicMessage} from './policy.mjs';
const BUCKET='ccx-identity-evidence';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class RequestError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const errors={INVALID_CAPABILITY:'The verification capability is invalid or expired.',VERIFICATION_UNAVAILABLE:'Verification is not available yet.',CONFIRM_EMAIL:'Confirm your email address before verification.',ACCOUNT_RESTRICTED:'This account is restricted.',DAILY_ATTEMPT_LIMIT:'You have reached the daily verification limit. Please try again later.',SESSION_NOT_FOUND:'Verification session not found.',NOTICE_CHANGED:'The verification notice changed. Review it and consent again.',COUNTRY_UNSUPPORTED:'This issuing country is not supported yet.',SESSION_LOCKED:'This session cannot be changed. Check its status or start a new attempt.',SESSION_EXPIRED_OR_DISABLED:'This session expired or verification is unavailable. Start a new attempt.',EVIDENCE_IMMUTABLE:'This evidence is already saved. Start a new attempt to replace it.',EVIDENCE_INCOMPLETE:'Upload all required ID images and complete the camera check.',ATTEMPT_LIMIT:'This attempt has reached its retry limit. Request a review.',NAME_DOES_NOT_MATCH:'Enter the full legal name printed on the ID.',REVIEW_UNAVAILABLE:'A review cannot be requested for this session yet.'};
async function boundedBody(stream,max){
 if(!stream)return new Uint8Array();const reader=stream.getReader();const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new RequestError('The upload is too large.',413);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
function publicSession(s){
 if(!s)return null;
 return {id:s.id,status:s.status,reason:s.reason,message:publicMessage(s.status,s.reason,s.eligible_on),eligible_on:s.eligible_on||null,
 document_type:s.document_type,issuing_country:s.issuing_country,legal_name:s.legal_name==='[deleted]'?'':s.legal_name,
 expected_name:s.status==='name_mismatch'?s.extracted_name:null,
 challenge_id:s.status==='collecting'?s.challenge_id:null,directions:s.status==='collecting'?s.directions:null,
 uploaded:Object.fromEntries(['front','back','selfie','capture'].map(k=>[k,Boolean(s.evidence?.[k])])),
 expires_at:s.expires_at,review_requested:Boolean(s.review_requested_at)};
}
function workerOrigin(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!url.hostname.endsWith('.up.railway.app'))throw new RequestError('Verification is not configured.',503);
 return url.origin;
}
function unbase64(text){const str=atob(text);return Uint8Array.from(str,c=>c.charCodeAt(0));}
export function createHandler({admin,authenticate,fetchImpl=fetch,clock=()=>new Date()}){
 const run=async(query)=>{const {data,error}=await query;if(error){const message=Object.keys(errors).find(k=>String(error.message).includes(k));throw new RequestError(message?errors[message]:'The verification operation could not be completed.',message?409:500);}return data;};
 const transition=(user,id,action,data={})=>run(admin.rpc('ccx_idv_transition',{p_user:user,p_session:id,p_action:action,p_data:data}));
 const getSession=(id,user)=>run(admin.from('ccx_idv_sessions').select('*').eq('id',identifier(id)).eq('user_id',user).maybeSingle());
 const log=(session,actor,action,reason)=>run(admin.from('ccx_idv_events').insert({session_id:session,actor_id:actor,action,reason}));
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
   const multipart=(req.headers.get('Content-Type')||'').startsWith('multipart/form-data;');
   const uploadUser=multipart?await authenticate(req):null;
   if(multipart&&(!uploadUser||uploadUser.is_anonymous))return reply({error:'Sign in to continue.'},401);
   const bytes=await boundedBody(req.body,multipart?MAX_IMAGE+65536:16384);
   let form=null,body;
   if(multipart){form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('Content-Type')}}).formData();body={action:'upload',session_id:form.get('session_id'),kind:form.get('kind')};}
   else {try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new RequestError('Invalid request.');}}
   if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.action!=='string')throw new RequestError('Invalid request.');
   if(body.action==='worker_claim'){
    // The capability is 256 random bits, hashed in Postgres, and consumed once.
    if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'Unauthorized'},401);
    const s=await transition(null,identifier(body.session_id),'claim',{job_hash:await digest(new TextEncoder().encode(body.token))});
    if(!s.user_id)return reply({error:'Account unavailable'},403);
    const evidence={};
    for(const [kind,part] of Object.entries(s.evidence)){
     if(!part.path.startsWith(`${s.user_id}/${s.id}/`))throw new RequestError('Evidence unavailable',503);
     const signed=await run(admin.storage.from(BUCKET).createSignedUrl(part.path,180));
     evidence[kind]={sha256:part.sha256,url:signed.signedUrl};
    }
    return reply({id:s.id,engine_revision:s.engine_revision,document_type:s.document_type,issuing_country:s.issuing_country,challenge_id:s.challenge_id,directions:s.directions,evidence});
   }
   if(body.action==='purge'){
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
    if(!/^[a-f0-9]{64}$/.test(token))return reply({error:'Unauthorized'},401);
    const allowed=await run(admin.rpc('ccx_idv_maintenance_authorized',{p_hash:await digest(new TextEncoder().encode(token))}));
    if(allowed!==true)return reply({error:'Unauthorized'},401);
    const candidates=await run(admin.rpc('ccx_idv_purge_candidates'));
    const paths=(candidates||[]).map(p=>p.path);
    if(paths.length){
     await run(admin.storage.from(BUCKET).remove(paths));
     await run(admin.from('ccx_idv_uploads').delete().in('path',paths));
    }
    await run(admin.rpc('ccx_idv_finish_purge'));
    return reply({removed:paths.length});
   }
   const user=uploadUser||await authenticate(req);
   if(!user||user.is_anonymous)return reply({error:'Sign in to continue.'},401);
   const security=await run(admin.from('account_security').select('admin,banned,suspended').eq('user_id',user.id).maybeSingle());
   if(!security||security.banned||security.suspended)return reply({error:'This account is restricted.'},403);
   if(body.action.startsWith('admin_')){
    if(!security.admin)return reply({error:'Forbidden'},403);
    const admission=await run(admin.from('member_admissions').select('id').eq('user_id',user.id).maybeSingle());
    if(!admission)return reply({error:'Account onboarding required.'},403);
    if(body.action==='admin_list')return reply({sessions:await run(admin.from('ccx_idv_sessions').select('id,user_id,status,reason,review_requested_at,purge_after,purged_at,legal_hold,created_at').order('created_at',{ascending:false}).limit(100))});
    if(body.action==='admin_document'){
     const s=await run(admin.from('ccx_idv_sessions').select('*').eq('id',identifier(body.session_id)).maybeSingle());
     if(!s||s.user_id===user.id)return reply({error:'Independent review is required.'},403);
     if(!['front','back','selfie','capture'].includes(body.kind)||!s.evidence?.[body.kind])throw new RequestError('Document unavailable.',404);
     if(typeof body.reason!=='string'||body.reason.trim().length<10||body.reason.length>500)throw new RequestError('Record the purpose of this access (10–500 characters).');
     await log(s.id,user.id,'admin_document_link_issued',body.reason.trim());
     const signed=await run(admin.storage.from(BUCKET).createSignedUrl(s.evidence[body.kind].path,120));
     return reply({url:signed.signedUrl,expires_in:120});
    }
    throw new RequestError('Unsupported administrative action.');
   }
   const cfg=await run(admin.from('ccx_idv_config').select('*').eq('singleton',true).single());
   if(body.action==='status'){
    const account=await run(admin.from('ccx_idv_accounts').select('legal_name,verified_name,eligible_on').eq('user_id',user.id).maybeSingle());
    const profile=await run(admin.from('member_profiles').select('real_name').eq('id',user.id).maybeSingle());
    const latest=await run(admin.from('ccx_idv_sessions').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle());
    const admitted=await run(admin.from('member_admissions').select('id').eq('user_id',user.id).maybeSingle());
    const today=clock().toISOString().slice(0,10);
    const birthday=account?.eligible_on?new Date(`${account.eligible_on}T00:00:00Z`):null;
    if(birthday)birthday.setUTCDate(birthday.getUTCDate()-1);
    const ageReason=birthday&&today>=birthday.toISOString().slice(0,10)?'birthday_wait':'under_18';
    let session=account?.eligible_on>today?{...publicSession(latest),status:'age_restricted',eligible_on:account.eligible_on,message:publicMessage('age_restricted',ageReason,account.eligible_on)}:publicSession(latest);
    if(session?.status==='age_restricted'&&session.eligible_on<=today)session={...session,status:'eligible_to_retry',message:'You may now complete a new identity verification attempt. Access is not granted automatically.'};
    return reply({enabled:cfg.enabled===true,policy:POLICY,notice:cfg.notice_text,notice_version:cfg.notice_version,retention_days:cfg.retention_days,
     supported_countries:cfg.supported_countries,email_confirmed:Boolean(user.email_confirmed_at),legal_name:account?.verified_name||account?.legal_name||profile?.real_name||'',admitted:Boolean(admitted),session});
   }
   if(!user.email_confirmed_at)return reply({error:'Confirm your email before uploading your ID.'},403);
   if(body.action==='start'){
    if(body.consent!==true)throw new RequestError('Review and accept the verification notice first.');
    if(!TYPES.includes(body.document_type))throw new RequestError('Choose a supported document type.');
    const s=await transition(user.id,crypto.randomUUID(),'start',{legal_name:legalName(body.legal_name),document_type:body.document_type,
     issuing_country:body.issuing_country,consent_version:body.notice_version,consent_hash:await digest(new TextEncoder().encode(cfg.notice_text||''))});
    return reply({session:publicSession(s)});
   }
   if(!['upload','submit','confirm_name','request_review','cancel'].includes(body.action))throw new RequestError('Unknown action.');
   const id=identifier(body.session_id),s=await getSession(id,user.id);
   if(!s)throw new RequestError('Verification session not found.',404);
   if(body.action==='request_review'||body.action==='cancel')return reply({session:publicSession(await transition(user.id,id,body.action))});
   if(!cfg.enabled)throw new RequestError('Verification is not available yet.',503);
   if(body.action==='confirm_name'){
    const name=legalName(body.legal_name);
    if(nameKey(name)!==nameKey(s.extracted_name))throw new RequestError('Enter the full name exactly as printed on your ID.');
    return reply({session:publicSession(await transition(user.id,id,'confirm_name',{legal_name:s.extracted_name}))});
   }
   if(body.action==='upload'){
    if(s.status!=='collecting'||new Date(s.expires_at)<=clock())throw new RequestError('Start a new verification attempt.',409);
    if(!['front','back','capture'].includes(body.kind)||body.kind==='back'&&s.document_type==='passport')throw new RequestError('Invalid upload type.');
    const file=form?.get('file');if(!(file instanceof Blob)||file.size===0)throw new RequestError('Select a file.');
    const raw=new Uint8Array(await file.arrayBuffer()),assets=[];
    if(body.kind==='capture'){
     if(raw.length>MAX_CAPTURE)throw new RequestError('Camera capture is too large.');
     let capture;try{capture=validateCapture(JSON.parse(new TextDecoder().decode(raw)),s);}catch{throw new RequestError('The camera challenge is invalid. Capture again.');}
     const frames=[];const hashes=new Set();
     for(const frame of capture.frames){const b=unbase64(frame.frame_base64);imageMime(b);const hash=await digest(b);if(hashes.has(hash))throw new RequestError('Capture a new live sequence.');hashes.add(hash);frames.push({phase:frame.phase,timestamp:frame.timestamp,frame_base64:frame.frame_base64});}
     const clean={challenge_id:s.challenge_id,challenge_type:'head_turn',directions:s.directions,start_timestamp:capture.start_timestamp,end_timestamp:capture.end_timestamp,frames};
     const first=unbase64(frames[0].frame_base64);
     assets.push(['capture',new TextEncoder().encode(JSON.stringify(clean)),'application/json'],['selfie',first,imageMime(first)]);
    }else assets.push([body.kind,raw,imageMime(raw)]);
    const parts={};
    for(const [kind,data,mime] of assets){
     const hash=await digest(data);
     if(s.evidence?.[kind]){
      if(s.evidence[kind].sha256!==hash)throw new RequestError('Evidence is saved and cannot be replaced. Start a new attempt.',409);
      parts[kind]=s.evidence[kind];continue;
     }
     const path=`${user.id}/${id}/${kind}-${crypto.randomUUID()}.${mime==='application/json'?'json':mime==='image/png'?'png':'jpg'}`;
     // The deletion ledger survives network failures and abandoned sessions.
     await run(admin.from('ccx_idv_uploads').insert({path,session_id:id}));
     await run(admin.storage.from(BUCKET).upload(path,data,{contentType:mime,upsert:false,cacheControl:'0'}));
     parts[kind]={path,sha256:hash,bytes:data.length,content_type:mime};
    }
    return reply({session:publicSession(await transition(user.id,id,'upload',{parts}))});
   }
   // Submit: freeze the evidence, mint a short-lived worker capability, and await
   // a direct HTTPS response. A webhook or browser cannot submit a verdict.
   const origin=workerOrigin(cfg.worker_origin);
   const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
   const jobHash=await digest(new TextEncoder().encode(token));
   const frozen=await transition(user.id,id,'begin',{job_hash:jobHash});
   try{
    const result=await fetchImpl(`${origin}/process`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:id,token}),redirect:'error',signal:AbortSignal.timeout(110000)});
    if(!result.ok)throw new Error('WORKER_UNAVAILABLE');
    const reportBytes=await boundedBody(result.body,512*1024),report=JSON.parse(new TextDecoder().decode(reportBytes));
    const decision=decide(report,frozen,clock().toISOString().slice(0,10));
    const passed=['approved','name_mismatch','age_restricted'].includes(decision.status);
    const completed=await transition(user.id,id,'finish',{job_hash:jobHash,report_hash:await digest(reportBytes),checks_passed:passed,reason:decision.reason,
     ...(passed?{extracted_name:decision.legal_name,dob:decision.dob,document_expiry:report.document.expiry,document_number:report.document.number,model_manifest:report.model_manifest||{}}:{})});
    return reply({session:publicSession(completed)});
   }catch{
    const current=await transition(user.id,id,'fail',{job_hash:jobHash});
    return reply({session:publicSession(current)});
   }
  }catch(error){
   if(error instanceof RequestError)return reply({error:error.message},error.status);
   // Deliberately do not log requests, image bytes, OCR, names, DOBs or credentials.
   return reply({error:'Verification could not be completed. Check your connection and try again.'},500);
  }
 };
}
