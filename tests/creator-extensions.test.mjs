import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCreatorExtensionsHandler} from '../supabase/functions/creator-extensions/handler.mjs';
const actor='10000000-0000-4000-8000-000000000001';
const other='20000000-0000-4000-8000-000000000002';
const cid='30000000-0000-4000-8000-000000000003';
const req=body=>new Request('https://example.test/functions/v1/creator-extensions',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
});
function harness({user={id:actor},blocked=false,friend=false,member=true}={}){
 const calls=[];
 const records={
  account_security:[{user_id:actor,banned:false,suspended:false},{user_id:other,banned:false,suspended:false}],
  member_admissions:[{user_id:actor,admitted_at:'2026-11-19T00:00:00Z'},{user_id:other,admitted_at:'2026-11-19T00:00:00Z'}],
  member_blocks:blocked?[{blocker_id:actor}]:[],
  member_connection_requests:friend?[{id:cid}]:[],
  ccx_profile_travel:[
   {id:cid,user_id:other,entry_type:'travel',city:'Los Angeles',country:'United States',starts_on:'2026-12-01',ends_on:'2026-12-04',visibility:'verified',note:'SECRET'},
   {id:other,user_id:other,entry_type:'travel',city:'Phoenix',country:'United States',starts_on:'2026-12-02',ends_on:'2026-12-05',visibility:'friends',note:'SECRET'},
   {id:actor,user_id:other,entry_type:'available',city:'Vegas',country:'United States',starts_on:'2026-12-06',ends_on:'2026-12-08',visibility:'only_me',note:'SECRET'}
  ],
  collaboration_members:member?[{collaboration_id:cid,user_id:actor}]:[],
  ccx_collaboration_notes:[],
  collaborations:[{id:cid,creator_id:actor,status:'active',requires_work_clearance:true}],
  ccx_collaboration_testing_policy:[],
  contracts:[],
  performer_work_clearances:[],
  ccx_clearance_share_consents:[]
 };
 const db={from(table){
  const q={table,filters:[],max:200};
  const chain={
   select(...args){calls.push({table,operation:'select',args});return chain;},
   eq(col,value){q.filters.push(['eq',col,value]);return chain;},
   not(col,op,value){q.filters.push(['not',col,op,value]);return chain;},
   or(){return chain;},gte(){return chain;},in(){return chain;},order(){return chain;},
   limit(n){q.max=n;return chain;},
   maybeSingle(){calls.push({table,operation:'maybeSingle'});return Promise.resolve({data:filtered()[0]||null,error:null});},
   single(){calls.push({table,operation:'single'});return Promise.resolve({data:filtered()[0]||{id:cid,author_id:actor,note_kind:'manual',note_text:'Documented discussion'},error:null});},
   insert(value){calls.push({table,operation:'insert',value});return chain;},
   upsert(value){calls.push({table,operation:'upsert',value});return Promise.resolve({data:value,error:null});},
   update(value){calls.push({table,operation:'update',value});return chain;},
   delete(){calls.push({table,operation:'delete'});return chain;},
   then(resolve){calls.push({table,operation:'list'});return Promise.resolve({data:filtered(),error:null}).then(resolve);}
  };
  function filtered(){return (records[table]||[]).filter(row=>q.filters.every(([type,col,val])=>type!=='eq'||row[col]===val)).slice(0,q.max);}
  return chain;
 }};
 return {calls,handler:createCreatorExtensionsHandler({authenticate:async()=>user,db})};
}
test('anonymous never accesses private calendar or project',async()=>{
 const h=harness({user:null});
 assert.equal((await h.handler(req({action:'travel_list',user_id:other}))).status,401);
 assert.equal(h.calls.length,0);
});
test('verified public travel only reveals city and dates, never private notes or other visibility',async()=>{
 const h=harness();
 const resp=await h.handler(req({action:'travel_list',user_id:other}));
 assert.equal(resp.status,200);
 const body=await resp.text();
 assert.match(body,/Los Angeles/);
 assert.doesNotMatch(body,/SECRET|Phoenix|Vegas|only_me|note/);
});
test('friend travel appears only when accepted friendship is present',async()=>{
 const h=harness({friend:true});
 const resp=await h.handler(req({action:'travel_list',user_id:other}));
 assert.equal(resp.status,200);
 const body=await resp.text();
 assert.match(body,/Phoenix/);
 assert.doesNotMatch(body,/SECRET|Vegas/);
});
test('blocked users cannot see another person travel',async()=>{
 const h=harness({blocked:true});
 const resp=await h.handler(req({action:'travel_list',user_id:other}));
 assert.deepEqual((await resp.json()).items,[]);
});
test('unrelated users cannot read private project notes',async()=>{
 const h=harness({member:false});
 const resp=await h.handler(req({action:'notes_list',collaboration_id:cid}));
 assert.equal(resp.status,403);
});
test('a collaborator may only add an authored manual note, not forged AI or signed scope content',async()=>{
 const h=harness();
 const resp=await h.handler(req({action:'notes_add',collaboration_id:cid,note_text:'Filming starts at noon.',author_id:other,note_kind:'scope_proposal'}));
 assert.equal(resp.status,201);
 const call=h.calls.find(x=>x.table==='ccx_collaboration_notes'&&x.operation==='insert');
 assert.deepEqual(call.value,{collaboration_id:cid,author_id:actor,note_kind:'manual',note_text:'Filming starts at noon.'});
});
test('only organizer may change clearance policy, not another collaborator',async()=>{
 const h=harness();
 const resp=await h.handler(req({action:'testing_save',collaboration_id:cid,required:true,freshness_days:14}));
 assert.equal(resp.status,200);
 const fields=h.calls.find(x=>x.table==='ccx_collaboration_testing_policy'&&x.operation==='upsert').value;
 assert.equal(fields.updated_by,actor);
 assert.equal(fields.required,true);
});
test('UI exposes travel, member-chosen introductions and independent notes with no raw medical reports',()=>{
 const travel=fs.readFileSync('src/supabase/ProfileTravelCalendar.jsx','utf8');
 const friends=fs.readFileSync('src/supabase/FriendSettingsPanel.jsx','utf8');
 const notes=fs.readFileSync('src/supabase/CollaborationNotesAndTesting.jsx','utf8');
 assert.match(travel,/Travel and availability calendar/);
 assert.match(travel,/Only me/);
 assert.match(friends,/Message and reply first/);
 assert.match(friends,/intro_start/);
 assert.match(notes,/Shared project notes/);
 assert.match(notes,/Testing credential requirements/);
 assert.doesNotMatch(notes,/HIV test result|syphilis lab|STI diagnosis/i);
});
test('friendship request always consults target policy and introduction completion',()=>{
 const backend=fs.readFileSync('supabase/functions/member-workflows/index.ts','utf8');
 assert.match(backend,/ccx_friend_preferences/);
 assert.match(backend,/ccx_friend_introductions/);
 assert.match(backend,/status','completed'/);
});
