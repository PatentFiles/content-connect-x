/** Rendering policy only. This module never creates an approval or changes an API verdict. */
const complete=new Set(['approved','review_required','name_mismatch','age_restricted','cancelled','expired']);
const pending=new Set(['collecting','processing','retryable_error']);
export const identityFinished=status=>complete.has(status);
export function mergeIdentitySnapshot(previous,incoming){
 if(!incoming||typeof incoming!=='object')return previous;
 const old=previous?.session,next=incoming.session;
 if(old?.id&&next?.id===old.id){
  // A server-authorized retake increments the evidence revision. Older status
  // polls must never restore a superseded verdict or uploaded-file receipt.
  const oldRevision=old.evidence_revision??0,nextRevision=next.evidence_revision??0;
  if(nextRevision<oldRevision)return {...previous,...incoming,session:old};
  if(nextRevision>oldRevision)return {...previous,...incoming};
  // A status request started during processing may arrive after the submit result.
  // Never replace a final result with that earlier pending snapshot.
  if((complete.has(old.status)&&pending.has(next.status))||(old.status==='processing'&&next.status==='collecting'))return {...previous,...incoming,session:old};
 }
 return {...previous,...incoming};
}
export function identityResultTitle(status,testing=false){
 if(status==='approved')return testing?'Private test passed':'Identity verification complete';
 if(status==='review_required')return 'Check finished — some checks need attention';
 if(status==='name_mismatch')return 'Check finished — correct your legal name';
 if(status==='age_restricted')return 'Check finished — age requirement not met';
 if(status==='retryable_error')return 'Check interrupted — retry available';
 if(status==='expired')return 'This attempt expired';
 return 'Verification status';
}
/** @param {string} key
 * @param {any} diagnostics
 * @param {string} today */
export function identityDiagnosticHelp(key,diagnostics={},today=new Date().toISOString().slice(0,10)){
 if(diagnostics[key]===true)return '';
 const details=diagnostics.check_details||{};
 switch(key){
  case 'document_fields_confident':return details.low_confidence_fields?.length?'These ID fields need a clearer reading: '+details.low_confidence_fields.join(', ').replaceAll('_',' ')+'.':'One or more required ID fields could not be read confidently. Keep the complete card sharp and free of glare.';
  case 'document_cross_checked':return details.visual_expiry_conflict?'Front and back show different expiry readings. Check your ID and retake both sides. The ID is not automatically rejected as fake.':details.barcode_decoded===false?'The back barcode could not be decoded. Include the complete barcode in a sharp, evenly lit photo.':details.front_back_mismatches?.length?'Front/back readings differ for: '+details.front_back_mismatches.join(', ').replaceAll('_',' ')+'. Retake the document; a mismatch cannot be ignored.':'The front information and independently decoded back/passport data did not agree.';
  case 'document_authenticity_check':return 'The automated document checks were inconclusive or flagged the image. This does not by itself prove the ID is fake. Do not crop, edit, or obscure the card.';
  case 'name_matches':return 'Enter your complete legal name exactly as printed, including middle names or initials. Your public display name is separate.';
  case 'document_current':return details.visual_expiry_conflict?'The front-side expiry reading conflicts with the barcode. This may be an OCR error; retake both sides.':diagnostics.extracted_expiry&&diagnostics.extracted_expiry<today?'The expiry date read is in the past. Compare the displayed date with your ID; use a current ID or retake it if the date was misread.':'The expiry date was not read reliably.';
  case 'frame_identity_passed':return 'One or more movement frames did not provide a confident match to the initial live selfie. Keep your face visible, turn gently, and hold the phone still.';
  case 'liveness_passed':return 'The required turn, direction, return-to-center, or steady-face checks were not confirmed. Follow the countdown and hold each position until prompted to look back.';
  case 'face_matched':return 'The live selfie could not be confidently matched to the ID photo. Use even lighting with your face unobstructed.';
  case 'age_eligible':return 'Eligibility uses the birth date read from the ID and the next-day-after-eighteenth-birthday rule.';
  default:return 'This check could not be confirmed.';
 }
}
