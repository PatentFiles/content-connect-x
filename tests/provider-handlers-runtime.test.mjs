/** Actual Edge handlers with synthetic credentials and rolled-up database fixtures.
 * Does not call live Yoti, CCBill, Supabase or a real consumer payment form.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {relaySignature,relayMessage} from '../supabase/functions/_shared/ccbillPolicy.mjs';
const uid='10000000-0000-4000-8000-000000000001',peer='10000000-0000-4000-8000-000000000002',sid='20000000-0000-4000-8000-000000000001';
let handler,environment,state,authOK,rpcs,queryError,providerResult,providerCalls,allowRate;
function reset(){
 authOK=true;rpcs=[];queryError=null;providerCalls=[];allowRate=true;
 environment={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',
  YOTI_API_KEY:'yoti-fixture-never-live',YOTI_SDK_ID:sid,CCBILL_CLIENT_ACCNUM:'900100',CCBILL_MEMBERSHIP_SUBACC:'0001',
  CCBILL_MEMBERSHIP_FLEX_ID:sid,CCBILL_MEMBERSHIP_SALT:'fixture-salt-123',CCBILL_WEBHOOK_RELAY_SECRET:'fixture-never-live-secret-'.repeat(3),
  CCBILL_EVENT_TIMEZONE:'UTC',CCBILL_MEMBERSHIP_APPROVED:'true',CCBILL_MEMBERSHIP_LIVE_APPROVED:'true'};
 state={account_security:[{user_id:uid,admin:true,banned:false,suspended:false}],member_admissions:[{user_id:uid,admitted_at:'2026-11-17'}],
 ccx_integrations:[{provider:'yoti',enabled:true,callback_origin:'https://contentconnectx.com'},{provider:'ccbill',enabled:true}],
 member_subscriptions:[],ccx_age_provider_sessions:[],ccx_membership_payment_events:[]};
 providerResult={id:sid,expires_at:new Date(Date.now()+900000).toISOString()};
}
class Query{
 constructor(table){this.table=table;this.filters=[];this.one=false;this.action='read';this.value=null;}
 select(){return this;}eq(k,v){this.filters.push(row=>row[k]===v);return this;}order(){return this;}limit(){return this;}
 maybeSingle(){this.one=true;return this;}single(){this.one=true;return this;}
 insert(v){this.value=v;this.action='insert';return this;}
 then(resolve){
  if(queryError===this.table){resolve({data:null,error:{message:'fixture-db-error'}});return;}
  if(this.action==='insert')(state[this.table]??=[]).push(this.value);
  const rows=(state[this.table]||[]).filter(row=>this.filters.every(f=>f(row)));
  resolve({data:this.one?(rows[0]||null):rows,error:null});
 }
}
globalThis.__providerClient=(_url,key)=>key==='fixture-public'?{auth:{getUser:async()=>({data:{user:authOK?{id:uid}:null},error:null})}}:{
 from:t=>new Query(t),rpc:async(name,args)=>{rpcs.push({name,args});
  if(name==='ccx_reserve_yoti_start')return {data:allowRate,error:null};
  if(name==='ccx_finish_yoti_session')return {data:{status:args.p_status,age_verified:args.p_status==='age_confirmed'},error:null};
  if(name==='ccx_start_membership_checkout')return {data:{amount_cents:1999,checkout_nonce:sid,period_days:30,expires_at:new Date(Date.now()+1800000).toISOString()},error:null};
  if(name==='ccx_apply_membership_event')return {data:{ok:true,status:'applied'},error:null};
  throw Error('Unexpected RPC '+name);
 }};
globalThis.__providerFetch=async(url,options)=>{providerCalls.push({url,options});return Response.json(providerResult);};
globalThis.Deno={env:{get:k=>environment[k]},serve:fn=>{handler=fn;}};
const handlers={};
for(const name of ['yoti-verification','membership-billing','membership-ccbill-webhook','submit-age-verification']){
 let js=buildSync({entryPoints:[`supabase/functions/${name}/index.ts`],bundle:true,write:false,platform:'node',format:'esm',external:['npm:*'],logLevel:'silent'}).outputFiles[0].text;
 js=js.replace(/import\s*\{\s*createClient\s*\}\s*from\s*["']npm:@supabase\/supabase-js[^"']*["'];/,'const createClient=globalThis.__providerClient;');
 js='const fetch=(...args)=>globalThis.__providerFetch(...args);\n'+js;
 reset();await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')+'#provider-'+name);handlers[name]=handler;
}
async function call(name,action,extra={}){
 const response=await handlers[name](new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture-token','content-type':'application/json'},body:JSON.stringify({action,...extra})}));
 return {status:response.status,body:await response.json()};
}
test('unauthenticated enrollment and billing do not start provider sessions',async()=>{
 reset();authOK=false;assert.equal((await call('yoti-verification','yoti_start')).status,401);
 assert.equal((await call('membership-billing','create_checkout')).status,401);assert.equal(providerCalls.length,0);assert.equal(rpcs.length,0);
});
test('Yoti handler forces document/selfie and trusted redirect regardless of caller payload',async()=>{
 reset();const r=await call('yoti-verification','yoti_start',{mode:'age_estimation',callback_origin:'https://evil.invalid'});
 assert.equal(r.status,201);const p=JSON.parse(providerCalls[0].options.body);
 assert.equal(p.doc_scan.level,'PASSIVE');assert.equal(p.doc_scan.authenticity,'AUTO');assert.equal(p.age_estimation.allowed,false);
 assert.equal(p.callback.url,'https://contentconnectx.com/?age_verification=complete');
 assert.equal(state.ccx_age_provider_sessions[0].policy_version,'document_selfie_v1');
 assert.equal(state.ccx_age_provider_sessions[0].user_id,uid);assert.equal(rpcs[0].args.p_user,uid);
});
test('Yoti rate denial and disabled provider do not call a billable provider endpoint',async()=>{
 reset();allowRate=false;assert.equal((await call('yoti-verification','yoti_start')).status,429);assert.equal(providerCalls.length,0);
 reset();state.ccx_integrations[0].enabled=false;assert.equal((await call('yoti-verification','yoti_start')).status,503);assert.equal(providerCalls.length,0);
});
test('untrusted Yoti result cannot reach approval RPC; completed expired sessions can be checked',async()=>{
 reset();state.ccx_age_provider_sessions.push({id:uid,user_id:uid,mode:'age_gate',policy_version:'document_selfie_v1',provider_session_id:sid,reference_id:peer,status:'pending',expires_at:'2020-01-01'});
 providerResult={id:sid,sdk_id:sid,reference_id:'wrong',type:'OVER',status:'COMPLETE',method:'DOC_SCAN',age:18,evidence_id:'fixture'};
 assert.equal((await call('yoti-verification','yoti_status',{refresh:true})).status,503);assert.equal(rpcs.length,0);
 providerResult={...providerResult,reference_id:peer,doc_scan:{allowed:true,level:'PASSIVE',authenticity:'AUTO',threshold:18}};
 const r=await call('yoti-verification','yoti_status',{refresh:true});assert.equal(r.status,200);assert.equal(r.body.age_verified,true);
 assert.equal(rpcs[0].name,'ccx_finish_yoti_session');assert.equal(rpcs[0].args.p_user,uid);
});
test('manual uploads endpoint is retired even for a signed-in account',async()=>{
 reset();assert.equal((await call('submit-age-verification','upload',{id_path:'fixture'})).status,410);assert.equal(rpcs.length,0);
});
test('membership uses server price and real authenticated subject, not forged body price/actor',async()=>{
 reset();const r=await call('membership-billing','create_checkout',{plan_code:'creator_pro',user_id:peer,price:0});assert.equal(r.status,201);
 assert.equal(rpcs[0].args.p_user,uid);assert.equal(new URL(r.body.checkout_url).searchParams.get('initialPrice'),'19.99');assert.equal(r.body.period_days,30);
 assert.doesNotMatch(JSON.stringify(r.body),/fixture-salt|fixture-never-live-secret/);
});
test('unconfigured recurring membership fails closed and status does not expose credentials',async()=>{
 reset();delete environment.CCBILL_MEMBERSHIP_SALT;const r=await call('membership-billing','status');assert.equal(r.status,200);assert.equal(r.body.ready,false);
 assert.equal((await call('membership-billing','create_checkout',{plan_code:'creator_pro'})).status,503);assert.equal(rpcs.length,0);
});
test('real membership webhook handler rejects unsigned, mutated and cross-scope callbacks',async()=>{
 reset();const type='application/json',query='clientAccnum=900100&clientSubacc=0001&eventType=NewSaleSuccess';
 const timestamp=String(Math.floor(Date.now()/1000)),raw=JSON.stringify({subscriptionId:'123',transactionId:'456','X-ccx_membership':sid,timestamp:new Date().toISOString().slice(0,19).replace('T',' '),subscriptionInitialPrice:'19.99',subscriptionRecurringPrice:'19.99',subscriptionCurrencyCode:'840',initialPeriod:'30',recurringPeriod:'30',nextRenewalDate:new Date(Date.now()+30*86400000).toISOString().slice(0,19).replace('T',' ')});
 const headers={'content-type':type,'x-ccx-query':query,'x-ccx-timestamp':timestamp};
 let res=await handlers['membership-ccbill-webhook'](new Request('https://fixture.invalid',{method:'POST',headers,body:raw}));assert.equal(res.status,401);assert.equal(rpcs.length,0);
 headers['x-ccx-signature']=await relaySignature(environment.CCBILL_WEBHOOK_RELAY_SECRET,relayMessage('rental',timestamp,query,type,raw));
 res=await handlers['membership-ccbill-webhook'](new Request('https://fixture.invalid',{method:'POST',headers,body:raw}));assert.equal(res.status,401);
 headers['x-ccx-signature']=await relaySignature(environment.CCBILL_WEBHOOK_RELAY_SECRET,relayMessage('membership',timestamp,query,type,raw));
 res=await handlers['membership-ccbill-webhook'](new Request('https://fixture.invalid',{method:'POST',headers,body:raw.replace('19.99','0.01')}));assert.equal(res.status,401);
 res=await handlers['membership-ccbill-webhook'](new Request('https://fixture.invalid',{method:'POST',headers,body:raw}));assert.equal(res.status,200);
 assert.equal(rpcs[0].name,'ccx_apply_membership_event');assert.equal(rpcs[0].args.p_event.amount_cents,1999);
});
test('all browser handler preflights allow the actual Supabase client version headers',async()=>{
 for(const name of ['yoti-verification','membership-billing']){
  const res=await handlers[name](new Request('https://fixture.invalid',{method:'OPTIONS'}));assert.equal(res.status,204);
  assert.match(res.headers.get('Access-Control-Allow-Headers'),/x-supabase-client-platform-version/);
 }
});
