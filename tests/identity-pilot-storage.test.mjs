import assert from 'node:assert/strict';
import test from 'node:test';
import {createPilotHandler} from '../supabase/functions/identity-pilot/handler.mjs';

// All bytes are a one-pixel synthetic PNG, never a real ID or facial image.
function fixture(options={}){
 let bytes,path,removed=false,probeRecorded=false,listCalls=0,ledgerDeleted=false;
 const storage={
  async upload(p,b){path=p;bytes=b;return {data:{path:p},error:null};},
  async download(){return {data:new Blob([bytes]),error:null};},
  async list(){listCalls++;if(options.listError)return {data:null,error:{message:'synthetic listing failure'}};return {data:removed&&!options.keepVisible?[]:[{name:path.split('/').at(-1)}],error:null};},
  async remove(){if(options.deleteError)return {data:null,error:{message:'synthetic deletion failure'}};removed=true;return {data:[],error:null};}
 };
 const admin={
  rpc:async()=>({data:true,error:null}),
  from(table){const q={operation:null,insert(){this.operation='insert';return this;},delete(){this.operation='delete';return this;},update(){this.operation='update';return this;},eq(){return this;},then(resolve,reject){if(table==='ccx_idv_pilot_config'&&this.operation==='update')probeRecorded=true;if(table==='ccx_idv_pilot_uploads'&&this.operation==='delete')ledgerDeleted=true;return Promise.resolve({data:null,error:null}).then(resolve,reject);}};return q;},
  storage:{from:()=>storage}
 };
 const handler=createPilotHandler({admin,authenticate:async()=>null,projectOrigin:'https://fixture.supabase.co',fetchImpl:async()=>new Response('{}',{status:options.publicStatus||400})});
 return {handler,state:()=>({removed,probeRecorded,listCalls,ledgerDeleted})};
}
const request=()=>new Request('https://fixture.invalid/identity-pilot',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+'a'.repeat(64)},body:JSON.stringify({action:'maintenance_probe'})});

test('private probe proves storage round trip and before/after deletion with no admission',async()=>{
 const f=fixture(),r=await f.handler(request()),body=await r.json();
 assert.equal(r.status,200);assert.equal(body.private_read,true);assert.equal(body.public_read_denied,true);assert.equal(body.deletion_verified,true);assert.equal(body.test_only,true);assert.equal(body.admission_granted,false);
 assert.deepEqual(f.state(),{removed:true,probeRecorded:true,listCalls:2,ledgerDeleted:true});
});
for(const [name,options] of [['list error',{listError:true}],['delete error',{deleteError:true}],['object survives delete',{keepVisible:true}],['publicly readable object',{publicStatus:200}],['public endpoint network failure',{publicStatus:503}]]){
 test('private probe cannot certify success after '+name,async()=>{
  const f=fixture(options),r=await f.handler(request());assert.equal(r.status,500);assert.equal(f.state().probeRecorded,false);assert.equal(f.state().ledgerDeleted,false);
 });
}
test('unauthenticated probe cannot create an upload',async()=>{
 const f=fixture(),r=await f.handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({action:'maintenance_probe'})}));assert.equal(r.status,401);assert.equal(f.state().listCalls,0);assert.equal(f.state().probeRecorded,false);
});
