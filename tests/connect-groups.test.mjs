import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGroupHandler} from '../supabase/functions/connect-groups/handler.mjs';
const user='10000000-0000-4000-8000-000000000001';
const group='20000000-0000-4000-8000-000000000002';
const target='30000000-0000-4000-8000-000000000003';
const request=body=>new Request('https://example.test/connect-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function harness({member={id:user},aal='aal1',result={status:'requested'},failure=null}={}){
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:failure?null:result,error:failure?{message:failure,code:'42501'}:null};}};
 return {calls,handler:createGroupHandler({authenticate:async()=>member,assurance:async()=>aal,db})};
}
test('unauthenticated users cannot discover or inspect even public group metadata',async()=>{
 const h=harness({member:null});
 assert.equal((await h.handler(request({action:'discover'}))).status,401);
 assert.equal(h.calls.length,0);
});
test('public discovery never asks backend for a private group identifier or sensitive profile targeting',async()=>{
 const h=harness({result:{items:[{id:group,name:'Reviewed public group'}]}});
 const r=await h.handler(request({action:'discover',query:'community',private_group_id:group,sexual_orientation:'private'}));
 assert.equal(r.status,200);
 assert.deepEqual(h.calls[0],{name:'ccx_group_action',args:{
  p_actor:user,p_action:'discover',p_group:null,p_target:null,p_name:null,p_description:null,
  p_visibility:null,p_rules:null,p_query:'community'
 }});
 const body=await r.text();assert.doesNotMatch(body,/sexual_orientation|private_group_id/);
});
test('owner user IDs and browser-provided admin claims cannot become the RPC actor',async()=>{
 const h=harness({result:{id:group,state:'pending_platform'}});
 const r=await h.handler(request({action:'create',name:'Non-explicit public community',
  description:'Professional interest discussion',rules:'Consent and respect',
  visibility:'public',actor_id:target,admin:true,force_approved:true}));
 assert.equal(r.status,201);
 assert.equal(h.calls[0].args.p_actor,user);
 assert.equal(h.calls[0].args.p_visibility,'public');
 assert.match((await r.json()).note,/awaiting platform review/i);
});
test('private group membership requires a voluntary acceptance action and cannot be forged',async()=>{
 const h=harness({result:{status:'invited'}});
 const r=await h.handler(request({action:'invite',group_id:group,target_user_id:target,force_member:true}));
 assert.equal(r.status,200);
 assert.equal(h.calls[0].args.p_action,'invite');
 assert.equal(h.calls[0].args.p_target,target);
});
test('AAL1 platform administrator cannot approve public group or list moderation queue',async()=>{
 const h=harness({aal:'aal1'});
 for(const payload of [{action:'admin_queue'},{action:'moderate',group_id:group,decision:'approve'}]){
  const r=await h.handler(request(payload));assert.equal(r.status,403);
 }
 assert.equal(h.calls.length,0);
});
test('AAL2 platform group moderation has only approved decision codes',async()=>{
 const h=harness({aal:'aal2',result:{id:group,state:'active'}});
 const r=await h.handler(request({action:'moderate',group_id:group,decision:'approve',secret:'x'}));
 assert.equal(r.status,200);assert.equal(h.calls[0].args.p_visibility,'approve');
 const bad=await h.handler(request({action:'moderate',group_id:group,decision:'force_visible'}));
 assert.equal(bad.status,400);
 assert.equal(h.calls.length,1);
});
test('invalid administrative targets and unknown transitions fail before database access',async()=>{
 const h=harness();
 for(const payload of [{action:'invite',group_id:group,target_user_id:'not-uuid'},
  {action:'delete_all',group_id:group},{action:'create',name:'x',description:'',rules:'',visibility:'public'},
  {action:'approve',group_id:'not-uuid',target_user_id:target}]){
  const r=await h.handler(request(payload));assert.equal(r.status,400);
 }
 assert.equal(h.calls.length,0);
});
test('database denies unauthorized requests with generic safe errors',async()=>{
 const h=harness({failure:'GROUP_ADMIN_REQUIRED'});
 const r=await h.handler(request({action:'members',group_id:group}));
 const info=await r.json();assert.equal(r.status,403,JSON.stringify(info));assert.match(info.error,/administrator/i);
});
test('browser UI exposes admin invitation and approved join, but never public member list or inferred targeting',()=>{
 const ui=fs.readFileSync('src/supabase/ConnectGroups.jsx','utf8');
 const nav=fs.readFileSync('src/supabase/OriginalShell.jsx','utf8');
 const app=fs.readFileSync('src/supabase/SupabaseApp.jsx','utf8');
 assert.match(ui,/Discover public groups/);
 assert.match(ui,/Apply to join group/);
 assert.match(ui,/Accept invitation/);
 assert.match(ui,/Remove member/);
 assert.match(ui,/Private — never publicly listed/);
 assert.match(ui,/membership is private|Group membership is private/i);
 assert.match(nav,/Groups:'groups'/);
 assert.match(app,/tab==='groups'/);
 assert.doesNotMatch(ui,/geolocation|getCurrentPosition/);
});
test('group posts are routed through the existing moderated feed with no group photo widening',()=>{
 const src=fs.readFileSync('supabase/functions/connect-feed/handler.mjs','utf8');
 assert.match(src,/ccx_feed_create_group/);
 assert.match(src,/Group posts currently support moderated text only/);
 const ui=fs.readFileSync('src/supabase/ConnectFeed.jsx','utf8');
 assert.match(ui,/mode:groupId\?'group'/);
 assert.match(ui,/!groupId&&<details/);
});
