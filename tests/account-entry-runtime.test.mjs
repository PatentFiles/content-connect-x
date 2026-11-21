/** Executable Edge tests against in-memory fixtures, never live users or credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {hasAdmission,needsOptedInMfa} from '../src/supabase/accountEntryPolicy.mjs';
const uid='00000000-0000-4000-8000-000000000001';
let state,authenticated=true,dbError=null,currentHandler;
function reset({admitted=true,admin=true}={}){
 authenticated=true;dbError=null;
 state={account_security:[{user_id:uid,admin,banned:false,suspended:false}],
  member_admissions:admitted?[{id:'entry',user_id:uid,admitted_at:'2026-11-17',source:admin?'legacy_admin':'age_verification'}]:[],
  age_verification_requests:[],member_subscriptions:[],member_connection_requests:[],
  platform_settings:[{key:'age_verification_required',value:false}],
  product_feature_flags:['connections','messages','testing'].map(key=>({key,enabled:true,allowed_tiers:['free','premium'],rollout_percent:100})),
  content_moderation_queue:[],ccx_integrations:[]};
}
class Query{
 constructor(name){this.name=name;this.filters=[];this.one=false;this.max=Infinity;this.insertion=null;}
 select(){return this;}eq(k,v){this.filters.push(row=>row[k]===v);return this;}
 in(k,v){this.filters.push(row=>v.includes(row[k]));return this;}neq(k,v){this.filters.push(row=>row[k]!==v);return this;}
 or(){return this;}order(){return this;}limit(n){this.max=n;return this;}
 maybeSingle(){this.one=true;return this;}single(){this.one=true;return this;}
 insert(row){this.insertion=row;return this;}update(){return this;}upsert(){return this;}
 then(resolve){
  if(dbError===this.name){resolve({data:null,error:{message:'fixture read error'}});return;}
  if(this.insertion)(state[this.name]??=[]).push(this.insertion);
  const rows=(state[this.name]||[]).filter(row=>this.filters.every(f=>f(row))).slice(0,this.max);
  resolve({data:this.one?(rows[0]||null):rows,error:null,count:rows.length});
 }
}
globalThis.__entryClient=(_url,key)=>key==='public-fixture'?{auth:{
 getUser:async()=>({data:{user:authenticated?{id:uid,user_metadata:{admin:true,age_verified:true,onboarding_complete:true}}:null},error:null}),
 mfa:{getAuthenticatorAssuranceLevel:()=>{throw Error('Feature API must not demand optional MFA');}}
}}:{from:name=>new Query(name),rpc:async()=>({data:null,error:null})};
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture'})[key]},serve:handler=>{currentHandler=handler;}};
const handlers={};
for(const name of ['member-workflows','platform-extras','admin-age-review','ccx-integrations']){
 let js=buildSync({entryPoints:['supabase/functions/'+name+'/index.ts'],bundle:true,write:false,format:'esm',platform:'neutral',external:['npm:*','jsr:*'],logLevel:'silent'}).outputFiles[0].text;
 js=js.replace(/import\s*\{\s*createClient\s*\}\s*from\s*["']npm:@supabase\/supabase-js[^"']*["'];/,'const createClient=globalThis.__entryClient;');
 assert.doesNotMatch(js,/from ["']npm:/,'All runtime imports for this fixture must be explicitly mocked');
 await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')+'#'+name);
 handlers[name]=currentHandler;
}
async function call(name,action,extra={}){
 const response=await handlers[name](new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer ordinary-aal1-session','content-type':'application/json'},body:JSON.stringify({action,...extra})}));
 return {status:response.status,body:await response.json()};
}
test('existing admitted admin accesses Friends with password sign-in and no age record',async()=>{
 reset();const r=await call('member-workflows','list_connection_requests');assert.equal(r.status,200);assert.deepEqual(r.body.items,[]);assert.equal(state.age_verification_requests.length,0);
});
test('completed signup does not require a current verification row or MFA for Friends',async()=>{
 reset({admin:false});assert.equal((await call('member-workflows','list_connection_requests')).status,200);
});
test('pending signup cannot use direct APIs even with forged metadata and global gate disabled',async()=>{
 reset({admitted:false});const r=await call('member-workflows','list_connection_requests');assert.equal(r.status,403);assert.match(r.body.error,/onboarding/);
});
test('failed admission lookups fail closed rather than granting access',async()=>{
 reset();dbError='member_admissions';assert.equal((await call('member-workflows','list_connection_requests')).status,503);
});
test('anonymous, suspended and disabled-feature checks remain enforced',async()=>{
 reset();authenticated=false;assert.equal((await call('member-workflows','list_connection_requests')).status,401);
 reset();state.account_security[0].suspended=true;assert.equal((await call('member-workflows','list_connection_requests')).status,403);
 reset();state.product_feature_flags.find(f=>f.key==='connections').enabled=false;assert.equal((await call('member-workflows','list_connection_requests')).status,403);
});
test('admin settings and independent review require admin role but no mandatory MFA',async()=>{
 reset();assert.equal((await call('platform-extras','admin_list_feature_flags')).status,200);
 assert.equal((await call('admin-age-review','list')).status,200);
 assert.equal((await call('ccx-integrations','admin_list')).status,200);
 reset({admin:false});assert.equal((await call('platform-extras','admin_list_feature_flags')).status,403);
 assert.equal((await call('admin-age-review','list')).status,403);
 assert.equal((await call('ccx-integrations','admin_list')).status,403);
});
test('no admin can self-approve evidence to satisfy signup',async()=>{
 reset();state.age_verification_requests=[{id:'request',user_id:uid,status:'pending'}];
 const r=await call('admin-age-review','approve',{request_id:'request',age_confirmed:true});assert.equal(r.status,403);assert.match(r.body.error,/own age verification/);
});
test('disabling global flag cannot switch off required signup admission',async()=>{
 reset();const r=await call('platform-extras','admin_set_setting',{key:'age_verification_required',value:false});assert.equal(r.status,409);assert.match(r.body.error,/signup/);
});
test('browser policy only uses trusted admission shape and voluntarily enrolled MFA',()=>{
 assert.equal(hasAdmission(null),false);assert.equal(hasAdmission({admin:true,age_verified:true}),false);
 assert.equal(hasAdmission({admitted_at:'2026-11-17',source:'legacy_admin'}),true);
 assert.equal(needsOptedInMfa({currentLevel:'aal1',nextLevel:'aal1'}),false);
 assert.equal(needsOptedInMfa({currentLevel:'aal1',nextLevel:'aal2'}),true);
 assert.equal(needsOptedInMfa({currentLevel:'aal2',nextLevel:'aal2'}),false);
});
test('active server entrypoints do not parse MFA levels or use browser metadata to admit users',()=>{
 for(const folder of readdirSync('supabase/functions')){
  const path='supabase/functions/'+folder+'/index.ts';if(!existsSync(path))continue;
  const source=readFileSync(path,'utf8');assert.doesNotMatch(source,/aal2|assurance\(|assured\(|keyAAL\(|hashClaim\(/,folder);
 }
 const app=readFileSync('src/supabase/SupabaseApp.jsx','utf8');assert.match(app,/if\(user&&!approved\)return <AgeGateOnboarding/);assert.match(app,/from\('member_admissions'\)/);
 assert.doesNotMatch(app,/const approved\s*=\s*.*(?:isAdmin|ageGateEnabled)/);
 const header=readFileSync('src/supabase/OriginalShell.jsx','utf8');assert.match(header,/isAdmin&&<a href="https:\/\/hostconnectx\.com"/);
 assert.ok(header.indexOf('ccx-admin-host-link')<header.indexOf("onNavigate('membership')"));
});
