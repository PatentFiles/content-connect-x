import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createConnectFeedHandler} from '../supabase/functions/connect-feed/handler.mjs';

const postId='20000000-0000-4000-8000-000000000002';
const actor='10000000-0000-4000-8000-000000000001';
const makeRequest=(body)=>new Request('https://site.test/functions/v1/connect-feed',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
});
function harness(items){
 const calls=[];
 return {calls,handler:createConnectFeedHandler({
  authenticate:async()=>({id:actor}),
  db:{rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='ccx_feed_page')return {data:{items},error:null};
   throw Error('Unapproved database call');
  }},
  storage:{from(){return {createSignedUrl:async()=>({data:{signedUrl:'https://example.test/signed'},error:null})};}}
 })};
}
test('a shared link can only resolve its exact requested post, not global feed results',async()=>{
 const h=harness([{id:postId,author_id:actor,body:'Verified permitted post',audience:'friends',likes:0,
   media:[],published_at:'2026-11-19T18:00:00Z'}]);
 const r=await h.handler(makeRequest({action:'post',post_id:postId}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).post.id,postId);
 const call=h.calls[0];
 assert.deepEqual(call,{name:'ccx_feed_page',args:{p_actor:actor,p_mode:'single',p_author:postId,
  p_before:null,p_before_id:null,p_limit:1}});
});
test('unviewable or deleted post returns an opaque not-found response',async()=>{
 const h=harness([]);
 const r=await h.handler(makeRequest({action:'post',post_id:postId}));
 assert.equal(r.status,404);
 assert.match((await r.json()).error,/not available/);
});
test('a malformed shared link never calls the database',async()=>{
 const h=harness([]);
 const r=await h.handler(makeRequest({action:'post',post_id:'../../../private'}));
 assert.equal(r.status,400);
 assert.equal(h.calls.length,0);
});
test('Dashboard share target and public profile timelines are wired to the server-owned post gateway',()=>{
 const feed=fs.readFileSync('src/supabase/ConnectFeed.jsx','utf8');
 const app=fs.readFileSync('src/supabase/SupabaseApp.jsx','utf8');
 const discovery=fs.readFileSync('src/supabase/CreatorDiscovery.jsx','utf8');
 assert.match(feed,/new URL\('\/Dashboard',window.location.origin\)/);
 assert.match(feed,/action\('post',\{post_id:value\}\)/);
 assert.match(feed,/Checking your permission to view this post/);
 assert.match(feed,/URLSearchParams\(window.location.search\)/);
 assert.match(app,/Your profile posts/);
 assert.match(app,/profileId=\{user.id\}/);
 assert.match(discovery,/Profile posts/);
 assert.match(discovery,/profileId=\{selected.id\}/);
});
test('SQL single-post mode respects existing membership predicate and does not broaden audiences',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261120003000_connect_feed_post_permalink.sql','utf8');
 assert.match(sql,/p_mode='single' and p.id=p_author/);
 assert.match(sql,/ccx_feed_can_view\(p_actor,p.id\)/);
 assert.match(sql,/p_mode='single' and p_author is null/);
 assert.doesNotMatch(sql,/grant execute[^;]*authenticated/i);
});
