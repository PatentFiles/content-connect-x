/** Recovery copy is presentation-only. This never changes an age, document,
 * biometric or admission decision. Backend status remains authoritative.
 */
const documentReasons=new Set(['document_checks_incomplete','document_mismatch','document_number_uncertain','id_expired_or_unclear','legal_name_uncertain','birth_date_uncertain']);
const captureReasons=new Set(['face_or_liveness_not_verified']);
const securityReasons=new Set(['engine_contract_mismatch','evidence_mismatch']);
export function identityRecoveryGuide(status,reason,{testing=false,eligibleOn=null}={}){
 if(status==='review_required'){
  if(documentReasons.has(reason))return {
   title:'Your ID needs a clearer check',kind:'document',
   steps:['Compare the printed name, date of birth and expiry with what was read. A misread date does not prove your ID is invalid.','If possible, take a new, sharp photo of the entire front and back without glare.','Use the Retake front/back button for the affected image, if available. Other securely saved evidence can remain in this attempt. If it still fails, request qualified review.'],
   note:testing?'Private testing cannot approve an account.':'Your access remains restricted until a trusted check succeeds or an authorized review resolves the issue.'};
  if(captureReasons.has(reason))return {
   title:'Your live camera check needs another attempt',kind:'camera',
   steps:['Use a well-lit room with your face unobstructed.','Follow the left/right head-turn instructions and look back toward the camera after each hold.','Use Retry camera challenge to capture a fresh live sequence where available, while retaining your saved ID images. Otherwise start a new attempt.'],
   note:'A face mismatch or liveness failure is not automatically an accusation of fraud.'};
  if(securityReasons.has(reason))return {
   title:'We could not safely link this attempt',kind:'technical',
   steps:['Your account has not been approved by this attempt.','Start a fresh verification session rather than trying to reuse saved images.','If the issue repeats, request qualified support or review.'],
   note:'We do not bypass evidence integrity checks.'};
  return {title:'Verification needs a closer look',kind:'review',
   steps:['Review your document and camera capture for clarity.','Start a fresh verification attempt if you can correct the capture.','If the same problem continues, request qualified review.'],
   note:'An inconclusive check is not a finding that your identification is fraudulent.'};
 }
 if(status==='name_mismatch')return {
  title:'Confirm your full legal name',kind:'name',
  steps:['Check that the name shown is exactly what is printed on your ID, including any middle initial or second family name.','If the reading is accurate, correct only your private legal name. Your public profile name stays unchanged.','If the ID was misread, do not accept an incorrect name. Request review or capture the document again.'],
  note:'Name correction does not override document or face-verification requirements.'};
 if(status==='retryable_error')return {
  title:'The check was interrupted',kind:'technical',
  steps:['Your ID was not approved by this interrupted attempt.','Use Retry verification to check the same securely saved evidence, if the session is still valid.','If the worker remains unavailable, start a fresh attempt or contact support.'],
  note:'A network problem is not an identity failure.'};
 if(status==='age_restricted')return {
  title:'This service is restricted to adults',kind:'age',
  steps:['An account cannot access Content Connect while its verified age is below the service threshold.',eligibleOn?'The next permitted verification date is '+eligibleOn+' (UTC).':'Review the eligibility date displayed above.','If the document date of birth was read incorrectly, request review. Do not submit another person\'s ID.'],
  note:'A fresh attempt may be permitted on the eligible date; age eligibility never grants automatic account access.'};
 if(status==='expired')return {title:'Your verification session expired',kind:'technical',steps:['Start a new verification session.','Capture fresh evidence and finish the guided camera step.'],note:'An expired attempt does not approve your account.'};
 return null;
}
