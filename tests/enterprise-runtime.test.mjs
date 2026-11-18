/** Real Edge handlers, isolated in-memory auth/DB/provider fixtures. No live credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
const uid='00000000-0000-4000-8000-000000000001';
const peer='00000000-0000-4000-8000-000000000002';
const cid='00000000-0000-4000-8000-000000000003';
let handler,state,authenticated,environment,updates,rpcs,rpcResult,queryError;
function reset(){
 authenticated=true;updates=[];rpcs=[];rpcResult={data:{id:cid,status:'accepted'},error:null};queryError=null;
 environment={SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private-fixture',HOSTING_NOTIFIER_JOB_SECRET:'x'.repeat(64),HOSTING_CALENDAR_JOB_SECRET:'y'.repeat(64)};
 state={account_security:[{user_id:uid,admin:true,banned:false,suspended:false},{user_id:peer,admin:true,banned:false,suspended:false}],
 member_admissions:[{user_id:uid,admitted_at:'2026-11-17'},{user_id:peer,admitted_at:'2026-11-17'}],member_subscriptions:[],
 product_feature_flags:['connections','messages','collaborations'].map(key=>({key,enabled:true,allowed_tiers:['free','premium'],rollout_percent:100})),
 member_notifications:[{id:'old',recipient_id:uid,created_at:'2020-01-01',read_at:null},{id:'peer',recipient_id:peer,created_at:'2020-01-01',read_at:null}],
 collaborations:[{id:cid,creator_id:uid,title:'A project',status:'draft'}],collaboration_members:[],member_blocks:[],collaboration_invitations:[]};
}
class Query{
 constructor(table){this.table=table;this.filters=[];this.one=false;this.value=null;this.operation='read';}
 select(){return this;}eq(k,v){this.filters.push(row=>row[k]===v);return this;}in(k,v){this.filters.push(row=>v.includes(row[k]));return this;}
 is(k,v){this.filters.push(row=>row[k]===v);return this;}lte(k,v){this.filters.push(row=>row[k]<=v);return this;}
 order(){return this;}limit(){return this;}range(){return this;}or(){return this;}maybeSingle(){this.one=true;return this;}single(){this.one=true;return this;}
 update(value){this.value=value;this.operation='update';return this;}insert(value){this.value=value;this.operation='insert';return this;}
 then(resolve){
  if(queryError===this.table){resolve({data:null,error:{message:'fixture database error'}});return;}
  const rows=(state[this.table]||[]).filter(row=>this.filters.every(f=>f(row)));
  if(this.operation==='update'){rows.forEach(row=>Object.assign(row,this.value));updates.push({table:this.table,count:rows.length});}
  if(this.operation==='insert'){(state[this.table]??=[]).push(this.value);rows.push(this.value);}
  resolve({data:this.one?(rows[0]||null):rows,error:null,count:rows.length});
 }
}
globalThis.__enterpriseClient=(_url,key)=>key==='public'?{auth:{getUser:async()=>({data:{user:authenticated?{id:uid}:null},error:null})}}:{
 from:table=>new Query(table),rpc:async(name,args)=>{rpcs.push({name,args});return rpcResult;}
};
globalThis.Deno={env:{get:key=>environment[key]},serve:fn=>{handler=fn;}};
const handlers={};
for(const name of ['member-workflows','hosting-calendar','hosting-notification-worker']){
 let js=buildSync({entryPoints:['supabase/functions/'+name+'/index.ts'],bundle:true,write:false,format:'esm',platform:'neutral',external:['npm:*','jsr:*'],logLevel:'silent'}).outputFiles[0].text;
 js=js.replace(/import\s*\{\s*createClient\s*\}\s*from\s*["']npm:@supabase\/supabase-js[^"']*["'];/,'const createClient=globalThis.__enterpriseClient;');
 js=js.replace(/import\s+(\w+)\s+from\s*["']npm:web-push[^"']+["'];/,'const $1={setVapidDetails(){},sendNotification(){throw Error("Provider calls are not allowed in this test");}};');
 assert.doesNotMatch(js,/from ["']npm:/);
 reset();await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')+'#enterprise-'+name);handlers[name]=handler;
}
async function call(name,action,extra={},token='member-token'){
 const res=await handlers[name](new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action,...extra})}));
 return {status:res.status,body:await res.json()};
}
test('mark all read updates only current member, including more than one page',async()=>{
 reset();for(let i=0;i<80;i++)state.member_notifications.push({id:'n'+i,recipient_id:uid,created_at:'2020-01-01',read_at:null});
 const x=await call('member-workflows','mark_all_notifications_read');assert.equal(x.status,200);
 assert.equal(state.member_notifications.filter(n=>n.recipient_id===uid&&n.read_at).length,81);
 assert.equal(state.member_notifications.find(n=>n.recipient_id===peer).read_at,null);
});
test('inactive membership can decline its own invitation without enabling collaboration',async()=>{
 reset();state.account_security[0].admin=false;state.product_feature_flags.find(x=>x.key==='collaborations').enabled=false;
 const x=await call('member-workflows','respond_invitation',{invitation_id:cid,status:'declined'});assert.equal(x.status,200);
 assert.equal(rpcs[0].name,'ccx_respond_collaboration_invitation');assert.equal(rpcs[0].args.p_actor,uid);
 assert.equal((await call('member-workflows','respond_invitation',{invitation_id:cid,status:'accepted'})).status,402);
});
test('invitation RPC actor is authenticated subject, never a spoofed body field',async()=>{
 reset();await call('member-workflows','respond_invitation',{invitation_id:cid,status:'accepted',p_actor:peer,user_id:peer});
 assert.equal(rpcs[0].args.p_actor,uid);
});
test('suspended or blocked targets cannot receive collaboration invitations',async()=>{
 reset();state.account_security[1].suspended=true;
 assert.equal((await call('member-workflows','invite_collaborator',{collaboration_id:cid,invitee_id:peer})).status,403);
 reset();state.member_blocks.push({blocker_id:uid,blocked_id:peer});
 assert.equal((await call('member-workflows','invite_collaborator',{collaboration_id:cid,invitee_id:peer})).status,403);
});
test('closed collaboration cannot send invitations and missing security fails closed',async()=>{
 reset();state.collaborations[0].status='closed';assert.equal((await call('member-workflows','invite_collaborator',{collaboration_id:cid,invitee_id:peer})).status,409);
 reset();state.account_security=[];assert.equal((await call('member-workflows','list_notifications')).status,403);
});
test('calendar external token route and job authentication do not become public APIs',async()=>{
 reset();authenticated=false;assert.equal((await call('hosting-calendar','list')).status,401);
 assert.equal((await call('hosting-calendar','cron_sync',{},'wrong')).status,401);
 const res=await handlers['hosting-calendar'](new Request('https://fixture.invalid?token=invalid'));assert.equal(res.status,404);
});
test('notification worker rejects wrong credentials and disabled integrations never fake delivery',async()=>{
 reset();assert.equal((await call('hosting-notification-worker','run',{},'wrong')).status,401);
 const x=await call('hosting-notification-worker','run',{},'x'.repeat(64));assert.equal(x.status,503);
 assert.equal(rpcs.length,0);
});
