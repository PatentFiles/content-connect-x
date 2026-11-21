/** Isolated, case-scoped lawful disclosure service.
 * No law officer has blanket Data API access or the platform admin role.
 * Every disclosed record or export is tied to legal basis and an audit event.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {validUuid,validScopes,isCaseLive,makeCsv} from './disclosurePolicy.mjs';
import {makeCasePdf} from './pdfReport.mjs';
import {verifiedAal2} from '../_shared/verifiedAdminAal.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const out=(value,status=200)=>Response.json(value,{status,headers:cors});
const txt=(v,max=250)=>typeof v==='string'?v.trim().slice(0,max):'';
const validEmail=s=>typeof s==='string'&&s.length<200&&/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return out({error:'Service unavailable'},503);
 const authHeader=req.headers.get('Authorization')||'';
 const caller=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
 const {data:{user},error:authError}=await caller.auth.getUser();
 if(authError||!user)return out({error:'Sign in required'},401);
 const body=await req.json().catch(()=>null);
 if(!body||JSON.stringify(body).length>12000)return out({error:'Invalid request'},400);
 const action=txt(body.action,60),db=createClient(url,service),uid=user.id;
 const [account,officer]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('ccx_law_officers').select('user_id,agency,official_email,jurisdiction,enabled,disabled_at').eq('user_id',uid).maybeSingle()
 ]);
 if(account.error||officer.error)return out({error:'Role check unavailable'},503);
 // A law-enforcement identity must have a live security record and must not
 // simultaneously inherit administrative privileges. Absent rows fail closed.
 const accountActive=Boolean(account.data&&!account.data.banned&&!account.data.suspended);
 const admin=accountActive&&account.data.admin===true;
 const officerReady=accountActive&&account.data.admin!==true&&officer.data?.enabled===true&&!officer.data.disabled_at;
 const hasMfa=verifiedAal2(authHeader,uid);
 const log=async(what,caseId,subject=null,details={})=>{
  const {error}=await db.from('ccx_law_disclosure_audit').insert({
   officer_id:officerReady?uid:null,case_id:caseId||null,
   subject_user_id:subject,action:what,details
  });
  if(error)throw Error('Disclosure audit unavailable; no record can be released');
 };
 const assertAdmin=()=>{if(!admin||!hasMfa)throw Error('An administrator with two-factor authentication is required');};
 const assertOfficer=()=>{if(!officerReady||!hasMfa)throw Error('An active law-enforcement account with two-factor authentication is required');};
 const getCase=async id=>{
  if(!validUuid(id))throw Error('Valid case ID required');
  const {data,error}=await db.from('ccx_law_cases').select('*').eq('id',id).maybeSingle();
  if(error||!data)throw Error('Case unavailable');
  return data;
 };
 try{
  if(action==='role_status'){
   return out({officer:officerReady,admin,requires_mfa:!hasMfa,
    agency:officerReady?officer.data.agency:null});
  }
  if(action==='admin_invite'){
   assertAdmin();
   const email=txt(body.email,200).toLowerCase(),agency=txt(body.agency,200),jurisdiction=txt(body.jurisdiction,150);
   if(!validEmail(email)||agency.length<3||jurisdiction.length<2||
    body.agency_identity_confirmed!==true) return out({error:'Confirm an official verified agency identity and email before invitation'},400);
   // No platform-created shared passwords. Email invitation lets each officer
   // establish their own password and independent TOTP factor.
   const {data:invite,error:inviteError}=await db.auth.admin.inviteUserByEmail(email,{
    redirectTo:(Deno.env.get('CCX_PUBLIC_ORIGIN')||'https://contentconnectx.com').replace(/\/$/,'')+'/law-enforcement-portal'
   });
   if(inviteError||!invite.user?.id)throw Error('Invitation could not be issued. Verify email delivery configuration.');
   const {error:provision}=await db.from('ccx_law_officers').upsert({
    user_id:invite.user.id,agency,official_email:email,jurisdiction,enabled:true,
    verified_by:uid,verified_at:new Date().toISOString(),disabled_at:null
   },{onConflict:'user_id'});
   if(provision)throw Error('Invitation issued but role provisioning failed; investigate before allowing access');
   const {error:audit}=await db.from('ccx_law_disclosure_audit').insert({
    action:'officer_provisioned',subject_user_id:invite.user.id,
    details:{agency,jurisdiction,invited_by:uid}
   });
   if(audit)throw Error('Role provisioned but audit creation failed');
   return out({invited:true,note:'An agency-specific invitation was issued. The officer sets their own credentials and must enroll MFA.'});
  }
  if(action==='admin_officers'){
   assertAdmin();
   const {data,error}=await db.from('ccx_law_officers')
    .select('user_id,agency,official_email,jurisdiction,enabled,verified_at,disabled_at')
    .order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   return out({items:data||[]});
  }
  if(action==='admin_disable'){
   assertAdmin();
   if(!validUuid(body.officer_id))return out({error:'Officer ID required'},400);
   const {error}=await db.from('ccx_law_officers').update({
    enabled:false,disabled_at:new Date().toISOString()
   }).eq('user_id',body.officer_id);
   if(error)throw error;
   const {error:revoke}=await db.from('ccx_law_cases').update({status:'revoked'}).eq('officer_id',body.officer_id).eq('status','approved');
   if(revoke)throw revoke;
   const {error:audit}=await db.from('ccx_law_disclosure_audit').insert({
    action:'officer_disabled',subject_user_id:body.officer_id,details:{disabled_by:uid}
   });
   if(audit)throw audit;
   return out({disabled:true});
  }
  if(action==='request_case'){
   assertOfficer();
   const subject=body.subject_user_id,agencyNumber=txt(body.agency_case_number,160),legal=txt(body.legal_basis,3000),
    type=txt(body.legal_process_type,40),reference=txt(body.evidence_reference,500);
   const types=new Set(['court_order','warrant','subpoena','preservation_request','emergency_request','other']);
   if(!validUuid(subject)||!validScopes(body.requested_scopes)||agencyNumber.length<3||
    !types.has(type)||legal.length<30||reference.length<10)return out({error:'Provide exact member UUID, legal process, reference and specific record categories'},400);
   const {data:userExists,error:existError}=await db.from('member_profiles').select('id').eq('id',subject).maybeSingle();
   if(existError||!userExists)return out({error:'Subject not available for case request'},404);
   const {data,error}=await db.from('ccx_law_cases').insert({
    officer_id:uid,subject_user_id:subject,agency_case_number:agencyNumber,
    legal_process_type:type,legal_basis:legal,evidence_reference:reference,
    requested_scopes:body.requested_scopes
   }).select('id,status').single();
   if(error)throw error;
   await log('case_requested',data.id,subject,{requested_scopes:body.requested_scopes,process:type});
   return out({item:data},201);
  }
  if(action==='admin_hold'||action==='admin_release_hold'){
   assertAdmin();
   const item=await getCase(body.case_id);
   const reason=txt(body.review_note,800);
   if(action==='admin_hold'){
    if(item.status!=='approved'||Date.parse(item.expires_at)<=Date.now()||
     !['warrant','court_order','subpoena','preservation_request'].includes(item.legal_process_type)||
     body.legal_preservation_confirmed!==true||reason.length<25)
     return out({error:'Verified, active legal-process approval and a specific evidence-preservation justification are required'},409);
    const days=Number(body.days);
    if(!Number.isInteger(days)||days<1||days>90)return out({error:'Preservation must have a specified 1-90 day expiration'},400);
    const {data,error}=await db.rpc('ccx_law_apply_hold',{p_case_id:item.id,p_admin:uid,p_days:days,p_reason:reason});
    if(error)throw Error('Preservation could not be applied');
    return out({preservation:data});
   }
   if(reason.length<15||body.release_confirmed!==true)return out({error:'Confirm the release of preserved evidence and provide the reason'},409);
   const {data,error}=await db.rpc('ccx_law_release_hold',{p_case_id:item.id,p_admin:uid,p_reason:reason});
   if(error)throw Error('Preservation could not be released');
   return out({preservation:data});
  }
  if(action==='case_audit'){
   assertOfficer();
   const item=await getCase(body.case_id);
   if(item.officer_id!==uid)return out({error:'Case unavailable'},404);
   const {data,error}=await db.from('ccx_law_disclosure_audit')
    .select('id,action,result_status,created_at,details').eq('case_id',item.id)
    .order('created_at',{ascending:false}).limit(300);
   if(error)throw Error('Case audit unavailable');
   await log('viewed',item.id,item.subject_user_id,{audit_log_only:true});
   return out({items:data||[]});
  }
  if(action==='admin_cases'){
   assertAdmin();
   const {data,error}=await db.from('ccx_law_cases')
    .select('id,officer_id,subject_user_id,agency_case_number,legal_process_type,legal_basis,evidence_reference,requested_scopes,approved_scopes,status,requested_at,reviewed_at,review_note,expires_at,preservation_hold')
    .order('requested_at',{ascending:false}).limit(100);
   if(error)throw error;
   return out({items:data||[]});
  }
  if(action==='admin_decide'){
   assertAdmin();
   const item=await getCase(body.case_id);
   const decision=body.decision,scopes=body.approved_scopes,note=txt(body.review_note,2000);
   // Approval/denial are single-use decisions. An approved case can only be
   // revoked; extending access requires a newly reviewed legal-process case.
   if((item.status==='pending'&&!['approve','deny'].includes(decision))||
      (item.status==='approved'&&decision!=='revoke')||
      !['pending','approved'].includes(item.status))
    return out({error:'Invalid case status transition. Submit a new case for renewed access'},409);
   if(!['approve','deny','revoke'].includes(decision)||note.length<15)return out({error:'Choose a decision and give the case-specific reason'},400);
   if(decision==='approve'&&(!validScopes(scopes)||!scopes.every(s=>item.requested_scopes.includes(s))))return out({error:'Approval may only include specifically requested permitted record categories'},400);
   const hours=Math.min(168,Math.max(1,Number(body.hours)||24));
   if(decision==='approve'&&body.authorized_process_confirmed!==true)return out({error:'Independent legal-process verification must be confirmed'},409);
   const status=decision==='approve'?'approved':decision==='deny'?'denied':'revoked';
   const {error}=await db.from('ccx_law_cases').update({
    status,approved_scopes:status==='approved'?scopes:[],
    reviewed_by:uid,reviewed_at:new Date().toISOString(),review_note:note,
    expires_at:status==='approved'?new Date(Date.now()+hours*3600000).toISOString():null
   }).eq('id',item.id);
   if(error)throw error;
   const {error:audit}=await db.from('ccx_law_disclosure_audit').insert({
    officer_id:item.officer_id,case_id:item.id,subject_user_id:item.subject_user_id,
    action:decision==='approve'?'case_approved':decision==='deny'?'case_denied':'case_revoked',
    details:{approved_scopes:status==='approved'?scopes:[],reviewed_by:uid,valid_hours:hours}
   });
   if(audit)throw audit;
   return out({status});
  }
  if(action==='list_cases'){
   assertOfficer();
   const {data,error}=await db.from('ccx_law_cases')
    .select('id,agency_case_number,subject_user_id,legal_process_type,requested_scopes,approved_scopes,status,requested_at,reviewed_at,expires_at')
    .eq('officer_id',uid).order('requested_at',{ascending:false}).limit(100);
   if(error)throw error;
   return out({items:data||[]});
  }
  if(['view','export_csv','export_pdf'].includes(action)){
   assertOfficer();
   const item=await getCase(body.case_id);
   if(!isCaseLive(item,uid))return out({error:'No current legal authorization for this subject and case'},403);
   const subject=item.subject_user_id,scope=new Set(item.approved_scopes),result={};
   // Explicit hard-coded columns only. No private ID files, DOB, medical
   // records, passwords, contact lists, message text or reporter payloads.
   if(scope.has('profile')){
    const {data,error}=await db.from('member_profiles')
     .select('id,display_name,stage_name,real_name,company_name,role_type,city,country,created_at')
     .eq('id',subject).maybeSingle();
    if(error)throw error;result.profile=data?[data]:[];
   }
   if(scope.has('admission')){
    const {data,error}=await db.from('member_admissions')
     .select('id,user_id,admitted_at,source,created_at').eq('user_id',subject)
     .order('created_at',{ascending:false}).limit(30);
    if(error)throw error;result.admission=data||[];
   }
   if(scope.has('platform_activity')){
    const {data,error}=await db.from('platform_action_audit')
     .select('id,action,target_type,target_id,created_at').eq('actor_id',subject)
     .order('created_at',{ascending:false}).limit(500);
    if(error)throw error;result.platform_activity=data||[];
   }
   if(scope.has('safety_reports')){
    const {data,error}=await db.from('ccx_trust_requests')
     .select('id,kind,status,priority,created_at,reviewed_at')
     .eq('payload->>subject_user_id',subject)
     .order('created_at',{ascending:false}).limit(200);
    if(error)throw error;result.safety_reports=data||[];
   }
   if(scope.has('collaboration_metadata')){
    const {data:membership,error}=await db.from('collaboration_members')
     .select('collaboration_id').eq('user_id',subject).limit(200);
    if(error)throw error;
    const ids=(membership||[]).map(x=>x.collaboration_id);
    if(ids.length){
     const collabs=await db.from('collaborations')
      .select('id,title,status,created_at').in('id',ids).order('created_at',{ascending:false}).limit(200);
     if(collabs.error)throw collabs.error;
     result.collaboration_metadata=collabs.data||[];
    }else result.collaboration_metadata=[];
   }
   const actionName=action==='view'?'viewed':action==='export_csv'?'csv_export':'pdf_export';
   await log(actionName,item.id,subject,{scopes:item.approved_scopes,record_count:Object.values(result).reduce((n,v)=>n+v.length,0)});
   const report={case_id:item.id,agency_case_number:item.agency_case_number,subject_user_id:subject,
    approved_scopes:item.approved_scopes,generated_at:new Date().toISOString(),data:result,
    disclaimer:'Case-scoped disclosure. Raw medical, biometric and private communication files excluded. Records outside this scope are not represented.'};
   if(action==='view')return out(report);
   if(action==='export_csv'){
    const csv=makeCsv(result);
    return new Response(csv,{status:200,headers:{...cors,'Content-Type':'text/csv; charset=utf-8',
     'Content-Disposition':'attachment; filename="case-disclosure-'+item.id+'.csv"'}});
   }
   const pdf=await makeCasePdf(result,item.agency_case_number);
   return new Response(pdf,{status:200,headers:{...cors,'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="case-disclosure-'+item.id+'.pdf"'}});
  }
  return out({error:'Unknown portal action'},400);
 }catch(error){
  // Never reflect private SQL errors or token data.
  return out({error:txt(error?.message||'Case service unavailable',220)},400);
 }
});