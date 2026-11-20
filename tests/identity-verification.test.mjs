import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decide,eligibilityDate,legalName,nameKey,isoDate,validateCapture,SCHEMA,ENGINE_REVISION,PHASES,publicMessage} from '../supabase/functions/identity-verification/policy.mjs';
import {createHandler} from '../supabase/functions/identity-verification/handler.mjs';
const userId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222';
const hash='a'.repeat(64);
const fixture=()=>{
 const session={id:sessionId,user_id:userId,legal_name:'Jane Anne Doe',document_type:'drivers_license',issuing_country:'US',status:'collecting',reason:'collecting',expires_at:'2026-11-18T23:59:59Z',evidence:Object.fromEntries(['front','back','selfie','capture'].map(k=>[k,{sha256:hash,path:`${userId}/${sessionId}/${k}.jpg`}]))};
 const report={schema:SCHEMA,engine_revision:ENGINE_REVISION,session_id:sessionId,evidence_hashes:Object.fromEntries(Object.keys(session.evidence).map(k=>[k,hash])),document:{type:'drivers_license',country:'US',name:'Jane Anne Doe',dob:'1990-05-20',expiry:'2030-05-20',number:'SYNTHETIC-ONLY',fields_confident:true,cross_checked:true,authenticity_passed:true},face:{matched:true,distance:0.31,liveness_passed:true,frame_identity_passed:true}};
 return {session,report};
};
for(const [dob,want] of [['2008-11-18','2026-11-19'],['2008-12-31','2027-01-01'],['2008-02-29','2026-03-02'],['2006-02-28','2024-02-29'],['2000-01-01','2018-01-02']])test(`calendar eligibility ${dob}`,()=>assert.equal(eligibilityDate(dob),want));
for(const value of ['2008-02-30','11/18/2008','2008-13-01','',null,'0000-01-01'])test(`reject ambiguous or invalid date ${value}`,()=>assert.equal(isoDate(value),null));
test('age is read from DOB, not a facial age estimate',()=>{const {session,report}=fixture();report.document.dob='2010-01-01';report.face.estimated_age=55;assert.equal(decide(report,session,'2026-11-18').status,'age_restricted');});
test('eighteenth birthday remains restricted',()=>{const {session,report}=fixture();report.document.dob='2008-11-18';const d=decide(report,session,'2026-11-18');assert.equal(d.reason,'birthday_wait');assert.equal(d.eligible_on,'2026-11-19');});
test('next day passes age screening',()=>{const {session,report}=fixture();report.document.dob='2008-11-18';assert.equal(decide(report,session,'2026-11-19').status,'approved');});
test('a name mismatch is not approval',()=>{const {session,report}=fixture();session.legal_name='Jane Smith';assert.equal(decide(report,session,'2026-11-18').status,'name_mismatch');});
test('case and ordinary whitespace normalize without removing identity tokens',()=>{assert.equal(nameKey('  JANE   ANNE DOE '),nameKey('Jane Anne Doe'));assert.notEqual(nameKey('Jane Doe'),nameKey('Jane Anne Doe'));assert.notEqual(nameKey('José Doe'),nameKey('Jose Doe'));});
test('single-part and Unicode legal names are accepted',()=>{assert.equal(legalName('李'),'李');assert.equal(legalName('Sukarno'),'Sukarno');});
for(const [label,mutate] of [
 ['different account session',r=>r.session_id=userId],['wrong engine revision',r=>r.engine_revision='latest'],['no selfie hash',r=>delete r.evidence_hashes.selfie],
 ['missing document check',r=>delete r.document.cross_checked],['string true is not boolean',r=>r.document.authenticity_passed='true'],
 ['low OCR confidence flag',r=>r.document.fields_confident=false],['future DOB',r=>r.document.dob='2030-01-01'],['unreadable DOB',r=>r.document.dob='01/01/90'],
 ['expired ID',r=>r.document.expiry='2020-01-01'],['face mismatch',r=>r.face.matched=false],['no liveness',r=>r.face.liveness_passed=false],
 ['different person in motion frames',r=>r.face.frame_identity_passed=false],['unbounded match score',r=>r.face.distance=Infinity],['negative match score',r=>r.face.distance=-1]
])test(`fails closed: ${label}`,()=>{const {session,report}=fixture();mutate(report);assert.equal(decide(report,session,'2026-11-18').status,'review_required');});
test('age restriction takes precedence over name correction',()=>{const {session,report}=fixture();session.legal_name='Changed Name';report.document.dob='2010-01-01';assert.equal(decide(report,session,'2026-11-18').status,'age_restricted');});
const captureFixture=()=>({challenge_id:sessionId,challenge_type:'head_turn',directions:['left','right'],start_timestamp:0,end_timestamp:18000,frames:PHASES.map((phase,i)=>({phase,timestamp:[0,4000,8000,10000,14000,18000][i],frame_base64:'QUFBQUFBQUFBQUFB'}))});
test('two complete server-bound head turns accepted structurally',()=>assert.equal(validateCapture(captureFixture(),{challenge_id:sessionId,directions:['left','right']}).frames.length,6));
test('challenge replay to another session rejected',()=>assert.throws(()=>validateCapture(captureFixture(),{challenge_id:userId,directions:['left','right']})));
test('changing the assigned directions rejected',()=>assert.throws(()=>validateCapture(captureFixture(),{challenge_id:sessionId,directions:['right','left']})));
test('instant fabricated timing rejected',()=>{const c=captureFixture();c.frames[2].timestamp=4500;assert.throws(()=>validateCapture(c,{challenge_id:sessionId,directions:c.directions}));});
test('underage message explains restriction and review',()=>assert.match(publicMessage('age_restricted','under_18','2028-01-02'),/not permitted.*2028-01-02.*request a review/));

