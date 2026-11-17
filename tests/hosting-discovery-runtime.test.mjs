/** Local in-memory authorization tests. Never contacts or modifies Supabase. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const uid='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
const mine='00000000-0000-4000-8000-000000000011',other='00000000-0000-4000-8000-000000000012';
const terms=user_id=>({user_id,status:'active',terms_version:'host-2026-11-17',legal_capacity_confirmed:true,property_authority_confirmed:true,adult_production_understood:true});
function fixture(){return {account_security:[{user_id:uid,banned:false,suspended:false},{user_id:peer,banned:false,suspended:false}],age_verification_requests:[],onlyhost_accounts:[terms(uid),terms(peer)],product_feature_flags:[{key:'hosting_marketplace',enabled:true,allowed_tiers:['free','premium'],rollout_percent:100}],member_subscriptions:[],member_blocks:[],properties:[{id:mine,owner_id:uid,title:'Owner draft',status:'draft',city:'Phoenix',public_area_id:'area1'},{id:other,owner_id:peer,title:'Approved peer',status:'active',approved_at:'2026-01-01',city:'Phoenix',public_area_id:'area1'}],host_verification_requests:[{property_id:other,owner_id:peer,status:'approved',expires_at:null}],hosting_public_areas:[{id:'area1',approved:true,city:'Phoenix',longitude:-112,latitude:33}],property_images:Array.from({length:25},(_,i)=>({id:`photo${i}`,property_id:mine,uploader_id:uid,storage_path:uid+'/'+mine+'/'+i+'.jpg',position:i,status:'pending',created_at:'2026-01-01'})).concat([{id:'peer-approved',property_id:other,uploader_id:peer,storage_path:'approved.jpg',position:0,status:'approved'},{id:'peer-private',property_id:other,uploader_id:peer,storage_path:'private.jpg',position:1,status:'pending'}])};}
let dbState,signed,authenticated=true,handler;
class Query{
 constructor(name){this.name=name;this.filters=[];this.orders=[];this.low=0;this.high=Infinity;this.one=false;this.newRow=null;this.change=null;}
 select(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}
 in(k,vs){this.filters.push(r=>vs.includes(r[k]));return this;}
 not(k,_op,v){this.filters.push(r=>r[k]!==v&&r[k]!==undefined);return this;}
 ilike(k,v){this.filters.push(r=>String(r[k]).toLowerCase().includes(v.replaceAll('%','').toLowerCase()));return this;}
 or(){return this;}order(k,opts={}){this.orders.push([k,opts.ascending!==false]);return this;}
 limit(n){this.high=n-1;return this;}range(a,b){this.low=a;this.high=b;return this;}
 maybeSingle(){this.one=true;return this;}single(){this.one=true;return this;}
 insert(v){this.newRow=v;return this;}update(v){this.change=v;return this;}
 then(resolve,reject){try{
  if(this.newRow)dbState[this.name].push({...this.newRow,id:'new-photo'});
  let rows=(dbState[this.name]||[]).filter(r=>this.filters.every(f=>f(r)));
  if(this.newRow)rows=rows.filter(r=>r.id==='new-photo');
  if(this.change)rows.forEach(r=>Object.assign(r,this.change));
  for(const [key,asc] of [...this.orders].reverse())rows.sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(asc?1:-1));
  const count=rows.length;rows=rows.slice(this.low,this.high===Infinity?undefined:this.high+1);
  resolve({data:this.one?(rows[0]||null):rows,count,error:null});
 }catch(e){reject(e);}}
}
globalThis.__discoveryTestClient=(_url,key)=>key==='public'?{auth:{getUser:async()=>({data:{user:authenticated?{id:uid}:null},error:null})}}:{from:name=>new Query(name),storage:{from:()=>({info:async()=>({data:{metadata:{mimetype:'image/jpeg',size:1000}},error:null}),createSignedUrl:async path=>{signed.push(path);return {data:{signedUrl:'https://test.invalid/'+path},error:null};}})}};
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private-fixture'})[key]},serve:fn=>{handler=fn;}};
const source=readFileSync('supabase/functions/hosting-discovery/index.ts','utf8').replace(/import \{createClient\} from '[^']+';/,'const createClient=globalThis.__discoveryTestClient;');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
async function call(body){const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}
function reset(){dbState=fixture();signed=[];authenticated=true;}
test('anonymous and suspended identities cannot access owner/media API',async()=>{reset();authenticated=false;assert.equal((await call({action:'host_market_overview'})).status,401);authenticated=true;dbState.account_security[0].suspended=true;assert.equal((await call({action:'host_market_overview'})).status,403);});
test('unverified host cannot read another owner pending media',async()=>{reset();assert.equal((await call({action:'host_media_page',id:other})).status,404);const x=await call({action:'listing_thumbnails',ids:[other]});assert.equal(x.status,200);assert.equal(x.body.items[0].photos.length,1);assert.deepEqual(signed,['approved.jpg']);});
test('owners can paginate their pending galleries past twenty photos',async()=>{reset();const x=await call({action:'host_media_page',id:mine,offset:20,limit:10});assert.equal(x.status,200);assert.equal(x.body.items.length,5);assert.equal(x.body.total,25);assert.equal(x.body.next_offset,null);});
test('photo number 26 is accepted but another owner path is denied',async()=>{reset();const x=await call({action:'host_photos_register',id:mine,path:uid+'/'+mine+'/new.jpg',caption:'More photos'});assert.equal(x.status,201);assert.equal(dbState.property_images.filter(v=>v.property_id===mine).length,26);assert.equal((await call({action:'host_photos_register',id:mine,path:peer+'/'+mine+'/wrong.jpg'})).status,403);});
test('expired property authority removes peer listings and thumbnail access',async()=>{reset();dbState.host_verification_requests[0].expires_at='2000-01-01';const x=await call({action:'listing_thumbnails',ids:[other]});assert.deepEqual(x.body.items,[]);assert.deepEqual(signed,[]);});
test('creator gallery requires independent verification even for a registered host',async()=>{reset();assert.equal((await call({action:'property_media_page',id:other})).status,403);dbState.age_verification_requests.push({user_id:uid,status:'approved',expires_at:null});const x=await call({action:'property_media_page',id:other});assert.equal(x.status,200);assert.equal(x.body.total,1);});
test('host map filters city/bounds without returning private fields',async()=>{reset();const x=await call({action:'host_market_overview',city:'Phoenix',bounds:{west:-113,east:-111,south:32,north:34}});assert.equal(x.status,200);assert.equal(x.body.items.length,1);assert.equal(x.body.owned_items.length,1);assert.equal(x.body.items[0].owner_id,undefined);assert.equal(x.body.items[0].exact_address,undefined);});
