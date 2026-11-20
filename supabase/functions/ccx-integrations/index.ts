/**
 * CCX integration control plane:
 * - staff-only server-side Supabase Vault secrets (never returned);
 * - first-party Railway identity verification handled by an isolated server;
 * - PASS linking + privacy-preserving, explicit per-collaboration status sharing;
 * - OnlyHost independent access identity for same Supabase property database.
 * No unsupported PASS API protocol is invented. No lab reports are returned here.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS'};
const out=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{...cors,'Cache-Control':'no-store'}});
const bad=(msg:string,s=400)=>out({error:msg},s);
const id=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const txt=(v:unknown,n=300)=>typeof v==='string'?v.trim().slice(0,n):'';
const secretFields:Record<string,string[]>={
 pass:['pass_partner_token'],ccbill:['ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt','ccbill_relay_secret','ccbill_event_timezone'],
 docusign:['docusign_account_id','docusign_integration_key','docusign_user_id','docusign_private_key','docusign_hmac'],
 email:['email_api_token','email_sender'],webpush:['webpush_vapid_private'],maps:['maps_server_key'],
 openmoderate:['openmoderate_api_key'],sentry:['sentry_dsn'],flagsmith:['flagsmith_environment']
};
const verified=(row:any)=>row?.status==='approved'&&(!row.expires_at||Date.parse(row.expires_at)>Date.now());
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
 const [sec,ages,admission]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('member_admissions').select('admitted_at').eq('user_id',uid).maybeSingle()
 ]);
 if(sec.error||ages.error||admission.error)return bad('Cannot verify access',503);
 const admin=sec.data?.admin===true;
 if(sec.data?.banned||sec.data?.suspended){
  if(!['pass_disconnect','pass_revoke','pass_link_status'].includes(action))return bad('Account restricted',403);
 }
 const adminAction=action.startsWith('admin_');
 if(adminAction&&(!admin||!admission.data?.admitted_at))return bad('Administrator access required',403);
 // New sensitive operations respect the Testing module flag. Existing documents,
 // medical data access, withdrawal of consent and admin review remain available.
 if(['clearance_upload_token','clearance_submit','pass_link','pass_share'].includes(action)){
  if(!admission.data?.admitted_at)return bad('Complete account onboarding first',403);
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

 try{
 switch(action){
 case 'admin_list':{
  const {data,error}=await db.from('ccx_integrations')
   .select('provider,enabled,setup_status,notes,callback_origin,secondary_origin,updated_at').neq('provider','yoti').order('provider');
  if(error)throw error;
  return out({providers:await Promise.all((data||[]).map(async p=>({
    ...p,fields:await Promise.all((secretFields[p.provider]||[]).map(async name=>({
     name,configured:Boolean(await getSecret(name))
    })))
   })))});
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
  const {data,error}=await db.from('ccx_integrations').update({
   enabled:on,notes:txt(body.notes,400),updated_by:uid,updated_at:new Date().toISOString()
  }).eq('provider',provider).select('provider,enabled,setup_status,notes').maybeSingle();
  if(error||!data)throw Error('Integration setting unavailable');
  await audit('ccx_integration_state_changed');
  return out({item:data,note:'The configuration is saved. Provider readiness still needs live acceptance tests.'});
 }
 case 'status':{
  const pass=await conf('pass');
  return out({identity_provider:'first_party_railway',pass_partner_connected:pass?.enabled===true,
   pass_note:'PASS partner access remains unverified. Only approved clearance status, never laboratory results, may be shared.'});
 }
 case 'onlyhost_register':{
  // Host-only registrations do NOT grant creator or performer privileges.
  const version='host-2026-11-17';
  if(body.accept_terms!==true||body.terms_version!==version||
     body.legal_capacity_confirmed!==true||body.property_authority_confirmed!==true||
     body.adult_production_understood!==true)
    return bad('Review the current host agreement and confirm legal capacity, property authority and adult-production awareness',400);
  const {data:prior,error:priorError}=await db.from('onlyhost_accounts')
   .select('status').eq('user_id',uid).maybeSingle();
  if(priorError)return bad('Host account unavailable',503);
  if(prior?.status==='suspended'||prior?.status==='deleted')return bad('This host account cannot be reactivated without support review',403);
  const now=new Date().toISOString();
  const {data,error}=await db.from('onlyhost_accounts').upsert({
   user_id:uid,status:'active',agreed_to_hosting_terms_at:now,
   terms_accepted_at:now,terms_version:version,
   legal_capacity_confirmed:true,property_authority_confirmed:true,
   adult_production_understood:true
  },{onConflict:'user_id'}).select('status,created_at,terms_version,terms_accepted_at').single();
  if(error)throw error;
  await audit('onlyhost_host_terms_accepted');
  return out({item:data,note:'Host account enabled. Property proof, permitted-use review and required approvals are still necessary before publication.'});
 }
 case 'onlyhost_status':{
  const {data,error}=await db.from('onlyhost_accounts')
   .select('status,created_at,terms_version,terms_accepted_at,legal_capacity_confirmed,property_authority_confirmed,adult_production_understood')
   .eq('user_id',uid).maybeSingle();
  if(error)return bad('Host account unavailable',503);
  const current=data?.status==='active'&&data.terms_version==='host-2026-11-17'&&
    data.legal_capacity_confirmed===true&&data.property_authority_confirmed===true&&data.adult_production_understood===true;
  return out({registered:data?.status==='active',status:data?.status||'not_registered',
   host_terms_current:Boolean(current),terms_version:data?.terms_version||null,
   terms_accepted_at:data?.terms_accepted_at||null,
   age_verified:verified(ages.data?.[0])});
 }
 case 'clearance_upload_token':{
  if(!admission.data?.admitted_at)return bad('Complete account onboarding first',403);
  const type=txt(body.mime_type,80);
  const extension={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];
  if(!extension)return bad('PDF, JPEG, PNG or WebP required',400);
  const path=uid+'/clearance/'+crypto.randomUUID()+'.'+extension;
  const {data,error}=await db.storage.from('ccx-private-clearance').createSignedUploadUrl(path);
  if(error)throw error;
  return out({path,token:data.token});
 }
 case 'clearance_submit':{
  if(!admission.data?.admitted_at)return bad('Complete account onboarding first',403);
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
 case 'clearance_history':{
  let docQ=db.from('ccx_clearance_document_submissions')
   .select('id,status,created_at,reviewed_at,review_note').eq('user_id',uid);
  let evtQ=db.from('ccx_clearance_events')
   .select('id,source,clearance_confirmed,expires_at,provider_reference,created_at').eq('user_id',uid);
  const from=txt(body.from,30),to=txt(body.to,30);
  if(from&&/^\d{4}-\d{2}-\d{2}$/.test(from)){
    docQ=docQ.gte('created_at',from+'T00:00:00Z');
    evtQ=evtQ.gte('created_at',from+'T00:00:00Z');
  }
  if(to&&/^\d{4}-\d{2}-\d{2}$/.test(to)){
    docQ=docQ.lte('created_at',to+'T23:59:59Z');
    evtQ=evtQ.lte('created_at',to+'T23:59:59Z');
  }
  const [docs,evts]=await Promise.all([
    docQ.order('created_at',{ascending:false}).limit(200),
    evtQ.order('created_at',{ascending:false}).limit(200)
  ]);
  if(docs.error)throw docs.error;
  if(evts.error)throw evts.error;
  const documents=(docs.data||[]).map((d:any)=>({...d,kind:'document'}));
  const events=(evts.data||[]).map((e:any)=>({...e,kind:'event'}));
  const merged=[...documents,...events].sort((a,b)=>
    new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  return out({items:merged});
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
  if(!admission.data?.admitted_at)return bad('Verified account required',403);
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
  const [members,consents,clearances]=await Promise.all([
   db.from('collaboration_members').select('user_id').eq('collaboration_id',idCollab),
   db.from('ccx_clearance_share_consents').select('user_id,revoked_at').eq('collaboration_id',idCollab),
   db.from('performer_work_clearances').select('user_id,clearance_confirmed,expires_at,provider').in('user_id', (await db.from('collaboration_members').select('user_id').eq('collaboration_id',idCollab)).data?.map((m:any)=>m.user_id)||[])
  ]);
  if(members.error||consents.error||clearances.error)return bad('Provider status unavailable',503);
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
  const participantsReady=all.length>0&&all.every((v:any)=>v.sharing&&v.clearance==='current');
  // A stored provider-enabled toggle is NOT evidence that production-hold
  // monitoring exists. No verified PASS partner integration is implemented yet.
  // Fail closed for production readiness while preserving independent provider
  // clearances and performer-controlled sharing.
  return out({members:all,participants_ready:participantsReady,ready:false,
   checked_at:new Date().toISOString(),production_hold_unknown:true,
   note:'Only consented binary work-clearance is displayed. Production readiness cannot be confirmed until PASS production holds can be checked through an approved partner integration.'});
 }
 default:return bad('Unknown action',404);
 }
 }catch(error){console.error('ccx integrations',action,String(error).slice(0,200));return bad('Provider operation unavailable',503);}
});