function harness({user={id:userId,email_confirmed_at:'2026-11-01'},adminRole=false,enabled=true,reportOverride,sessionOverride,admitted=false,assuranceLevel='aal1'}={}){
 const {session,report}=fixture();Object.assign(session,sessionOverride||{});
 const calls=[];const rows={account_security:[{user_id:userId,admin:adminRole,banned:false,suspended:false}],ccx_idv_config:[{singleton:true,enabled,notice_text:'Synthetic notice for offline tests only.',notice_version:'fixture',supported_countries:['US'],worker_origin:'https://ccx-test.up.railway.app'}],ccx_idv_sessions:[session],ccx_idv_accounts:[],member_profiles:[{id:userId,real_name:'Jane Anne Doe'}],ccx_idv_review_cases:session.review_requested_at?[{session_id:sessionId,status:'queued',disposition:null}]:[],member_admissions:admitted?[{id:'fixture',user_id:userId}]:[]};
 const db={from(table){const filters=[];let mode='select',record;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},order(){return q;},limit(){return q;},single(){return q;},maybeSingle(){return q;},insert(v){mode='insert';record=v;return q;},then(resolve){calls.push({table,mode,record});const selected=(rows[table]||[]).filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:mode==='insert'?null:selected[0]||null,error:null}).then(resolve);}};return q;},
 rpc(name,args){calls.push({rpc:name,args});if(name==='ccx_idv_maintenance_authorized')return Promise.resolve({data:false,error:null});if(name==='ccx_idv_transition'){
  if(args.p_action==='begin')return Promise.resolve({data:{...session,status:'processing'},error:null});
  if(args.p_action==='finish')return Promise.resolve({data:{...session,status:args.p_data.checks_passed?'approved':'review_required'},error:null});
  if(args.p_action==='fail')return Promise.resolve({data:{...session,status:'retryable_error'},error:null});
  return Promise.resolve({data:null,error:{message:'INVALID_CAPABILITY'}});
 }if(name==='ccx_idv_review_case')return Promise.resolve({data:args.p_action==='list'?{cases:[{id:sessionId,case_status:'queued',verification_status:'review_required'}],reviewer_id:userId}:{id:sessionId,case_status:args.p_action==='claim'?'claimed':'closed'},error:null});
 if(name==='ccx_idv_request_retake')return Promise.resolve({data:{...session,status:'collecting',reason:'retake_requested',evidence_revision:1,evidence:{back:session.evidence.back,selfie:session.evidence.selfie,capture:session.evidence.capture}},error:null});
 throw Error('Unexpected RPC');},storage:{from(){return {createSignedUrl(path){calls.push({signed:path});return Promise.resolve({data:{signedUrl:'https://yxuqbygykpfbioslljlf.supabase.co/storage/v1/object/sign/ccx-identity-evidence/'+path},error:null});}};}}};
 const handler=createHandler({admin:db,authenticate:async()=>user,assurance:async()=>assuranceLevel,clock:()=>new Date('2026-11-18T12:00:00Z'),fetchImpl:async()=>new Response(JSON.stringify(reportOverride||report),{status:200})});
 return {calls,handler,invoke:body=>handler(new Request('https://example.test/identity-verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
test('a new verification session must match the registered account legal name, not a stage name',async()=>{
 const bad=harness();
 const mismatch=await bad.invoke({action:'start',consent:true,document_type:'drivers_license',issuing_country:'US',legal_name:'Someone Different',notice_version:'fixture'});
 assert.equal(mismatch.status,409);
 assert.equal(bad.calls.some(c=>c.args?.p_action==='start'),false);
 const good=harness();
 await good.invoke({action:'start',consent:true,document_type:'drivers_license',issuing_country:'US',legal_name:'Jane Anne Doe',notice_version:'fixture'});
 const call=good.calls.find(c=>c.args?.p_action==='start');
 assert.equal(call?.args?.p_data?.legal_name,'Jane Anne Doe');
});
test('atomic approval cannot replace an unverified registered legal name',()=>{
 const migration=fs.readFileSync('supabase/migrations/20261120195550_account_name_verification_binding.sql','utf8');
 assert.match(migration,/public\.member_profiles p/);
 assert.match(migration,/p\.real_name is not null/);
 assert.match(migration,/registered_legal_name_mismatch/);
 assert.doesNotMatch(migration,/update public\.member_profiles set real_name=s\.extracted_name/);
});
test('anonymous requests cannot read verification state',async()=>{const h=harness({user:null});assert.equal((await h.invoke({action:'status'})).status,401);assert.equal(h.calls.length,0);});
test('browser cannot post an approval action',async()=>{const h=harness();assert.equal((await h.invoke({action:'approve',age_verified:true})).status,400);assert.equal(h.calls.some(c=>c.rpc),false);});
test('non-owner cannot submit another session',async()=>{const h=harness({sessionOverride:{user_id:'33333333-3333-4333-8333-333333333333'}});assert.equal((await h.invoke({action:'submit',session_id:sessionId})).status,404);});
test('disabled integration rejects evidence submission',async()=>{const h=harness({enabled:false});assert.equal((await h.invoke({action:'submit',session_id:sessionId})).status,503);});
test('trusted worker is called and only its result reaches finalization',async()=>{const h=harness();const r=await h.invoke({action:'submit',session_id:sessionId,dob:'2015-01-01',legal_name:'Attacker Value'});assert.equal(r.status,200);const c=h.calls.find(c=>c.args?.p_action==='finish');assert.equal(c.args.p_data.dob,'1990-05-20');assert.equal(c.args.p_data.extracted_name,'Jane Anne Doe');});
test('browser-provided passed flag cannot compensate for missing worker checks',async()=>{const h=harness({reportOverride:{schema:SCHEMA}});await h.invoke({action:'submit',session_id:sessionId,checks_passed:true});assert.equal(h.calls.find(c=>c.args?.p_action==='finish').args.p_data.checks_passed,false);});
test('status responses never include DOB, document paths or job capabilities',async()=>{const h=harness({sessionOverride:{dob:'1990-05-20',job_hash:'SECRET',document_fingerprint:'PRIVATE'}});const r=await h.invoke({action:'status'});const text=await r.text();for(const forbidden of ['1990-05-20','SECRET','PRIVATE',`${userId}/${sessionId}/`])assert.equal(text.includes(forbidden),false);assert.equal(r.headers.get('Cache-Control'),'no-store');});
test('non-admin cannot read the review queue',async()=>{const h=harness();assert.equal((await h.invoke({action:'admin_list'})).status,403);});
test('admin cannot review their own evidence',async()=>{const h=harness({adminRole:true,admitted:true});assert.equal((await h.invoke({action:'admin_document',session_id:sessionId,kind:'selfie',reason:'Testing own evidence access'})).status,403);});
test('invalid worker capability rejected before any database read',async()=>{const h=harness({user:null});assert.equal((await h.invoke({action:'worker_claim',session_id:sessionId,token:'bad'})).status,401);assert.equal(h.calls.length,0);});
test('retention job requires an independent maintenance capability',async()=>{const h=harness({user:null});assert.equal((await h.invoke({action:'purge'})).status,401);});
test('malformed action is a client error',async()=>{const h=harness();assert.equal((await h.invoke({action:123})).status,400);});

test('retake is owner-bound and only accepts an ID side or the camera challenge',async()=>{
 const h=harness({sessionOverride:{status:'review_required'}});
 const bad=await h.invoke({action:'retake',session_id:sessionId,kind:'selfie'});
 assert.equal(bad.status,400);
 assert.equal(h.calls.some(c=>c.rpc==='ccx_idv_request_retake'),false);
 const good=await h.invoke({action:'retake',session_id:sessionId,kind:'front'});
 assert.equal(good.status,200);
 assert.equal((await good.json()).session.evidence_revision,1);
 const call=h.calls.find(c=>c.rpc==='ccx_idv_request_retake');
 assert.deepEqual(call.args,{p_user:userId,p_session:sessionId,p_kind:'front'});
});
test('retake cannot address another member session',async()=>{
 const h=harness({sessionOverride:{user_id:'33333333-3333-4333-8333-333333333333',status:'review_required'}});
 assert.equal((await h.invoke({action:'retake',session_id:sessionId,kind:'front'})).status,404);
 assert.equal(h.calls.some(c=>c.rpc==='ccx_idv_request_retake'),false);
});


test('deployed identity entrypoint bundles the checked-in handler rather than a stale remote SHA',()=>{
 const wrapper=fs.readFileSync('supabase/functions/identity-verification/index.ts','utf8');
 const handler=fs.readFileSync('supabase/functions/identity-verification/handler.mjs','utf8');
 assert.match(wrapper,/import \{createHandler\} from '\.\/handler\.mjs'/);
 assert.doesNotMatch(wrapper,/raw\.githubusercontent\.com|https:\/\/.*handler\.mjs/);
 assert.match(handler,/ccx_idv_request_retake/);
 assert.match(handler,/ccx_idv_upload_versioned/);
 assert.match(handler,/from '\.\/policy\.mjs'/);
});

test('admin evidence queue requires a current AAL2 MFA-authenticated session',async()=>{
 const h=harness({adminRole:true,admitted:true,assuranceLevel:'aal1'});
 const result=await h.invoke({action:'admin_list'});
 assert.equal(result.status,403);
 assert.match((await result.json()).error,/two-factor/i);
 assert.equal(h.calls.some(c=>c.rpc==='ccx_idv_review_case'),false);
});
test('AAL2 reviewer can see only bounded case summaries through privileged RPC',async()=>{
 const h=harness({adminRole:true,admitted:true,assuranceLevel:'aal2'});
 const result=await h.invoke({action:'admin_list'});
 assert.equal(result.status,200);
 const json=await result.json();
 assert.equal(json.sessions.length,1);
 assert.equal(json.reviewer_id,userId);
 assert.equal(h.calls.find(c=>c.rpc==='ccx_idv_review_case').args.p_actor,userId);
 assert.equal(JSON.stringify(json).includes('Jane Anne Doe'),false);
});
test('admin claim and closure calls never accept browser approval decisions',async()=>{
 const h=harness({adminRole:true,admitted:true,assuranceLevel:'aal2'});
 const result=await h.invoke({action:'admin_case',session_id:sessionId,operation:'claim',approved:true,age_verified:true});
 assert.equal(result.status,200);
 const c=h.calls.find(x=>x.rpc==='ccx_idv_review_case');
 assert.deepEqual(c.args,{p_actor:userId,p_session:sessionId,p_action:'claim',p_disposition:null});
 const invalid=await h.invoke({action:'admin_case',session_id:sessionId,operation:'approve'});
 assert.equal(invalid.status,400);
});
test('a private ID image requires both AAL2 and an assigned-review authorization',async()=>{
 const owner='33333333-3333-4333-8333-333333333333';
 const evidence=Object.fromEntries(['front','back','capture','selfie'].map(k=>[k,{path:owner+'/'+sessionId+'/'+k+'.jpg',sha256:hash}]));
 const noMfa=harness({adminRole:true,admitted:true,assuranceLevel:'aal1',sessionOverride:{user_id:owner,evidence}});
 const denied=await noMfa.invoke({action:'admin_document',session_id:sessionId,kind:'front',reason:'Investigating a reported OCR misread'});
 assert.equal(denied.status,403);
 assert.equal(noMfa.calls.some(c=>c.signed),false);
 const withMfa=harness({adminRole:true,admitted:true,assuranceLevel:'aal2',sessionOverride:{user_id:owner,evidence}});
 const allowed=await withMfa.invoke({action:'admin_document',session_id:sessionId,kind:'front',reason:'Investigating a reported OCR misread'});
 assert.equal(allowed.status,200);
 const claim=withMfa.calls.find(c=>c.rpc==='ccx_idv_review_case');
 assert.equal(claim.args.p_action,'authorize_read');
 assert.equal(claim.args.p_actor,userId);
 assert.equal(withMfa.calls.filter(c=>c.signed).length,1);
});
test('admin identity AAL2 comes from Supabase Auth verification, not UI metadata',()=>{
 const code=fs.readFileSync('supabase/functions/identity-verification/index.ts','utf8');
 assert.match(code,/mfa\.getAuthenticatorAssuranceLevel\(/);
 assert.match(code,/getUser\(/);
 assert.match(code,/authorization\.slice\(7\)/);
});
