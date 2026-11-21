/** Exercises the production annual-recap Edge handler using isolated synthetic
 * Supabase auth/database/PDF fixtures; no live accounts, provider keys or writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const user='10000000-0000-4000-8000-000000000001';
const other='20000000-0000-4000-8000-000000000001';
const rid='30000000-0000-4000-8000-000000000001';
let handler,records,logged,failAudit;
function reset(){
 failAudit=false;logged=[];
 records={
  account_security:[{user_id:user,banned:false,suspended:false,admin:false},
   {user_id:other,banned:false,suspended:false,admin:false}],
  member_admissions:[{id:rid,user_id:user,admitted_at:'2026-01-03T00:00:00Z'}],
  member_profiles:[{id:user,role_type:'creator',display_name:'Fixture Professional'},
   {id:other,role_type:'creator',display_name:'Other Professional'}],
  ccx_annual_recaps:[{id:rid,user_id:user,report_year:2026,role_type:'creator',
   metrics:{collaborations:5,new_friends:3,published_posts:4,featured_portfolio_items:2},
   generated_at:'2027-01-01T15:00:00Z',notified_at:'2027-01-01T15:00:00Z',
   feed_post_id:null,feed_hidden_at:null,shared_at:null}],
  ccx_annual_recap_events:[]
 };
}
class Query{
 constructor(table){this.table=table;this.filters=[];this.max=Infinity;this.one=false;this.columnString='*';this.insertValue=null;}
 select(names='*'){this.columnString=names;return this;}
 eq(k,v){this.filters.push(row=>row[k]===v);return this;}
 gte(k,value){this.filters.push(row=>row[k]>=value);return this;}
 not(k,operator,value){if(operator==='is')this.filters.push(row=>row[k]!==value);return this;}
 order(){return this;}
 limit(n){this.max=n;return this;}
 maybeSingle(){this.one=true;return this;}
 insert(value){this.insertValue=value;return this;}
 then(resolve){
  if(this.insertValue){
   if(failAudit)return resolve({error:{message:'Synthetic audit unavailable'},data:null});
   const input={...this.insertValue};logged.push(input);
   (records[this.table]??=[]).push(input);
   return resolve({error:null,data:[input]});
  }
  const rows=(records[this.table]||[]).filter(row=>this.filters.every(f=>f(row))).slice(0,this.max);
  const results=rows.map(row=>this.columnString==='*'?row:
   Object.fromEntries(this.columnString.split(',').map(key=>key.trim()).filter(key=>key in row).map(key=>[key,row[key]])));
  resolve({error:null,data:this.one?results[0]||null:results,count:results.length});
 }
}
globalThis.__annualFixtureClient=(url,key,options={})=>{
 if(key==='fixture-public')return {auth:{getUser:async()=>{
  const bearer=options.global?.headers?.Authorization||'';
  const id=bearer==='Bearer fixture-user'?user:bearer==='Bearer fixture-other'?other:null;
  return {data:{user:id?{id,is_anonymous:false}:null},error:id?null:{message:'Unauthenticated'}};
 }}};
 return {
  from:table=>new Query(table),
  rpc:async(name,args)=>{
   if(!['ccx_annual_recap_feed_share','ccx_annual_recap_feed_hide'].includes(name))
    return {data:null,error:{message:'Unsupported fixture RPC'}};
   const row=records.ccx_annual_recaps.find(x=>x.id===args.p_recap&&x.user_id===args.p_actor);
   if(!row)return {data:null,error:{message:'Invalid recipient'}};
   if(name.endsWith('feed_share')){
    row.feed_post_id??='40000000-0000-4000-8000-000000000001';
    return {data:{id:row.feed_post_id,already_shared:!!row.shared_at},error:null};
   }
   row.feed_hidden_at='2027-01-03T00:00:00Z';
   return {data:{hidden:true,id:row.feed_post_id},error:null};
  }
 };
};
globalThis.Deno={env:{get:name=>({
 SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-public',
 SUPABASE_SERVICE_ROLE_KEY:'fixture-service'
})[name]},serve:fn=>{handler=fn;}};
const compiled=(await build({
 entryPoints:['supabase/functions/annual-recap/index.ts'],bundle:true,write:false,format:'esm',
 platform:'node',logLevel:'silent',plugins:[{name:'annual-fixtures',setup(build){
  build.onResolve({filter:/^npm:@supabase\/supabase-js/},()=>({path:'supabase',namespace:'mock'}));
  build.onResolve({filter:/pdfReport\.mjs$/},()=>({path:'pdf',namespace:'mock'}));
  build.onLoad({filter:/.*/,namespace:'mock'},args=>({
   contents:args.path==='supabase'?'export const createClient=globalThis.__annualFixtureClient;':
    'export const renderRecapPdf=async()=>new Uint8Array(5000).fill(37);',loader:'js'
  }));
 }}]
})).outputFiles[0].text;
const mockedDate='const Date=class extends globalThis.Date {constructor(...args){super(...(args.length?args:["2027-01-02T12:00:00.000Z"]))} static now(){return globalThis.Date.parse("2027-01-02T12:00:00.000Z")} };';
reset();
await import('data:text/javascript;base64,'+Buffer.from(mockedDate+compiled).toString('base64')+'#annual-fixture');

