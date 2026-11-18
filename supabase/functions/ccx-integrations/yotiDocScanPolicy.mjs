/** Yoti AVS Doc Scan only. A browser redirect is never evidence of approval. */
export function buildDocScanSession(reference, origin) {
 return {
  type:'OVER',ttl:900,reference_id:reference,synchronous_checks:true,
  age_estimation:{allowed:false},digital_id:{allowed:false},
  doc_scan:{allowed:true,threshold:18,retry_limit:2,level:'PASSIVE',authenticity:'AUTO'},
  credit_card:{allowed:false},mobile:{allowed:false},login:{allowed:false},age_key:{allowed:false},
  callback:{auto:true,url:origin+'/?age_verification=complete'},
  cancel_url:origin+'/?age_verification=cancelled',block_biometric_consent:false,
 };
}
export function evaluateDocScanResult(result, expected) {
 const bound=result?.id===expected.sessionId&&result?.reference_id===expected.reference&&
  result?.sdk_id===expected.sdkId&&result?.type==='OVER';
 if(!bound)throw new Error('Yoti result does not match the stored account session');
 const method=typeof result.method==='string'?result.method.toUpperCase():'';
 const agePass=result.status==='COMPLETE'&&method==='DOC_SCAN'&&
  result.doc_scan?.allowed===true&&result.doc_scan?.level==='PASSIVE'&&
  result.doc_scan?.authenticity==='AUTO'&&Number(result.doc_scan?.threshold)===18&&
  Number(result.age)===18&&typeof result.evidence_id==='string'&&result.evidence_id.length>0;
 const statuses={PENDING:'pending',IN_PROGRESS:'processing',FAIL:'rejected',CANCELLED:'rejected',
  ERROR:'provider_error',EXPIRED:'expired'};
 // Unknown statuses and completion through another method can never admit a user.
 return {agePass,method,status:result.status==='COMPLETE'?(agePass?'age_confirmed':'review_required'):
  (statuses[result.status]||'provider_error')};
}
