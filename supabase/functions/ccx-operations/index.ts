/** Private, aggregate-only operations overview. No patient/ID records,
 * report payloads, member emails or provider secrets leave the backend.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {verifiedAal2} from '../_shared/verifiedAdminAal.mjs';
const respond=(payload,status=200)=>Response.json(payload,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return respond({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return respond({error:'Service unavailable'},503);
 const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authError}=await caller.auth.getUser();
 if(authError||!user)return respond({error:'Sign in required'},401);
 if(!verifiedAal2(req.headers.get('Authorization'),user.id))return respond({error:'Administrator two-factor verification required'},403);
 const db=createClient(url,service),now=new Date().toISOString();
 const [{data:sec,error:secError},{data:admission,error:admissionError}]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',user.id).maybeSingle(),
  db.from('member_admissions').select('admitted_at').eq('user_id',user.id).maybeSingle()
 ]);
 if(secError||admissionError||!sec?.admin||sec.banned||sec.suspended||!admission?.admitted_at)
  return respond({error:'Active verified administrator required'},403);
 const body=await req.json().catch(()=>null);
 if(body?.action==='trust_settings_get'){
  const {data,error}=await db.from('ccx_trust_settings')
   .select('legal_entity,postal_address,contact_email,policies_approved,reviewer_coverage_confirmed,intake_enabled,updated_at')
   .eq('singleton',true).maybeSingle();
  if(error)return respond({error:'Safety configuration unavailable'},503);
  return respond({item:data||null});
 }
 if(body?.action==='trust_settings_save'){
  const legal=typeof body.legal_entity==='string'?body.legal_entity.trim():'',
   postal=typeof body.postal_address==='string'?body.postal_address.trim():'',
   email=typeof body.contact_email==='string'?body.contact_email.trim():'';
  const policy=body.policies_approved===true,reviewers=body.reviewer_coverage_confirmed===true;
  if(legal.length<3||legal.length>160||postal.length<8||postal.length>360||
   !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)||email.length>254)
   return respond({error:'Enter an identified legal operator, postal contact address and valid safety email'},400);
  if(policy&&body.policy_acknowledgement!=='I_REVIEWED_CURRENT_POLICIES')
   return respond({error:'Confirm you personally reviewed the published policies before marking approved'},409);
  if(reviewers&&body.reviewer_acknowledgement!=='STAFF_COVERAGE_CONFIRMED')
   return respond({error:'Confirm that named staff can actually handle incoming reports before marking covered'},409);
  const {count:activeAdmins,error:staffError}=await db.from('account_security')
   .select('user_id',{head:true,count:'exact'}).eq('admin',true).eq('banned',false).eq('suspended',false);
  if(staffError||reviewers&&!(activeAdmins>0))return respond({error:'At least one active administrator is required to confirm reviewer coverage'},409);
  const {data,error}=await db.from('ccx_trust_settings').update({
   legal_entity:legal,postal_address:postal,contact_email:email,
   policies_approved:policy,reviewer_coverage_confirmed:reviewers,updated_at:now
  }).eq('singleton',true).select('legal_entity,postal_address,contact_email,policies_approved,reviewer_coverage_confirmed,intake_enabled,updated_at').single();
  if(error)return respond({error:'Safety configuration could not be saved'},503);
  const {error:auditError}=await db.from('platform_action_audit').insert({
   actor_id:user.id,action:'trust_operator_settings_reviewed',target_type:'trust_settings',
   metadata:{policies_approved:policy,reviewer_coverage_confirmed:reviewers}
  });
  if(auditError)return respond({error:'Safety settings saved, but audit logging failed. Verify manually.'},503);
  return respond({item:data,saved:true});
 }
 if(body?.action!=='summary')return respond({error:'Unknown action'},400);
 const count=async(table,filter=fn=>fn)=>{
  const q=filter(db.from(table).select('id',{head:true,count:'exact'}));
  const {count,error}=await q;
  if(error)throw Error('Unable to calculate operations summary');
  return count??0;
 };
 try{
  const [
   openSafety,overdueSafety,pendingAudio,failedAudio,
   openSignatures,identity,trust,ai,providers,affiliate,
   email,hostNotifications,pendingTesting
  ]=await Promise.all([
   count('ccx_trust_requests',q=>q.neq('status','resolved')),
   count('ccx_trust_requests',q=>q.neq('status','resolved').lt('due_at',now)),
   count('ccx_meeting_recordings',q=>q.eq('transcript_status','pending')),
   count('ccx_meeting_recordings',q=>q.eq('transcript_status','failed')),
   count('signature_envelopes',q=>q.in('status',['created','sent','pending'])),
   db.from('ccx_idv_config').select('enabled,worker_origin,retention_days,security_approved_at,privacy_approved_at').eq('singleton',true).maybeSingle(),
   db.from('ccx_trust_settings').select('intake_enabled,policies_approved,reviewer_coverage_confirmed,contact_email,legal_entity').eq('singleton',true).maybeSingle(),
   db.from('ccx_ai_agent_runs').select('status,started_at,flags_created').order('started_at',{ascending:false}).limit(1),
   db.from('ccx_integrations').select('provider,enabled,setup_status').in('provider',['ccbill','docusign','email','sentry','webpush']),
   db.from('ccx_shop_partners').select('slug,partner_status,affiliate_url').limit(100),
   db.rpc('ccx_email_delivery_summary'),
   count('hosting_notification_outbox',q=>q.eq('status','failed')),
   count('ccx_testing_credentials',q=>q.in('status',['pending','pending_review']))
  ]);
  for(const result of [identity,trust,ai,providers,affiliate,email]){
   if(result.error)throw Error('One operations source is unavailable');
  }
  const first=identity.data||{},config=trust.data||{};
  const warnings=[
   ...(!first.enabled?['Production ID verification has not been activated']:[]),
   ...(!first.retention_days?['Identity evidence retention policy missing']:[]),
   ...(!first.security_approved_at||!first.privacy_approved_at?['ID verification security/privacy approval incomplete']:[]),
   ...(!config.policies_approved||!config.reviewer_coverage_confirmed?['Safety policy approval and on-call reviewer coverage unconfirmed']:[]),
   ...(!config.contact_email||!config.legal_entity?['Public operator/contact information incomplete']:[])
  ];
  const integration=Object.fromEntries((providers.data||[]).map(p=>[p.provider,{
   enabled:p.enabled===true,setup_status:p.setup_status
  }]));
  return respond({
   checked_at:now,
   safety:{unresolved:openSafety,overdue:overdueSafety,intake_enabled:config.intake_enabled===true},
   identity:{enabled:first.enabled===true,worker_connected:Boolean(first.worker_origin),
    retention_configured:Boolean(first.retention_days),
    security_approved:Boolean(first.security_approved_at),
    privacy_approved:Boolean(first.privacy_approved_at)},
   recordings:{pending_transcripts:pendingAudio,failed_transcripts:failedAudio},
   contracts:{open_envelopes:openSignatures},
   testing:{pending_credentials:pendingTesting},
   notifications:{email:email.data||{},failed_host_outbox:hostNotifications},
   ai:{latest_run:ai.data?.[0]||null},
   commerce:{tracked_partners:(affiliate.data||[]).filter(x=>x.partner_status==='approved'&&Boolean(x.affiliate_url)).length,
    total_partners:(affiliate.data||[]).length},
   integrations:integration,
   warnings,
   note:'Operational metrics only. Passing CI and configured credentials do not constitute live payment, identity, or provider acceptance.'
  });
 }catch{
  return respond({error:'Operational readout temporarily unavailable'},503);
 }
});
