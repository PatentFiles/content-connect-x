import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDocScanSession,evaluateDocScanResult} from '../supabase/functions/ccx-integrations/yotiDocScanPolicy.mjs';
const read=p=>readFileSync(p,'utf8');
const expected={sessionId:'session',reference:'reference',sdkId:'sdk'};
const good=()=>({id:'session',reference_id:'reference',sdk_id:'sdk',type:'OVER',status:'COMPLETE',method:'DOC_SCAN',
 doc_scan:{allowed:true,level:'PASSIVE',authenticity:'AUTO',threshold:18},age:18,evidence_id:'evidence'});
test('new session requires document authenticity, face match and passive liveness only',()=>{
 const p=buildDocScanSession('reference','https://contentconnectx.com');
 assert.deepEqual(p.doc_scan,{allowed:true,threshold:18,retry_limit:2,level:'PASSIVE',authenticity:'AUTO'});
 for(const method of ['age_estimation','digital_id','credit_card','mobile','login','age_key'])assert.equal(p[method].allowed,false,method);
 assert.equal(p.synchronous_checks,true);assert.equal(p.block_biometric_consent,false);
 assert.equal(p.callback.url,'https://contentconnectx.com/?age_verification=complete');
});
test('matching complete ID and selfie proof admits; presentation redirects cannot',()=>{
 assert.equal(evaluateDocScanResult(good(),expected).agePass,true);
 assert.throws(()=>evaluateDocScanResult({age_verification:'complete'},expected),/match/);
 for(const key of ['id','reference_id','sdk_id','type']){
  const value=good();value[key]='another';assert.throws(()=>evaluateDocScanResult(value,expected),/match/);
 }
});
test('face estimation, missing evidence and weakened provider settings never approve',()=>{
 const variants=[{method:'AGE_ESTIMATION'},{age:17},{age:null},{evidence_id:''},{status:'FAIL'},
  {doc_scan:{allowed:true,level:'NONE',authenticity:'AUTO',threshold:18}},
  {doc_scan:{allowed:true,level:'PASSIVE',authenticity:'NONE',threshold:18}},
  {doc_scan:{allowed:false,level:'PASSIVE',authenticity:'AUTO',threshold:18}}];
 for(const v of variants)assert.equal(evaluateDocScanResult({...good(),...v},expected).agePass,false);
});
test('pending/processing/cancelled/expired and unexpected results remain locked',()=>{
 for(const status of ['PENDING','IN_PROGRESS','CANCELLED','EXPIRED','ERROR','UNRECOGNIZED']){
  const result=evaluateDocScanResult({...good(),status},expected);assert.equal(result.agePass,false);assert.notEqual(result.status,'age_confirmed');
 }
});
test('signup UI cannot upload manual ID and provider return cannot create admission',()=>{
 const gate=read('src/supabase/AgeGateOnboarding.jsx'),ui=read('src/supabase/YotiVerification.jsx');
 assert.match(gate,/<YotiVerification/);assert.doesNotMatch(gate+ui,/type=["']file|uploadToSignedUrl|\.from\('member_admissions'\)/);
 assert.match(ui,/https:\/\/age\.yoti\.com/);
 assert.match(read('supabase/functions/submit-age-verification/index.ts'),/410/);
 assert.match(read('supabase/functions/admin-age-review/index.ts'),/Manual age approvals are retired/);
 const fn=read('supabase/functions/yoti-verification/index.ts');
 assert.match(fn,/\.auth\.getUser\(\)/);assert.match(fn,/ccx_reserve_yoti_start/);assert.match(fn,/ccx_finish_yoti_session/);
 assert.match(fn,/policy_version','document_selfie_v1'/);assert.match(fn,/evaluateDocScanResult/);
 assert.doesNotMatch(fn,/createSignedUploadUrl|createSignedUrl|console\.log/);
});
