/** GENUINE Supabase MFA / lawful disclosure integration on ISOLATED STAGING only.
 * Never run against production. All credentials and TOTP values come from
 * ephemeral environment secrets. No raw passwords, codes or records are logged.
 * Every case, disclosure and revocation is retained for audit; no cleanup deletes evidence.
 *
 * Required:
 * CCX_LAW_TEST_SUPABASE_URL, CCX_LAW_TEST_PUBLISHABLE_KEY,
 * CCX_LAW_TEST_SERVICE_KEY, CCX_LAW_TEST_SUBJECT_ID,
 * CCX_LAW_TEST_ADMIN_EMAIL, CCX_LAW_TEST_ADMIN_PASSWORD, CCX_LAW_TEST_ADMIN_TOTP,
 * CCX_LAW_TEST_OFFICER_EMAIL, CCX_LAW_TEST_OFFICER_PASSWORD, CCX_LAW_TEST_OFFICER_TOTP,
 * CCX_LAW_TEST_MEMBER_EMAIL, CCX_LAW_TEST_MEMBER_PASSWORD,
 * CCX_LAW_TEST_ISOLATED=YES, CCX_LAW_TEST_ALLOW_WRITES=YES.
 */
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
const env=process.env;
const required=['CCX_LAW_TEST_SUPABASE_URL','CCX_LAW_TEST_PUBLISHABLE_KEY','CCX_LAW_TEST_SERVICE_KEY',
 'CCX_LAW_TEST_SUBJECT_ID','CCX_LAW_TEST_ADMIN_EMAIL','CCX_LAW_TEST_ADMIN_PASSWORD','CCX_LAW_TEST_ADMIN_TOTP',
 'CCX_LAW_TEST_OFFICER_EMAIL','CCX_LAW_TEST_OFFICER_PASSWORD','CCX_LAW_TEST_OFFICER_TOTP',
 'CCX_LAW_TEST_MEMBER_EMAIL','CCX_LAW_TEST_MEMBER_PASSWORD'];
const missing=required.filter(k=>!env[k]);
if(missing.length)throw Error('Missing isolated test configuration: '+missing.join(', '));
const url=new URL(env.CCX_LAW_TEST_SUPABASE_URL);
if(url.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(url.hostname)||
 url.hostname.includes('yxuqbygykpfbioslljlf')||
 env.CCX_LAW_TEST_ISOLATED!=='YES'||env.CCX_LAW_TEST_ALLOW_WRITES!=='YES')
 throw Error('Refusing to run live officer tests outside explicitly approved isolated Supabase staging');
