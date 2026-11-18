/** The private pilot runs the real engine but can NEVER grant membership. */
import {decide,legalName,nameKey,isoDate,eligibilityDate,SCHEMA,ENGINE_REVISION} from '../identity-verification/policy.mjs';
export const BUCKET='ccx-identity-pilot-evidence';
export const NOTICE_VERSION='ccx-private-test-2026-11-18-v1';
export const NOTICE='PRIVATE ADMINISTRATOR TEST — NOT PUBLIC REGISTRATION\n\nUpload only your own government-issued photo ID and use your own live camera. This optional test reads your legal name, date of birth, expiry and document details; compares your ID photograph with your camera images; and evaluates head movements. The engine is experimental and can make mistakes. A test result is not a certified identity check, does not grant membership, and does not change your existing account access, legal name or public stage name.\n\nContent Connect processes this test using its Supabase backend and dedicated Railway compute service. ID images, the selfie snapshot, motion frames and diagnostic results are private. Facial descriptors are used transiently for comparison, not saved as a reusable face-search database. No documents are sent to Yoti. Do not upload another person’s ID.\n\nTest evidence is scheduled for deletion after 24 hours, on the next successful 15-minute cleanup run. You can request earlier deletion with Delete my test evidence. Deletion waits for in-flight uploads and temporary links to expire; disaster-recovery backups follow the hosting provider’s recovery policy. New tests stop if cleanup stops reporting success. Minimal security events may remain without document images or extracted ID fields. This test notice is not the production privacy policy.\n\nBy checking the consent box, you authorize this optional processing of your own ID and live camera capture for testing.';
export function isPilotAdmin(user,security,admitted){
 return Boolean(user?.id&&!user.is_anonymous&&user.email_confirmed_at&&security?.admin===true&&security.banned===false&&security.suspended===false&&admitted);
}
export function pilotAvailable(config,now=Date.now()){
 const cleanup=Date.parse(config?.last_cleanup_at||'');
 return config?.enabled===true&&Date.parse(config.expires_at)>now&&Number.isFinite(cleanup)&&cleanup<=now+60000&&cleanup>now-45*60000&&Number.isFinite(Date.parse(config.last_probe_at||''));
}
export function pilotResult(report,session,today){
 const verdict=decide(report,session,today);
 const invalid=['engine_contract_mismatch','evidence_mismatch','document_mismatch'].includes(verdict.reason);
 if(invalid)return {status:'review_required',reason:verdict.reason,diagnostics:{test_only:true,admission_granted:false}};
 // Whitelist results. Never persist document numbers, raw OCR or face embeddings.
 const doc=report.document||{},face=report.face||{};
 let name=null,matches=false;
 try{name=legalName(doc.name);matches=nameKey(session.legal_name)===nameKey(name);}catch{}
 const dob=isoDate(doc.dob),eligible=dob?eligibilityDate(dob):null;
 const diagnostics={test_only:true,admission_granted:false,engine_revision:ENGINE_REVISION,schema:SCHEMA,
  extracted_name:name,extracted_dob:dob,extracted_expiry:isoDate(doc.expiry),eligible_on:eligible,name_matches:matches,
  age_eligible:eligible&&dob<=today?today>=eligible:null,
  document_fields_confident:doc.fields_confident===true,document_cross_checked:doc.cross_checked===true,
  document_authenticity_check:doc.authenticity_passed===true,face_matched:face.matched===true,
  face_distance:Number.isFinite(face.distance)&&face.distance>=0?Number(face.distance.toFixed(4)):null,
  liveness_passed:face.liveness_passed===true,frame_identity_passed:face.frame_identity_passed===true};
 return {status:verdict.status,reason:verdict.reason,expected_name:verdict.status==='name_mismatch'?verdict.legal_name:null,eligible_on:verdict.eligible_on||eligible,diagnostics};
}
export function pilotSession(s,now=Date.now()){
 if(!s||s.purged_at)return null;
 let status=s.status;
 if(['collecting','processing','retryable_error','name_mismatch'].includes(status)&&Date.parse(s.expires_at)<=now)status='expired';
 else if(status==='processing'&&Date.parse(s.job_expires_at)<=now)status='retryable_error';
 const messages={collecting:'Upload your ID and complete the live camera challenge. This is a private test, not an account approval.',processing:'Checking your ID and live capture. Existing account access is unchanged.',approved:'All required checks passed in this private test. No membership approval was created.',review_required:'One or more checks did not pass. The diagnostic results below show what needs investigation. No account decision was made.',name_mismatch:'The entered test name does not match the ID. Correct the test name below; your public name and existing profile are unchanged.',age_restricted:`The ID birth date does not meet the service age rule. Re-verification would be allowed on ${s.eligible_on} (UTC). This test grants no access.`,retryable_error:'The worker could not complete this attempt. Retry or delete this test and start again.',cancelled:'Deletion requested. Evidence will be removed after in-flight uploads settle, on a cleanup run.',expired:'This test expired. Start a new attempt.'};
 return {id:s.id,status,reason:s.reason,message:messages[status]||'Private test',test_only:true,admission_granted:false,
  document_type:s.document_type,issuing_country:s.issuing_country,legal_name:s.legal_name,expected_name:status==='name_mismatch'?s.expected_name:null,
  eligible_on:s.eligible_on,challenge_id:status==='collecting'?s.challenge_id:null,directions:status==='collecting'?s.directions:null,
  uploaded:Object.fromEntries(['front','back','selfie','capture'].map(k=>[k,Boolean(s.evidence?.[k])])),expires_at:s.expires_at,purge_after:s.purge_after,
  diagnostics:s.diagnostics||{},review_requested:false};
}
