/**
 * CCX integration control plane:
 * - staff-only MFA-gated server-side Supabase Vault secrets (never returned);
 * - Yoti hosted Age Verification Service (not DIY face recognition);
 * - PASS linking + privacy-preserving, explicit per-collaboration status sharing;
 * - OnlyHost independent access identity for same Supabase property database.
 * No unsupported PASS API protocol is invented. No lab reports are returned here.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {getYotiReturnOrigin,isYotiConfigured} from './yotiPolicy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS'};
const out=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{...cors,'Cache-Control':'no-store'}});
const bad=(msg:string,s=400)=>out({error:msg},s);
const id=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const txt=(v:unknown,n=300)=>typeof v==='string'?v.trim().slice(0,n):'';
const secretFields:Record<string,string[]>={
 yoti:['yoti_token','yoti_sdk_id'],pass:['pass_partner_token'],ccbill:['ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt'],
 docusign:['docusign_account_id','docusign_integration_key','docusign_private_key','docusign_hmac'],
 email:['email_api_token','email_sender'],webpush:['webpush_vapid_private'],maps:['maps_server_key'],
 openmoderate:['openmoderate_api_key'],sentry:['sentry_dsn'],flagsmith:['flagsmith_environment']
};
const verified=(row:any)=>row?.status==='approved'&&(!row.expires_at||Date.parse(row.expires_at)>Date.now());
const assurance=(header:string)=>{
 try{const part=header.replace(/^Bearer\s+/i,'').split('.')[1],b=part.replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(atob(b.padEnd(Math.ceil(b.length/4)*4,'=')))?.aal==='aal2';}
 catch{return false;}
};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return bad('POST required',405);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key||!service)return bad('Service unavailable',503);
 const header=req.headers.get('Authorization')||'',client=createClient(url,key,{global:{headers:{Authorization:header}}});
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return bad('Sign in required',401);
 const db=createClient(url,service),uid=user.id;
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object')return bad('Invalid JSON');
 const action=txt(body.action,70);
 const [sec,ages]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1)
 ]);
 if(sec.error||ages.error)return bad('Cannot verify access',503);
 const admin=sec.data?.admin===true;
 if(sec.data?.banned||sec.data?.suspended){
  if(!['pass_disconnect','pass_revoke','pass_link_status'].includes(action))return bad('Account restricted',403);
 }
 const adminAction=action.startsWith('admin_');
 if(adminAction&&(!admin||!assurance(header)))return bad('Administrator MFA required',403);
 // New sensitive operations respect the Testing module flag. Existing documents,
 // medical data access, withdrawal of consent and admin review remain available.
 if(['clearance_upload_token','clearance_submit','pass_link','pass_share'].includes(action)){
  if(!verified(ages.data?.[0]))return bad('Approved age verification required',403);
  const {data:flag,error:flagError}=await db.from('product_feature_flags')
   .select('enabled,allowed_tiers,rollout_percent').eq('key','testing').maybeSingle();
  const {data:sub,error:subError}=await db.from('member_subscriptions')
   .select('status,period_end').eq('user_id',uid).maybeSingle();
  if(subError)return bad('Membership status unavailable',503);
  const premium=admin||(['active','trial'].includes(sub?.status)&&
   (!sub?.period_end||Date.parse(sub.period_end)>Date.now()));
  if(flagError||!flag?.enabled||!flag.allowed_tiers?.includes(premium?'premium':'free'))
   return bad('Testing module is currently disabled',403);
  let hash=0;for(const char of uid+'testing')hash=(hash*31+char.charCodeAt(0))>>>0;
  if(hash%100>=flag.rollout_percent)return bad('Testing module is not enabled for this account',403);
 }
 const audit=async(what:string,target:string|null=null)=>{
  await db.from('platform_action_audit').insert({actor_id:uid,action:what,target_type:'integration',target_id:id(target)?target:null});
 };
 const notifyOptedInCollaborators=async(person:string)=>{
  // Neutral event: does not reveal diagnosis, report contents or even a positive
  // clearance result. Collaborators must separately query consented status.
  const {data:participations,error:membershipError}=await db.from('collaboration_members')
    .select('collaboration_id').eq('user_id',person).limit(100);
  if(membershipError)throw membershipError;
  for(const member of participations||[]){
    const {data:share}=await db.from('ccx_clearance_share_consents')
      .select('revoked_at').eq('collaboration_id',member.collaboration_id)
      .eq('user_id',person).maybeSingle();
    if(!share||share.revoked_at)continue;
    const {data:team}=await db.from('collaboration_members')
      .select('user_id').eq('collaboration_id',member.collaboration_id).limit(25);
    for(const teammate of team||[]){
      if(teammate.user_id===person)continue;
      await db.from('member_notifications').insert({
       recipient_id:teammate.user_id,kind:'work_clearance_update',
       title:'A collaboration readiness status was updated',
       details:{collaboration_id:member.collaboration_id}
      });
    }
  }
 };
 const conf=async(provider:string)=>{
  const {data,error}=await db.from('ccx_integrations').select('provider,enabled,setup_status,notes,callback_origin,secondary_origin,updated_at')
   .eq('provider',provider).maybeSingle();
  if(error)throw error;return data;
 };
 const getSecret=async(name:string)=>{
  const {data,error}=await db.rpc('ccx_secret_get',{p_name:name});
  if(error)throw error;return typeof data==='string'?data:null;
 };
 const yotiReady=async()=>{
  const [token,sdk,setting]=await Promise.all([getSecret('yoti_token'),getSecret('yoti_sdk_id'),conf('yoti')]);
  return {token,sdk,setting,ready:Boolean(token&&sdk&&setting?.enabled)};
 };
 const yotiRequest=async(method:string,session:string|null,data?:object)=>{
  const cfg=await yotiReady();
  if(!cfg.ready)throw Error('Yoti is not connected or enabled');
  const endpoint='https://age.yoti.com/api/v1/sessions'+(session?'/'+encodeURIComponent(session)+'/result':'');
  const response=await fetch(endpoint,{
   method,headers:{'Authorization':'Bearer '+cfg.token,
    'Yoti-Sdk-Id':cfg.sdk!,'Content-Type':'application/json','Accept':'application/json'},
   ...(data?{body:JSON.stringify(data)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw Error('Yoti session request failed; HTTP '+response.status);
  return await response.json();
 };
 try{
 switch(action){
 case 'admin_list':{
  const {data,error}=await db.from('ccx_integrations')
   .select('provider,enabled,setup_status,notes,callback_origin,secondary_origin,updated_at').order('provider');
  if(error)throw error;
  return out({providers:await Promise.all((data||[]).map(async p=>({
    ...p,fields:await Promise.all((secretFields[p.provider]||[]).map(async name=>({
     name,configured:Boolean(await getSecret(name))
    })))
   })))});
 }
 case 'admin_yoti_origins':{
  const validate=(value:unknown)=>{
   if(value===null||value==='')return null;
   if(typeof value!=='string'||value.length>240)throw Error('Origin too long');
   const u=new URL(value);
   if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
      u.port&&u.port!=='443'||u.pathname!=='/'||
      !u.hostname.includes('.')||u.hostname==='localhost')throw Error('Use an HTTPS production origin without paths or credentials');
   return u.origin;
  };
  let ccx:string|null=null,onlyhost:string|null=null;
  try{ccx=validate(body.ccx_origin);onlyhost=validate(body.onlyhost_origin);}
  catch{return bad('Provide valid HTTPS origins for both brands',400);}
  if(!ccx)return bad('Content Connect X return origin is required');
  const {data,error}=await db.from('ccx_integrations').update({
   callback_origin:ccx,secondary_origin:onlyhost,updated_by:uid,updated_at:new Date().toISOString()
  }).eq('provider','yoti').select('callback_origin,secondary_origin').single();
  if(error)throw error;await audit('ccx_yoti_return_origins_saved');
  return out({item:data,note:'Yoti return origins saved. Your provider must also allow these URLs.'});
 }
 case 'admin_set_secret':{
  const provider=txt(body.provider,32),name=txt(body.name,70),value=body.secret;
  if(!secretFields[provider]?.includes(name)||typeof value!=='string'||value.trim().length<4||value.length>8192)
   return bad('Provider, named key and nonempty secret are required');
  const {data,error}=await db.rpc('ccx_secret_set',{p_name:name,p_secret:value});
  if(error||!data)throw Error('Could not encrypt API credential');
  await db.from('ccx_integrations').update({
   setup_status:provider==='pass'?'awaiting_partner':'credentials_stored',updated_by:uid,updated_at:new Date().toISOString()
  }).eq('provider',provider);
  await audit('ccx_integration_secret_updated');
  return out({ok:true,configured:true,note:'Credential stored encrypted in Supabase Vault. No secret value is returned.'});
 }
 case 'admin_provider_settings':{
  const provider=txt(body.provider,32),on=body.enabled===true;
  if(!secretFields[provider])return bad('Unsupported provider');
  if(on&&body.provider_contract_reviewed!==true)return bad('Confirm the provider contract and supported use before activation',409);
  if(on&&provider==='pass')return bad('PASS API requires approved partner access and documented protocol; no public API has been verified',409);
  if(on&&provider==='yoti'){
   const cfg=await yotiReady();
   if(!isYotiConfigured({
     enabled:true,token:cfg.token,sdk:cfg.sdk,callback_origin:cfg.setting?.callback_origin
   })) return bad('Yoti activation requires API token, SDK ID and the trusted Content Connect X HTTPS return origin',409);
  }
  const {data,error}=await db.from('ccx_integrations').update({
   enabled:on,notes:txt(body.notes,400),updated_by:uid,updated_at:new Date().toISOString()
  }).eq('provider',provider).select('provider,enabled,setup_status,notes').maybeSingle();
  if(error||!data)throw Error('Integration setting unavailable');
  await audit('ccx_integration_state_changed');
  return out({item:data,note:'The configuration is saved. Provider readiness still needs live acceptance tests.'});
 }
 case 'status':{
  const [yoti,pass]=await Promise.all([yotiReady(),conf('pass')]);
  const available=isYotiConfigured({
    enabled:yoti.setting?.enabled,token:yoti.token,sdk:yoti.sdk,
    callback_origin:yoti.setting?.callback_origin
  });
  return out({yoti_configured:available,pass_partner_connected:pass?.enabled===true,
   yoti_note:'Provider age checks are not sufficient to establish performer identity without additional evidence review.',
   pass_note:'PASS partner access remains unverified. Only approved clearance status, never laboratory results, may be shared.'});
 }
 case 'yoti_start':{
  const mode=body.mode==='performer_identity'?'performer_identity':'age_gate';
  const cfg=await yotiReady();
  if(!cfg.ready)return bad('Yoti is not configured. Use manual ID verification until onboarding is complete.',503);
  // Select by brand using trusted server config. Never send OnlyHost users
  // back to CCX because their brand's origin is missing or misconfigured.
  const trustedOrigin=getYotiReturnOrigin(cfg.setting,body.brand);
  if(!trustedOrigin)return bad(body.brand==='onlyhost'
    ? 'OnlyHost HTTPS Yoti return origin must be configured first'
    : 'Content Connect X HTTPS Yoti return origin must be configured first',503);
  const {data:prior}=await db.from('ccx_age_provider_sessions').select('id')
   .eq('user_id',uid).gte('created_at',new Date(Date.now()-3600000).toISOString()).limit(5);
  if(prior&&prior.length>=5)return bad('Verification retry limit reached; try again later',429);
  const reference=crypto.randomUUID();
  const isID=mode==='performer_identity';
  const payload={
   type:'OVER',ttl:900,reference_id:reference,synchronous_checks:true,
   age_estimation:{allowed:!isID,threshold:21,retry_limit:2,level:'PASSIVE',authenticity:'AUTO'},
   digital_id:{allowed:!isID,threshold:18,age_estimation_allowed:false,retry_limit:2},
   doc_scan:{allowed:true,threshold:18,retry_limit:2,level:'PASSIVE',authenticity:'AUTO',synchronous_checks:true},
   credit_card:{allowed:false},mobile:{allowed:false},
   callback:{auto:true,url:trustedOrigin+'/?age_verification=complete'},
   cancel_url:trustedOrigin+'/?age_verification=cancelled',
   block_biometric_consent:false
  };
  const response=await yotiRequest('POST',null,payload);
  if(!id(response.id)||!response.expires_at)return bad('Provider returned an invalid session',503);
  const {data,error}=await db.from('ccx_age_provider_sessions').insert({
   user_id:uid,provider_session_id:response.id,reference_id:reference,mode,
   expires_at:response.expires_at,status:'pending'
  }).select('id').single();
  if(error)throw error;
  const view='https://age.yoti.com?sessionId='+encodeURIComponent(response.id)+'&sdkId='+encodeURIComponent(cfg.sdk!);
  return out({session_id:data.id,url:view,note:'Complete verification on Yoti. Performer identity requires separate document review.'},201);
 }
 case 'yoti_status':{
  const {data,error}=await db.from('ccx_age_provider_sessions')
   .select('id,mode,status,method,expires_at,confirmed_at,provider_session_id,reference_id')
   .eq('user_id',uid).order('created_at',{ascending:false}).limit(1);
  if(error)throw error;
  const latest=data?.[0];
  if(!latest)return out({status:'not_started'});
  if(!body.refresh||!['pending','processing','provider_error'].includes(latest.status))
   return out({status:latest.status,mode:latest.mode,method:latest.method,confirmed_at:latest.confirmed_at});
  if(Date.parse(latest.expires_at)<Date.now()){
   await db.from('ccx_age_provider_sessions').update({status:'expired'}).eq('id',latest.id);
   return out({status:'expired'});
  }
  const result=await yotiRequest('GET',latest.provider_session_id);
  if(result.id!==latest.provider_session_id||result.reference_id!==latest.reference_id||result.type!=='OVER')
   return bad('Yoti session identity did not match',503);
  let status='processing';
  if(result.status==='COMPLETE'){
   // Age Verification Service proves only an over-age result, not professional
   // identity or documentary compliance. Never auto-mark creator identity verified.
   status=latest.mode==='performer_identity'?'review_required':'age_confirmed';
  }else if(['FAIL','CANCELLED'].includes(result.status))status='rejected';
  else if(result.status==='ERROR')status='provider_error';
  const {error:saveError}=await db.from('ccx_age_provider_sessions').update({
   status,method:txt(result.method,70)||null,
   confirmed_at:result.status==='COMPLETE'?new Date().toISOString():null
  }).eq('id',latest.id);
  if(saveError)throw saveError;
  await audit('ccx_yoti_session_checked',latest.id);
  return out({status,mode:latest.mode,method:txt(result.method,70)||null,
   identity_verified:false,note:status==='review_required'?'Over-18 confirmed; performer identity requires independent reviewer approval.':'Yoti status retrieved directly from provider.'});
 }
 case 'onlyhost_register':{
  if(body.accept_terms!==true)return bad('You must accept the hosting marketplace terms',400);
  const {data,error}=await db.from('onlyhost_accounts')
   .upsert({user_id:uid,status:'active',agreed_to_hosting_terms_at:new Date().toISOString()},
    {onConflict:'user_id'}).select('status,created_at').single();
  if(error)throw error;
  await audit('onlyhost_account_joined');
  return out({item:data,note:'OnlyHost account enabled; renting still requires independent adult verification and accepted venue rules.'});
 }
 case 'onlyhost_status':{
  const {data,error}=await db.from('onlyhost_accounts')
   .select('status,created_at').eq('user_id',uid).maybeSingle();
  if(error)throw error;
  return out({registered:data?.status==='active',status:data?.status||'not_registered',
   age_verified:verified(ages.data?.[0])});
 }
 case 'clearance_upload_token':{
  if(!verified(ages.data?.[0]))return bad('Age verification required',403);
  const type=txt(body.mime_type,80);
  const extension={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];
  if(!extension)return bad('PDF, JPEG, PNG or WebP required',400);
  const path=uid+'/clearance/'+crypto.randomUUID()+'.'+extension;
  const {data,error}=await db.storage.from('ccx-private-clearance').createSignedUploadUrl(path);
  if(error)throw error;
  return out({path,token:data.token});
 }
 case 'clearance_submit':{
  if(!verified(ages.data?.[0]))return bad('Age verification required',403);
  const path=txt(body.path,600);
  if(!path.startsWith(uid+'/clearance/')||path.includes('..'))return bad('Invalid private testing document',403);
  const {data:info,error:fileError}=await db.storage.from('ccx-private-clearance').info(path);
  if(fileError||!info)return bad('Private document not found',404);
  const {data,error}=await db.from('ccx_clearance_document_submissions')
   .insert({user_id:uid,storage_path:path,status:'pending'})
   .select('id,status').single();
  if(error)throw error;
  await audit('ccx_private_clearance_document_submitted',data.id);
  return out({item:data,note:'Private evidence received for professional review. This does not automatically establish work clearance.'},201);
 }
 case 'clearance_documents_mine':{
  const {data,error}=await db.from('ccx_clearance_document_submissions')
   .select('id,status,created_at,reviewed_at,review_note').eq('user_id',uid).order('created_at',{ascending:false}).limit(50);
  if(error)throw error;return out({items:data||[]});
 }
 case 'admin_clearance_queue':{
  const {data,error}=await db.from('ccx_clearance_document_submissions')
   .select('id,user_id,status,created_at').in('status',['pending','under_review'])
   .order('created_at',{ascending:true}).limit(70);
  if(error)throw error;return out({items:data||[]});
 }
 case 'admin_clearance_document':{
  if(!id(body.id))return bad('Submission required',400);
  const {data:submission}=await db.from('ccx_clearance_document_submissions')
   .select('storage_path,user_id').eq('id',body.id).maybeSingle();
  if(!submission||submission.user_id===uid)return bad('Independent review required',403);
  const {data,error}=await db.storage.from('ccx-private-clearance').createSignedUrl(submission.storage_path,90);
  if(error)throw error;await audit('ccx_private_clearance_document_opened',body.id);
  return out({url:data.signedUrl,expires_in:90});
 }
 case 'admin_clearance_review':{
  if(!id(body.id)||!['rejected','verified_offsite'].includes(body.decision))
   return bad('Invalid clearance-document review',400);
  const {data:submission}=await db.from('ccx_clearance_document_submissions')
   .select('id,user_id,status').eq('id',body.id).maybeSingle();
  if(!submission||submission.user_id===uid||!['pending','under_review'].includes(submission.status))
   return bad('Cannot review this submission',403);
  if(body.decision==='verified_offsite'&&body.independent_provider_confirmation!==true)
   return bad('Obtain independent confirmation from a qualified testing provider; a PDF alone is not sufficient',409);
  const now=new Date(),collected=new Date(body.sample_collected_on);
  if(body.decision==='verified_offsite'&&(!Number.isFinite(collected.getTime())||collected>now||now.getTime()-collected.getTime()>14*86400000))
   return bad('Sample collection must be within 14 days',409);
  const {data,error}=await db.from('ccx_clearance_document_submissions').update({
   status:body.decision,reviewed_by:uid,reviewed_at:now.toISOString(),review_note:txt(body.review_note,500)
  }).eq('id',submission.id).in('status',['pending','under_review']).select('id,user_id,status').maybeSingle();
  if(error||!data)return bad('Review conflict',409);
  if(body.decision==='verified_offsite'){
   const expires=new Date(collected.getTime()+14*86400000);
   const {error:writeError}=await db.from('performer_work_clearances').upsert({
    user_id:submission.user_id,clearance_confirmed:true,
    provider:'manual_provider_confirmation',provider_reference:'manual:'+submission.id,
    confirmed_at:now.toISOString(),expires_at:expires.toISOString(),reviewed_by:uid,updated_at:now.toISOString()
   },{onConflict:'user_id'});
   if(writeError)throw writeError;
   await db.from('ccx_clearance_events').insert({
    user_id:submission.user_id,source:'manual_admin',clearance_confirmed:true,
    expires_at:expires.toISOString()
   });
   await notifyOptedInCollaborators(submission.user_id);
  }
  await audit('ccx_private_clearance_document_reviewed',submission.id);
  await db.from('member_notifications').insert({
   recipient_id:submission.user_id,kind:'work_clearance_update',
   title:'Your private work-clearance review was updated',details:{submission_id:submission.id}
  });
  return out({item:data,note:'Only clearance status is shared after participant consent. Clinical diagnoses stay private.'});
 }
 case 'pass_link':{
  if(body.allow_status_sync!==true)return bad('Explicit opt-in required',400);
  if(!verified(ages.data?.[0]))return bad('Verified account required',403);
  const cfg=await conf('pass');
  const {data,error}=await db.from('ccx_pass_links').upsert({
   user_id:uid,status:cfg?.enabled?'pending_confirmation':'awaiting_partner',
   requested_at:new Date().toISOString(),consented_at:new Date().toISOString()
  },{onConflict:'user_id'}).select('status,requested_at').single();
  if(error)throw error;
  await audit('ccx_pass_link_requested');
  return out({item:data,note:'Link requested. PASS does not provide a confirmed public API; connection is pending partner onboarding.'});
 }
 case 'pass_my_clearance':{
  // Read only the authenticated performer's work-availability state.
  // Never return laboratory results, medical diagnoses or private PDF URLs.
  const {data,error}=await db.from('performer_work_clearances')
   .select('clearance_confirmed,expires_at,provider,confirmed_at').eq('user_id',uid).maybeSingle();
  if(error)throw error;
  const current=Boolean(data?.clearance_confirmed&&data?.expires_at&&Date.parse(data.expires_at)>Date.now());
  return out({status:current?'current':'not_current',
   expires_at:current?data.expires_at:null,
   source:current?(data.provider==='pass'?'pass':'independent_provider_review'):null});
 }
 case 'pass_my_collaborations':{
  const {data:members,error:membershipError}=await db.from('collaboration_members')
   .select('collaboration_id').eq('user_id',uid).limit(100);
  if(membershipError)throw membershipError;
  const ids=(members||[]).map((item:any)=>item.collaboration_id);
  if(!ids.length)return out({items:[]});
  const {data,error}=await db.from('collaborations')
   .select('id,title,status').in('id',ids).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  return out({items:data||[]});
 }
 case 'pass_link_status':{
  const {data,error}=await db.from('ccx_pass_links')
   .select('status,consented_at,last_sync_at').eq('user_id',uid).maybeSingle();
  if(error)throw error;return out({item:data||{status:'not_linked'}});
 }
 case 'pass_disconnect':{
  const {error}=await db.from('ccx_pass_links').update({status:'revoked',consented_at:null})
   .eq('user_id',uid);
  if(error)throw error;
  await audit('ccx_pass_link_revoked');
  return out({ok:true});
 }
 case 'pass_share':
 case 'pass_revoke':{
  const collaborationId=body.collaboration_id;
  if(!id(collaborationId))return bad('Collaboration ID required',400);
  const {data:member,error}=await db.from('collaboration_members')
   .select('user_id').eq('collaboration_id',collaborationId).eq('user_id',uid).maybeSingle();
  if(error||!member)return bad('You are not a collaboration participant',403);
  if(action==='pass_revoke'){
   await db.from('ccx_clearance_share_consents').update({revoked_at:new Date().toISOString()})
    .eq('collaboration_id',collaborationId).eq('user_id',uid);
   await audit('ccx_clearance_share_withdrawn',collaborationId);
   await notifyOptedInCollaborators(uid);return out({shared:false});
  }
  if(body.allow_binary_clearance_share!==true)return bad('Explicit permission to share work-clearance status is required',400);
  const {error:saveError}=await db.from('ccx_clearance_share_consents').upsert({
   collaboration_id:collaborationId,user_id:uid,consented_at:new Date().toISOString(),revoked_at:null
  },{onConflict:'collaboration_id,user_id'});
  if(saveError)throw saveError;
  await audit('ccx_clearance_share_granted',collaborationId);
  await notifyOptedInCollaborators(uid);
  return out({shared:true});
 }
 case 'pass_collaboration_status':{
  if(!id(body.collaboration_id))return bad('Collaboration required');
  const idCollab=body.collaboration_id;
  const {data:member}=await db.from('collaboration_members')
   .select('user_id').eq('collaboration_id',idCollab).eq('user_id',uid).maybeSingle();
  if(!member)return bad('Not a collaboration member',403);
  const [members,consents,clearances,hold]=await Promise.all([
   db.from('collaboration_members').select('user_id').eq('collaboration_id',idCollab),
   db.from('ccx_clearance_share_consents').select('user_id,revoked_at').eq('collaboration_id',idCollab),
   db.from('performer_work_clearances').select('user_id,clearance_confirmed,expires_at,provider').in('user_id', (await db.from('collaboration_members').select('user_id').eq('collaboration_id',idCollab)).data?.map((m:any)=>m.user_id)||[]),
   db.from('ccx_integrations').select('enabled').eq('provider','pass').maybeSingle()
  ]);
  if(members.error||consents.error||clearances.error||hold.error)return bad('Provider status unavailable',503);
  const opted=new Set((consents.data||[]).filter((v:any)=>!v.revoked_at).map((v:any)=>v.user_id));
  const all=(members.data||[]).map((v:any)=>{
   const userId=v.user_id;
   const source=(clearances.data||[]).find((x:any)=>x.user_id===userId);
   const allowed=opted.has(userId);
   const current=Boolean(source?.clearance_confirmed&&source.expires_at&&Date.parse(source.expires_at)>Date.now());
   return {user_id:userId,sharing:allowed,
    clearance:allowed?(current?'current':'not_current'):'not_shared',
    // No lab diagnosis, test panel or medical PDF is ever disclosed.
    provider:allowed&&source?.provider==='pass'?'PASS':null};
  });
  return out({members:all,ready:all.length>0&&all.every((v:any)=>v.sharing&&v.clearance==='current'),
   checked_at:new Date().toISOString(),
   production_hold_unknown:hold.data?.enabled!==true,
   note:'Only binary work-clearance status is visible after each performer opts in. PASS production holds are not automatically monitored without an approved partner API.'});
 }
 default:return bad('Unknown action',404);
 }
 }catch(error){console.error('ccx integrations',action,String(error).slice(0,200));return bad('Provider operation unavailable',503);}
});
