import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSafetyHandler} from '../supabase/functions/collaboration-safety/handler.mjs';
const cid='22222222-2222-4222-8222-222222222222',uid='11111111-1111-4111-8111-111111111111';
const request=(body,method='POST')=>new Request('https://example.test/collaboration-safety',{
 method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})
});
const safe={status:'checked_in',checked_in_at:'2026-11-19T20:00:00Z',contact_informed_by_member:true,monitored_emergency_response:false};
const harness=({user={id:uid},result=safe,error=null}={})=>{
 const calls=[];
 const handler=createSafetyHandler({
  authenticate:async()=>user,
  act:async(...args)=>{calls.push(args);return {data:result,error};}
 });
 return {calls,handler};
};
test('not signed in cannot create or read any attendance record',async()=>{
 const h=harness({user:null});
 assert.equal((await h.handler(request({action:'check_in',collaboration_id:cid}))).status,401);
 assert.equal(h.calls.length,0);
});
test('client cannot forge the acting user, recipient or a completed check-in',async()=>{
 const h=harness();
 const response=await h.handler(request({action:'check_in',collaboration_id:cid,user_id:'attacker',approved:true,contact_informed:true}));
 assert.equal(response.status,200);
 assert.deepEqual(h.calls,[[uid,cid,'check_in',true]]);
 const item=(await response.json()).item;
 assert.equal(item.monitored_emergency_response,false);
 assert.equal(item.status,'checked_in');
});
test('unknown actions, malformed identifiers and nonboolean consent are rejected before state mutation',async()=>{
 const h=harness();
 for(const body of [
  {action:'approve',collaboration_id:cid},
  {action:'check_in',collaboration_id:'other-user'},
  {action:'check_in',collaboration_id:cid,contact_informed:'true'},
  {action:'record_concern'},
  ['check_in']
 ]){
  const r=await h.handler(request(body));assert.equal(r.status,400);
 }
 assert.equal(h.calls.length,0);
});
test('member authorization is enforced at the database boundary',async()=>{
 const h=harness({result:null,error:{code:'42501',message:'SAFETY_NOT_PARTICIPANT'}});
 const r=await h.handler(request({action:'status',collaboration_id:cid}));
 assert.equal(r.status,403);assert.match((await r.json()).error,/only available to accepted participants/i);
});
test('no response can imply emergency dispatch or echo private location evidence',async()=>{
 const h=harness({result:{...safe,other_member_id:'SECRET',latitude:32.0,contact_phone:'PRIVATE'}});
 const result=await h.handler(request({action:'status',collaboration_id:cid}));
 const body=await result.text();
 assert.doesNotMatch(body,/SECRET|latitude|contact_phone|PRIVATE/);
 assert.match(body,/"monitored_emergency_response":false/);
 const failed=harness({result:{...safe,monitored_emergency_response:true}});
 assert.equal((await failed.handler(request({action:'status',collaboration_id:cid}))).status,503);
});
test('bounded request body, read-only status and no GET mutation',async()=>{
 const h=harness();
 assert.equal((await h.handler(request({action:'status',collaboration_id:cid,padding:'x'.repeat(7000)}))).status,413);
 const get=await h.handler(request({},'GET'));assert.equal(get.status,405);
 assert.equal(h.calls.length,0);
});
test('Edge authenticates a live Supabase JWT and sends no client-supplied actor ID to RPC',()=>{
 const code=fs.readFileSync('supabase/functions/collaboration-safety/index.ts','utf8');
 assert.match(code,/admin\.auth\.getUser\(/);
 assert.match(code,/ccx_collaboration_safety_action/);
 assert.match(code,/p_actor:userId/);
 assert.doesNotMatch(code,/process\.env|localStorage|GPS|navigator\.geolocation/);
});
test('collaboration UI is embedded only on a private selected record and warns no monitoring',()=>{
 const hub=fs.readFileSync('src/supabase/CollaborationHub.jsx','utf8');
 const ui=fs.readFileSync('src/supabase/CollaborationSafetyCheckin.jsx','utf8');
 assert.match(hub,/detail&&selected&&<section/);
 assert.match(hub,/CollaborationSafetyCheckin key=\{selected\}/);
 assert.match(ui,/Not monitored for emergencies/);
 assert.match(ui,/onNavigate\('consent'/);
 assert.doesNotMatch(ui,/geolocation|getCurrentPosition|watchPosition/);
});