const subject=env.CCX_LAW_TEST_SUBJECT_ID;
assert.match(subject,/^[0-9a-f-]{36}$/i);
const publicKey=env.CCX_LAW_TEST_PUBLISHABLE_KEY;
const client=()=>createClient(url.origin,publicKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
const privileged=createClient(url.origin,env.CCX_LAW_TEST_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
async function signIn(email,password){
 const c=client();
 const {data,error}=await c.auth.signInWithPassword({email,password});
 if(error||!data?.session)throw Error('Staging credential sign-in failed for an expected test role');
 return c;
}
async function stepUp(c,otp){
 const factors=await c.auth.mfa.listFactors();
 if(factors.error)throw Error('Cannot enumerate enrolled staging MFA factors');
 const totp=factors.data?.totp?.find(f=>f.status==='verified');
 if(!totp)throw Error('A verified authenticator must be enrolled for this staging test account');
 const result=await c.auth.mfa.challengeAndVerify({factorId:totp.id,code:otp});
 if(result.error)throw Error('Staging authenticator code was not accepted');
 const aal=await c.auth.mfa.getAuthenticatorAssuranceLevel();
 assert.equal(aal.data?.currentLevel,'aal2','MFA must elevate access to AAL2');
}
async function request(c,action,params={}){
 const result=await c.functions.invoke('ccx-law-portal',{body:{action,...params}});
 if(result.error){
  const status=result.error.context?.status||0;
  return {status,error:true};
 }
 return {status:200,data:result.data,error:false};
}
const member=await signIn(env.CCX_LAW_TEST_MEMBER_EMAIL,env.CCX_LAW_TEST_MEMBER_PASSWORD);
const officer=await signIn(env.CCX_LAW_TEST_OFFICER_EMAIL,env.CCX_LAW_TEST_OFFICER_PASSWORD);
const administrator=await signIn(env.CCX_LAW_TEST_ADMIN_EMAIL,env.CCX_LAW_TEST_ADMIN_PASSWORD);
try{
 assert.equal((await request(member,'role_status')).data?.officer,false);
 assert.equal((await request(officer,'role_status')).data?.officer,true);
 assert.equal((await request(officer,'role_status')).data?.requires_mfa,true);
 assert.equal((await request(officer,'list_cases')).error,true,'AAL1 cannot list cases');
 assert.equal((await request(administrator,'admin_cases')).error,true,'AAL1 cannot review cases');
 await stepUp(officer,env.CCX_LAW_TEST_OFFICER_TOTP);
 await stepUp(administrator,env.CCX_LAW_TEST_ADMIN_TOTP);
 assert.equal((await request(officer,'role_status')).data?.requires_mfa,false);
 const caseArgs={subject_user_id:subject,agency_case_number:'CCX-E2E-'+randomUUID(),
  legal_process_type:'other',legal_basis:'Synthetic isolated staging authorization for automated access control verification only.',
  evidence_reference:'CCX-STAGING-ACCESS-TEST-'+randomUUID(),requested_scopes:['profile','admission']};
 const created=await request(officer,'request_case',caseArgs);
 assert.equal(created.error,false,'Officer must submit a scoped case in isolated staging');
 const caseId=created.data?.item?.id;
 assert.match(caseId,/^[0-9a-f-]{36}$/i);
 assert.equal((await request(officer,'view',{case_id:caseId})).error,true,'Pending case cannot disclose data');
 assert.equal((await request(member,'view',{case_id:caseId})).error,true,'Member cannot use officer portal');
 const wrongScope=await request(administrator,'admin_decide',{case_id:caseId,decision:'approve',
  review_note:'Fixture review does not authorize unrelated scope',approved_scopes:['safety_reports'],
  authorized_process_confirmed:true});
 assert.equal(wrongScope.error,true,'Staging admin cannot expand case scope');
 const approved=await request(administrator,'admin_decide',{case_id:caseId,decision:'approve',
  review_note:'Isolated test authorization verified against staging fixture only',
  approved_scopes:['profile'],authorized_process_confirmed:true,hours:1});
 assert.equal(approved.error,false,'Staging admin AAL2 can approve only requested fields');
 const viewed=await request(officer,'view',{case_id:caseId});
 assert.equal(viewed.error,false);
 assert.deepEqual(Object.keys(viewed.data.data),['profile']);
 assert.equal(viewed.data.subject_user_id,subject);
 const csv=await request(officer,'export_csv',{case_id:caseId});
 const pdf=await request(officer,'export_pdf',{case_id:caseId});
 assert.equal(csv.error,false);assert.equal(pdf.error,false);
 assert.ok(typeof csv.data==='string'||csv.data instanceof Blob);
 assert.ok(pdf.data instanceof Blob);
 const audits=await request(officer,'case_audit',{case_id:caseId});
 assert.equal(audits.error,false);
 for(const action of ['case_approved','viewed','csv_export','pdf_export'])
  assert.ok(audits.data.items.some(x=>x.action===action),'Missing disclosure event '+action);
 assert.equal((await request(administrator,'admin_decide',{case_id:caseId,decision:'approve',
  review_note:'An existing grant cannot be reapproved',approved_scopes:['profile'],
  authorized_process_confirmed:true})).error,true);
 const revoked=await request(administrator,'admin_decide',{case_id:caseId,decision:'revoke',
  review_note:'Synthetic staging authorization revoked after e2e verification'});
 assert.equal(revoked.error,false);assert.equal((await request(officer,'view',{case_id:caseId})).error,true);
 // Create a second approved fixture, then EXPIRE ONLY THAT FIXTURE with service
 // role in staging. Never use privileged updates on production or other cases.
 const next=await request(officer,'request_case',{...caseArgs,agency_case_number:'CCX-E2E-EXP-'+randomUUID()});
 assert.equal(next.error,false);
 const expId=next.data.item.id;
 assert.equal((await request(administrator,'admin_decide',{case_id:expId,decision:'approve',
  review_note:'Isolated temporary expiry fixture authorized for test',approved_scopes:['profile'],
  authorized_process_confirmed:true,hours:1})).error,false);
 const expired=await privileged.from('ccx_law_cases').update({expires_at:'2020-01-01T00:00:00Z'})
  .eq('id',expId).eq('agency_case_number',next.data.item.agency_case_number);
 if(expired.error)throw Error('Could not expire isolated fixture');
 assert.equal((await request(officer,'view',{case_id:expId})).error,true);
 console.log('PASS live isolated staging officer and admin MFA, scope, disclosure, audit, expiry and revocation');
}finally{
 await Promise.allSettled([member,officer,administrator].map(c=>c.auth.signOut()));
}
