import test from 'node:test';
import assert from 'node:assert/strict';
import {IdswyftClient, imageType, isAdultOn, summarizeEvaluation, MAX_IMAGE_BYTES, EVALUATED_ENGINE_REVISION} from './idswyft.mjs';
import {storeEvaluationEvidence} from './evidence.mjs';
const ID='11111111-1111-4111-8111-111111111111', USER='22222222-2222-4222-8222-222222222222', RUN='33333333-3333-4333-8333-333333333333';
const KEY='synthetic-key-not-a-real-secret';
// These bytes test only signature handling; they are not a decodable photograph.
const PNG=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const client=fetchImpl=>new IdswyftClient({baseUrl:'https://verify.example.test',apiKey:KEY,fetchImpl});
const good=()=>({success:true,verification_id:ID,verification_mode:'full',is_sandbox:false,
  status:'COMPLETE',final_result:'verified',front_document_uploaded:true,back_document_uploaded:true,
  documents_match:true,live_capture_uploaded:true,face_match_passed:true,liveness_passed:true,
  ocr_data:{date_of_birth:'2000-01-01',expiration_date:'2030-01-01'}});
const options={verificationId:ID,documentType:'drivers_license',onDate:'2026-11-18'};
test('reject insecure URLs, vendor cloud, credentials and paths',()=>{
  for(const baseUrl of ['http://verify.test','https://api.idswyft.app','https://idswyft.app','https://u:p@verify.test','https://verify.test/api','https://verify.test/?q=1']) assert.throws(()=>new IdswyftClient({baseUrl,apiKey:KEY}));
});
test('initialize binds subject, full flow and idempotency; disallows redirects',async()=>{
  let request; const api=client(async(url,init)=>{request={url,init};return json({success:true,verification_id:ID});});
  assert.deepEqual(await api.initialize({subjectId:USER,documentType:'passport',issuingCountry:'US',idempotencyKey:RUN}),{verificationId:ID});
  const body=JSON.parse(request.init.body);assert.equal(body.user_id,USER);assert.equal(body.verification_mode,'full');assert.equal(body.sandbox,false);
  assert.equal(request.init.redirect,'error');assert.equal(request.init.headers['Idempotency-Key'],RUN);
});
test('invalid user is rejected before a network call',async()=>{
  let called=false;const api=client(async()=>{called=true;return json({});});
  await assert.rejects(api.initialize({subjectId:'bad',documentType:'passport',issuingCountry:'US',idempotencyKey:RUN}));assert.equal(called,false);
});
test('selfie uses source API field, not README image field',async()=>{
  let body;const api=client(async(_url,init)=>{body=init.body;return json({success:true,verification_id:ID});});
  await api.upload({verificationId:ID,kind:'selfie',bytes:PNG,idempotencyKey:RUN});assert.equal(body.has('selfie'),true);assert.equal(body.has('image'),false);
});
test('front document includes document type and issuing country',async()=>{
  let body;const api=client(async(_url,init)=>{body=init.body;return json({success:true,verification_id:ID});});
  await api.upload({verificationId:ID,kind:'front',bytes:PNG,idempotencyKey:RUN,documentType:'passport',issuingCountry:'GB'});
  assert.equal(body.get('document_type'),'passport');assert.equal(body.get('issuing_country'),'GB');assert.ok(body.has('document'));
});
test('status rejects a different session',async()=>{
  await assert.rejects(client(async()=>json({success:true,verification_id:USER})).status(ID),/mismatch/);
});
test('reject HTML, failed JSON and oversized response',async()=>{
  await assert.rejects(client(async()=>new Response('<html>')).status(ID),/non-JSON/);
  await assert.rejects(client(async()=>json({success:false})).status(ID),/unsuccessful/);
  await assert.rejects(client(async()=>json({success:true,value:'x'.repeat(600000)})).status(ID),/exceeds limit/);
});
test('timeout fails closed',async()=>{
  const api=new IdswyftClient({baseUrl:'https://verify.test',apiKey:KEY,timeoutMs:5,
    fetchImpl:(_url,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
  await assert.rejects(api.status(ID),/timed out/);
});
test('upstream failure bodies do not leak',async()=>{
  await assert.rejects(client(async()=>new Response('SENSITIVE ID DATA',{status:500})).status(ID),e=>e.message==='Provider HTTP 500');
});
test('validate image signatures and size',()=>{
  assert.equal(imageType(PNG),'image/png');assert.throws(()=>imageType(new Uint8Array(20)));assert.throws(()=>imageType(new Uint8Array(MAX_IMAGE_BYTES+1)));
});
test('eighteenth birthday uses calendar arithmetic',()=>{
  assert.equal(isAdultOn('2008-11-18','2026-11-18'),true);assert.equal(isAdultOn('2008-11-19','2026-11-18'),false);
});
test('invalid, future, ambiguous and implausible DOBs remain unknown',()=>{
  for(const dob of ['01/02/2000','2000-02-30','2027-01-01','1800-01-01','',undefined]) assert.equal(isAdultOn(dob,'2026-11-18'),null);
});
test('leap birthday policy is explicit and conservative',()=>{
  assert.equal(isAdultOn('2008-02-29','2026-02-28'),false);assert.equal(isAdultOn('2008-02-29','2026-03-01'),true);
});
test('successful screening NEVER grants age verification or admission',()=>{
  const result=summarizeEvaluation(good(),options);assert.equal(result.screening_checks_passed,true);
  assert.equal(result.age_verified,false);assert.equal(result.admission_granted,false);assert.equal(result.review_required,true);
});
for(const [name,change,reason] of [
  ['sandbox',{is_sandbox:true},'sandbox_or_unknown_mode'],
  ['unknown sandbox mode',{is_sandbox:undefined},'sandbox_or_unknown_mode'],
  ['document-only flow',{verification_mode:'document_only'},'incomplete_flow'],
  ['missing liveness',{liveness_passed:null},'liveness_not_passed'],
  ['missing face match',{face_match_passed:false},'face_match_not_passed'],
  ['wrong back',{documents_match:false},'back_not_cross_checked'],
  ['manual-review outcome',{final_result:'manual_review'},'provider_not_verified'],
  ['underage DOB',{ocr_data:{date_of_birth:'2010-01-01',expiration_date:'2030-01-01'}},'under_18'],
  ['expired ID',{ocr_data:{date_of_birth:'2000-01-01',expiration_date:'2026-01-01'}},'expiry_requires_review'],
]) test(`${name} fails screening`,()=>{
  const result=summarizeEvaluation({...good(),...change},options);assert.equal(result.screening_checks_passed,false);assert.ok(result.reasons.includes(reason));
});
function fakeDb({publicBucket=false,failIndex=false}={}){
  const uploads=[],removed=[],rows=[];return {uploads,removed,rows,
    storage:{getBucket:async()=>({data:{public:publicBucket}}),from:()=>({
      upload:async(path,bytes,config)=>{uploads.push({path,bytes,config});return {};},
      remove:async paths=>{removed.push(...paths);return {};}})},
    from:()=>({insert:async row=>{rows.push(row);return failIndex?{error:true}:{};}})};
}
const bundle=supabase=>({supabase,fixtureOnly:true,subjectId:USER,verificationId:ID,runId:RUN,
  documentType:'drivers_license',providerResult:good(),onDate:'2026-11-18',engineRevision:EVALUATED_ENGINE_REVISION,
  artifacts:['front','back','selfie'].map(kind=>({kind,bytes:PNG}))});
test('reject public bucket before uploads',async()=>{
  const db=fakeDb({publicBucket:true});await assert.rejects(storeEvaluationEvidence(bundle(db)),/private/);assert.equal(db.uploads.length,0);
});
test('save non-overwriting paths and a whitelisted manifest',async()=>{
  const db=fakeDb(),input=bundle(db);input.providerResult.ocr_data.name='SENSITIVE NAME';input.providerResult.embedding=[1,2,3];
  const result=await storeEvaluationEvidence(input);assert.equal(db.uploads.length,4);assert.ok(db.uploads.every(x=>x.config.upsert===false));
  const manifest=new TextDecoder().decode(db.uploads.at(-1).bytes);assert.equal(manifest.includes('SENSITIVE NAME'),false);assert.equal(manifest.includes('embedding'),false);
  assert.equal(result.admission_granted,false);assert.equal(db.rows[0].manifest_sha256.length,64);
});
test('index failure attempts cleanup',async()=>{
  const db=fakeDb({failIndex:true});await assert.rejects(storeEvaluationEvidence(bundle(db)),/write failed/);assert.equal(db.removed.length,4);
});
test('reject nonfixture use and duplicate artifacts',async()=>{
  const db=fakeDb();await assert.rejects(storeEvaluationEvidence({...bundle(db),fixtureOnly:false}),/Synthetic/);
  const input=bundle(db);input.artifacts[1].kind='front';await assert.rejects(storeEvaluationEvidence(input),/duplicate/);
});