async function request(as,action,extra={}){
 const response=await handler(new Request('https://fixture.invalid',{
  method:'POST',headers:{...(as?{authorization:'Bearer fixture-'+as}:{}),
   'content-type':'application/json'},body:JSON.stringify({action,...extra})
 }));
 const body=response.headers.get('content-type')?.includes('json')?await response.json():
  response.headers.get('content-type')?.includes('pdf')?new Uint8Array(await response.arrayBuffer()):await response.text();
 return {status:response.status,body,headers:response.headers};
}
test('signed-in owner required; future snapshots and unsupported actions refused',async()=>{
 reset();
 assert.equal((await request(null,'list')).status,401);
 assert.equal((await request('user','extra')).status,400);
 assert.equal((await request('user','view',{year:2027})).status,400);
 assert.equal((await request('user','view',{year:2025})).status,400);
});
test('different signed-in member cannot list or guess another report',async()=>{
 reset();records.member_admissions.push({user_id:other,id:other,admitted_at:'2026-07-03'});
 const list=await request('other','list');assert.equal(list.status,200);assert.equal(list.body.items.length,0);
 assert.equal((await request('other','view',{year:2026})).status,404);
});
test('account admission, suspension and supported role are enforced before owner disclosure',async()=>{
 reset();records.account_security[0].suspended=true;
 assert.equal((await request('user','view',{year:2026})).status,403);
 reset();records.member_admissions=[];
 assert.equal((await request('user','view',{year:2026})).status,403);
 reset();records.member_profiles[0].role_type='law_enforcement';
 assert.equal((await request('user','list')).status,403);
});
test('report reflects verified snapshot only and does not add private records',async()=>{
 reset();const value=await request('user','view',{year:2026});assert.equal(value.status,200);
 assert.equal(value.body.report.year,2026);
 assert.equal(value.body.report.role,'creator');
 assert.equal(value.body.report.metrics.collaborations,5);
 assert.ok(value.body.report.share_text.includes('5 collaborations'));
 assert.equal(logged.length,0,'Reading is not an implied feed share');
});
test('PDF generation is owner-scoped, uncached and audit-gated',async()=>{
 reset();const value=await request('user','download_pdf',{year:2026});
 assert.equal(value.status,200);assert.equal(value.body.length,5000);
 assert.match(value.headers.get('content-type'),/application\/pdf/);
 assert.match(value.headers.get('content-disposition'),/attachment/);
 assert.equal(value.headers.get('cache-control'),'no-store');
 assert.equal(logged.filter(x=>x.action==='pdf_exported').length,1);
 reset();failAudit=true;
 assert.notEqual((await request('user','download_pdf',{year:2026})).status,200);
});
test('feed share is explicit, actor-locked and repeated requests cannot produce duplicate posts',async()=>{
 reset();assert.equal(records.ccx_annual_recaps[0].feed_post_id,null);
 const one=await request('user','share_feed',{year:2026,user_id:other,p_actor:other});
 assert.equal(one.status,200);assert.ok(one.body.result.id);
 const again=await request('user','share_feed',{year:2026});
 assert.equal(again.status,200);assert.equal(again.body.result.id,one.body.result.id);
 const hidden=await request('user','hide_feed',{year:2026});
 assert.equal(hidden.status,200);assert.equal(hidden.body.result.hidden,true);
});
