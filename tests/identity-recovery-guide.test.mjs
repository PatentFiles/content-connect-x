import test from 'node:test';
import assert from 'node:assert/strict';
import {identityRecoveryGuide} from '../src/supabase/identityRecoveryGuide.mjs';

test('OCR uncertainty offers retake and qualified review, never an identity allegation',()=>{
 const guide=identityRecoveryGuide('review_required','id_expired_or_unclear');
 assert.equal(guide.kind,'document');
 assert.match(guide.steps.join(' '),/clearer|misread|photo|capture/i);
 assert.doesNotMatch(guide.steps.join(' '),/automatically approve|fake ID|fraud committed/i);
});
test('face/liveness uncertainty is distinct from ID authenticity',()=>{
 const guide=identityRecoveryGuide('review_required','face_or_liveness_not_verified');
 assert.equal(guide.kind,'camera');
 assert.match(guide.steps.join(' '),/head.turn|selfie|camera/i);
});
test('linked evidence or engine mismatch cannot be bypassed',()=>{
 for(const reason of ['engine_contract_mismatch','evidence_mismatch']){
  const guide=identityRecoveryGuide('review_required',reason);
  assert.equal(guide.kind,'technical');
  assert.match(guide.note,/do not bypass/i);
 }
});
test('private name correction preserves display names and allows appeal if OCR was wrong',()=>{
 const guide=identityRecoveryGuide('name_mismatch','legal_name_mismatch');
 assert.match(guide.steps.join(' '),/public profile name stays unchanged/i);
 assert.match(guide.steps.join(' '),/misread/i);
});
test('age restrictions show eligible date but do not grant admission',()=>{
 const guide=identityRecoveryGuide('age_restricted','under_18',{eligibleOn:'2032-01-01'});
 assert.ok(guide.steps.join(' ').includes('2032-01-01'));
 assert.match(guide.note,/never grants automatic account access/);
});
test('retryable transport error is not treated as an identity failure',()=>{
 const guide=identityRecoveryGuide('retryable_error','worker_unavailable');
 assert.match(guide.note,/network problem/i);
});
test('pilot never promises live account approval and passed/processing have no retry card',()=>{
 const result=identityRecoveryGuide('review_required','document_checks_incomplete',{testing:true});
 assert.match(result.note,/Private testing cannot approve/i);
 assert.equal(identityRecoveryGuide('approved','checks_passed'),null);
 assert.equal(identityRecoveryGuide('processing','processing'),null);
});
