import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createConnectFeedHandler} from '../supabase/functions/connect-feed/handler.mjs';
const userId='10000000-0000-4000-8000-000000000001';
const postId='20000000-0000-4000-8000-000000000002';
const photoId='30000000-0000-4000-8000-000000000003';
const request=(body,method='POST')=>new Request('https://example.test/functions/v1/connect-feed',{
 method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})
});
function harness({user={id:userId},canRead=true,throwing=null,items=[]}={}){
 const calls=[],links=[];
 const db={
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(throwing)return {data:null,error:{message:throwing}};
   if(name==='ccx_feed_can_view')return {data:canRead,error:null};
   if(name==='ccx_feed_page')return {data:{items},error:null};
   if(name==='ccx_feed_create')return {data:{id:postId,status:'pending'},error:null};
   if(name==='ccx_feed_interact')return {data:{liked:true,saved:true,status:'pending'},error:null};
   if(name==='ccx_feed_report')return {data:{received:true,reference:postId},error:null};
   if(name==='ccx_feed_hide')return {data:true,error:null};
   throw Error('Unexpected RPC '+name);
  },
  from(name){
   const state={name,filters:[]};
   const query={select(){return query;},eq(k,v){state.filters.push([k,v]);return query;},
    in(k,v){state.filters.push([k,v]);return query;},or(){return query;},
    order(){return query;},limit(){return query;},
    then(resolve){calls.push({query:state});return Promise.resolve({data:[],error:null}).then(resolve);}};
   return query;
  }
 };
 const storage={from(name){assert.equal(name,'member-private');return {
  createSignedUrl:async(path,seconds)=>{
   links.push({path,seconds});
   return {data:{signedUrl:'https://example.supabase.co/storage/v1/object/sign/member-private/'+path},error:null};
  }
 };}};
 return {calls,links,handler:createConnectFeedHandler({authenticate:async()=>user,db,storage})};
}
test('anonymous access never reaches the database',async()=>{
 const h=harness({user:null});const r=await h.handler(request({action:'feed',mode:'friends'}));
 assert.equal(r.status,401);assert.equal(h.calls.length,0);
});
test('only validated actor ID enters the feed, never the user-editable payload',async()=>{
 const h=harness();const r=await h.handler(request({action:'feed',mode:'friends',actor_id:'attacker',limit:100000}));
 assert.equal(r.status,200);
 assert.deepEqual(h.calls[0],{name:'ccx_feed_page',args:{p_actor:userId,p_mode:'friends',p_author:null,p_before:null,p_before_id:null,p_limit:16}});
});
test('no unapproved or arbitrary posts can be liked',async()=>{
 const h=harness({canRead:false});
 const r=await h.handler(request({action:'like',post_id:postId}));
 assert.equal(r.status,404);
 assert.equal(h.calls.filter(x=>x.name==='ccx_feed_interact').length,0);
});
test('only approved, private signed photos are delivered with an explicit allowlist',async()=>{
 const h=harness({items:[{id:postId,author_id:userId,body:'Safe professional update',audience:'friends',likes:2,
  media:[{id:photoId,path:userId+'/media/photo.jpg',mime_type:'image/jpeg',caption:'Professional image'}],
  sensitive_value:'DO-NOT-RETURN',display_name:'Member',published_at:'2026-11-19T18:00:00Z'}]});
 const r=await h.handler(request({action:'feed',mode:'friends'}));
 assert.equal(r.status,200);
 const text=await r.text();
 assert.doesNotMatch(text,/DO-NOT-RETURN|storage_path|"path"|sensitive_value/);
 assert.match(text,/sign\/member-private/);
 assert.equal(h.links[0].seconds,180);
 assert.equal(h.links.length,1);
});
test('Free interactions are not locally gated and comments require a view authorization check',async()=>{
 const h=harness();
 const r=await h.handler(request({action:'comment',post_id:postId,text:'Looks great'}));
 assert.equal(r.status,201);
 assert.equal(h.calls.find(x=>x.name==='ccx_feed_interact')?.args.p_action,'comment');
 assert.equal(h.calls.find(x=>x.name==='ccx_feed_interact')?.args.p_actor,userId);
});
test('Premium publication check happens in SQL and cannot be forged by a browser',async()=>{
 const h=harness({throwing:'FEED_PREMIUM_REQUIRED'});
 const r=await h.handler(request({action:'create',text:'A professional post',audience:'verified',paid:true,admin:true,media_ids:[]}));
 assert.equal(r.status,403);
 assert.match((await r.json()).error,/Premium/i);
});
test('group or unauthorized action injection fails input validation',async()=>{
 const h=harness();
 for(const data of [{action:'update_post',post_id:postId},{action:'create',text:'Some post',media_ids:['bad']},
 {action:'report',post_id:postId,reason:'unknown'},{action:'repost',post_id:'invalid',text:'Sharing this professional post'}]){
  const r=await h.handler(request(data));assert.equal(r.status,400);
 }
 assert.equal(h.calls.filter(x=>x.name==='ccx_feed_create').length,0);
});
test('report acknowledges receipt but not action or emergency response',async()=>{
 const h=harness();const r=await h.handler(request({action:'report',post_id:postId,reason:'privacy'}));
 assert.equal(r.status,200);
 assert.match((await r.json()).note,/not confirm a removal or emergency response/i);
});
test('Dashboard keeps widget strip and social timeline separate from sponsored sidebar',()=>{
 const src=fs.readFileSync('src/supabase/CustomDashboard.jsx','utf8');
 const feed=fs.readFileSync('src/supabase/ConnectFeed.jsx','utf8');
 assert.match(src,/ccx-widget-rail/);
 assert.match(src,/shown\.slice\(0,4\)|suggested\.slice\(0,4\)/);
 assert.match(src,/SponsorshipSlot placement="sidebar"/);
 assert.match(src,/hidden min-w-0 space-y-4 xl:block/);
 assert.match(src,/initialMode="discover"/);
 assert.match(src,/ConnectFeed userId/);
 assert.match(feed,/Upload a new photo for moderation/);
 assert.match(feed,/Friends.*Following.*Discover/s);
});
test('Existing community API is restricted to verified posts and validates interactions',()=>{
 const legacy=fs.readFileSync('supabase/functions/platform-extras/index.ts','utf8');
 assert.match(legacy,/eq\('audience','verified'\)/);
 assert.match(legacy,/ccx_feed_can_view/);
});
