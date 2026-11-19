import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createActualsHandler} from '../supabase/functions/collaboration-actuals/handler.mjs';
const cid='22222222-2222-4222-8222-222222222222';
const uid='11111111-1111-4111-8111-111111111111';
const key='33333333-3333-4333-8333-333333333333';
const statement={id:key,collaboration_id:cid,actor_id:uid,revision:1,plan_version:2,
 work_completed:'Filmed the proposed interview',deliverables_completed:'Edited photos',
 differences_or_concerns:'Lighting differed',recorded_at:'2026-11-19T20:00:00Z'};
const submit=()=>({action:'submit',collaboration_id:cid,idempotency_key:key,
 work_completed:statement.work_completed,deliverables_completed:statement.deliverables_completed,
 differences_or_concerns:statement.differences_or_concerns});
const req=data=>new Request('https://example.test/collaboration-actuals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
const harness=({user={id:uid},data={statement,replayed:false},error=null}={})=>{
 const calls=[];
 return {calls,handler:createActualsHandler({
   authenticate:async()=>user,call:async args=>{calls.push(args);return {data,error};}
 })};
};
test('anonymous and malformed input never reach the statement RPC',async()=>{
 const anon=harness({user:null});
 assert.equal((await anon.handler(req(submit()))).status,401);
 assert.equal(anon.calls.length,0);
 const h=harness();
 for(const bad of [{action:'update',collaboration_id:cid}, {...submit(),collaboration_id:'wrong'},
  {...submit(),idempotency_key:'bad'}, {...submit(),work_completed:'abc'}, {...submit(),deliverables_completed:'a'.repeat(4100)}]){
  // Set a deliberately invalid identifier after spreading a valid sample.
  if(bad.collaboration_id==='wrong')bad.collaboration_id='wrong';
  const response=await h.handler(req(bad));
  if(bad.action==='update'||bad.collaboration_id==='wrong'||bad.idempotency_key==='bad'||bad.work_completed==='abc'||bad.deliverables_completed?.length>4000)
    assert.equal(response.status,400);
 }
 assert.equal(h.calls.length,0);
});
test('submitted actor is server-supplied rather than accepted from browser data',async()=>{
 const h=harness();
 const response=await h.handler(req({...submit(),actor_id:'forged',revision:999,plan_version:999,approved:true}));
 assert.equal(response.status,200);
 assert.equal(h.calls.length,1);
 assert.deepEqual(h.calls[0],{p_actor:uid,p_collaboration:cid,p_action:'submit',
  p_idempotency:key,p_work:statement.work_completed,p_deliverables:statement.deliverables_completed,
  p_differences:statement.differences_or_concerns});
 const body=await response.json();assert.equal(body.statement.revision,1);
});
test('only allowed statement fields are returned, not internal idempotency or evidence URLs',async()=>{
 const secret={...statement,idempotency_key:'PRIVATE',passport:'PRIVATE',raw_media:'PRIVATE'};
 const h=harness({data:{statement:secret,replayed:false}});
 const response=await h.handler(req(submit()));
 const body=await response.text();
 assert.equal(response.status,200);
 assert.doesNotMatch(body,/PRIVATE|passport|raw_media|idempotency_key/);
});
test('list returns participant statements only and does not disclose hidden columns',async()=>{
 const h=harness({data:{statements:[{...statement,access_token:'SECRET'}]}});
 const response=await h.handler(req({action:'list',collaboration_id:cid,actor_id:'attacker'}));
 const data=await response.json();
 assert.equal(response.status,200);assert.equal(data.statements.length,1);
 assert.equal(data.statements[0].access_token,undefined);
 assert.equal(h.calls[0].p_actor,uid);
 assert.equal(h.calls[0].p_idempotency,null);
});
test('database access rejection and invalid idempotency have safe client outcomes',async()=>{
 const denied=harness({data:null,error:{code:'42501',message:'ACTUALS_NOT_PARTICIPANT'}});
 assert.equal((await denied.handler(req({action:'list',collaboration_id:cid}))).status,403);
 const duplicate=harness({data:null,error:{code:'22023',message:'ACTUALS_IDEMPOTENCY_REUSED'}});
 assert.equal((await duplicate.handler(req(submit()))).status,409);
 const unavailable=harness({data:null,error:{code:'22023',message:'ACTUALS_NOT_YET_AVAILABLE'}});
 assert.equal((await unavailable.handler(req(submit()))).status,409);
});
test('unexpected backend result cannot be presented as a completed statement',async()=>{
 const h=harness({data:{ok:true}});
 assert.equal((await h.handler(req(submit()))).status,503);
});
test('current JWT is verified and handler cannot directly alter contracts/consent',()=>{
 const wrapper=fs.readFileSync('supabase/functions/collaboration-actuals/index.ts','utf8');
 const handler=fs.readFileSync('supabase/functions/collaboration-actuals/handler.mjs','utf8');
 assert.match(wrapper,/admin\.auth\.getUser/);
 assert.match(wrapper,/ccx_collaboration_actual_action/);
 assert.match(handler,/p_actor:user\.id/);
 assert.doesNotMatch(wrapper+/\n/+handler,/UPDATE\s+.*contracts|UPDATE\s+.*consents|member_admissions\)\.insert/i);
});
test('frontend never claims a participant account is an agreed amendment or authoritative proof',()=>{
 const ui=fs.readFileSync('src/supabase/CollaborationActualStatements.jsx','utf8');
 const hub=fs.readFileSync('src/supabase/CollaborationHub.jsx','utf8');
 assert.match(ui,/Statements are not independently verified facts/i);
 assert.match(ui,/statement, consent, contract, or rights/i);
 assert.match(ui,/new immutable revision/i);
 assert.match(hub,/CollaborationActualStatements key=\{'actuals-'/);
});
