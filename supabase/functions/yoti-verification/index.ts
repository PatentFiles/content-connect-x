/** Yoti-only onboarding: server-created Doc Scan and server-fetched proof.
 * No ID/selfie bytes or arbitrary provider callbacks enter this handler.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {buildDocScanSession,evaluateDocScanResult} from '../ccx-integrations/yotiDocScanPolicy.mjs';
import {getYotiReturnOrigin} from '../ccx-integrations/yotiPolicy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(v:unknown,s=200)=>Response.json(v,{status:s,headers:cors});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return reply({error:'Service unavailable'},503);
 try{
  const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return reply({error:'Sign in required'},401);
  const body=await req.json().catch(()=>null);
  if(!body||!['yoti_start','yoti_status','yoti_readiness'].includes(body.action))return reply({error:'Invalid request'},400);
  const db=createClient(url,service),uid=user.id;
  const {data:security,error:securityError}=await db.from('account_security').select('banned,suspended').eq('user_id',uid).maybeSingle();
  if(securityError||!security)return reply({error:'Account status unavailable'},503);
  if(security.banned||security.suspended)return reply({error:'Account restricted'},403);
  const {data:settings,error:configError}=await db.from('ccx_integrations').select('enabled,callback_origin,secondary_origin').eq('provider','yoti').maybeSingle();
  if(configError)return reply({error:'Verification configuration unavailable'},503);
  // Supabase Edge secrets only; credentials and their values never go to the browser.
  const token=Deno.env.get('YOTI_API_KEY')||'',sdk=Deno.env.get('YOTI_SDK_ID')||'';
  const origin=getYotiReturnOrigin(settings,body.brand||'content_connect');
  const ready=Boolean(token&&uuid(sdk)&&settings?.enabled&&origin);
  if(body.action==='yoti_readiness')return reply({yoti_configured:ready});
  const {data:sessions,error:sessionError}=await db.from('ccx_age_provider_sessions')
   .select('id,provider_session_id,reference_id,mode,status,method,expires_at,confirmed_at')
   .eq('user_id',uid).eq('mode','age_gate').eq('policy_version','document_selfie_v1').order('created_at',{ascending:false}).limit(1);
  if(sessionError)return reply({error:'Verification status unavailable'},503);
  const latest=sessions?.[0];
  if(body.action==='yoti_status'&&(!latest||!body.refresh||!['pending','processing','provider_error'].includes(latest.status)))
   return reply(latest?{status:latest.status,method:latest.method,confirmed_at:latest.confirmed_at}:{status:'not_started'});
  if(!ready)return reply({error:'Yoti verification is temporarily unavailable. Your account is saved.'},503);
  const request=async(method:string,id:string|null,payload?:unknown)=>{
   const res=await fetch('https://age.yoti.com/api/v1/sessions'+(id?'/'+encodeURIComponent(id)+'/result':''),{
    method,headers:{Authorization:'Bearer '+token,'Yoti-SDK-Id':sdk,'Content-Type':'application/json'},
    ...(payload?{body:JSON.stringify(payload)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!res.ok)throw Error('Yoti request unsuccessful ('+res.status+'). Please try again.');
   return await res.json();
  };
  if(body.action==='yoti_start'){
   // Reuse a still-pending provider session, avoiding duplicate billable starts.
   if(latest&&['pending','processing'].includes(latest.status)&&Date.parse(latest.expires_at)>Date.now())
    return reply({url:'https://age.yoti.com?sessionId='+encodeURIComponent(latest.provider_session_id)+'&sdkId='+encodeURIComponent(sdk),resumed:true});
   const {data:allowed,error:rateError}=await db.rpc('ccx_reserve_yoti_start',{p_user:uid});
   if(rateError)return reply({error:'Verification availability could not be checked'},503);
   if(!allowed)return reply({error:'Verification retry limit reached. Try again later.'},429);
   const reference=crypto.randomUUID();
   const result=await request('POST',null,buildDocScanSession(reference,origin));
   if(!uuid(result.id)||!Number.isFinite(Date.parse(result.expires_at)))throw Error('Invalid verification session');
   const {error}=await db.from('ccx_age_provider_sessions').insert({user_id:uid,provider_session_id:result.id,reference_id:reference,
    mode:'age_gate',policy_version:'document_selfie_v1',status:'pending',expires_at:result.expires_at});
   if(error)throw Error('Verification session could not be saved. Please retry.');
   return reply({url:'https://age.yoti.com?sessionId='+encodeURIComponent(result.id)+'&sdkId='+encodeURIComponent(sdk)},201);
  }
  const result=await request('GET',latest.provider_session_id);
  const evaluated=evaluateDocScanResult(result,{sessionId:latest.provider_session_id,reference:latest.reference_id,sdkId:sdk});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(result)))),x=>x.toString(16).padStart(2,'0')).join('');
  const {data:saved,error:saveError}=await db.rpc('ccx_finish_yoti_session',{p_user:uid,p_session:latest.id,p_status:evaluated.status,
   p_method:evaluated.method,p_evidence:typeof result.evidence_id==='string'?result.evidence_id:null,p_hash:hash});
  if(saveError)throw Error('Verification result could not be saved; retry checking status.');
  return reply(saved);
 }catch(error){
  // Do not log provider response bodies, personal document data, API keys or tokens.
  return reply({error:error instanceof Error?error.message:'Verification unavailable'},503);
 }
});
