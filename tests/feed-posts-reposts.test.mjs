/** Verified source and runtime contracts for separate posts/reposts streams. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createConnectFeedHandler} from '../supabase/functions/connect-feed/handler.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const viewer='10000000-0000-4000-8000-000000000001';
const creator='20000000-0000-4000-8000-000000000002';
const postId='30000000-0000-4000-8000-000000000003';
const make=body=>new Request('https://fixture.invalid/functions/v1/connect-feed',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
});
function handler(){
 const calls=[];
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='ccx_feed_page')return {data:{items:[]},error:null};
  if(name==='ccx_feed_can_view')return {data:true,error:null};
  if(name==='ccx_feed_create_trusted')return {data:{id:postId,status:'published'},error:null};
  return {data:{},error:null};
 }};
 return {calls,handle:createConnectFeedHandler({authenticate:async()=>({id:viewer}),db,storage:{from:()=>({
  createSignedUrl:async()=>({data:{signedUrl:'https://fixture.invalid/signed'},error:null})})}})};
}
test('normal dashboard requests continue to use the trusted discovery filter',async()=>{
 const h=handler();
 const response=await h.handle(make({action:'feed',mode:'discover',author_id:creator}));
 assert.equal(response.status,200);
 const args=h.calls.find(item=>item.name==='ccx_feed_page').args;
 assert.equal(args.p_actor,viewer);
 assert.equal(args.p_mode,'discover');
 assert.equal(args.p_author,null);
});
test('reposts on dashboard belong to authenticated user, not submitted author ID',async()=>{
 const h=handler();
 const response=await h.handle(make({action:'feed',mode:'my_reposts',author_id:creator,p_actor:creator}));
 assert.equal(response.status,200);
 const args=h.calls.find(item=>item.name==='ccx_feed_page').args;
 assert.equal(args.p_actor,viewer);
 assert.equal(args.p_mode,'my_reposts');
 assert.equal(args.p_author,null);
});
test('other members can browse both permission-scoped profile tabs',async()=>{
 for(const mode of ['profile_posts','profile_reposts']){
  const h=handler(),response=await h.handle(make({action:'feed',mode,author_id:creator}));
  assert.equal(response.status,200);
  assert.deepEqual(h.calls[0],{name:'ccx_feed_page',args:{
   p_actor:viewer,p_mode:mode,p_author:creator,p_before:null,p_before_id:null,p_limit:16
  }});
 }
});
test('invalid profile IDs and unknown modes never reach arbitrary member data',async()=>{
 for(const mode of ['profile_posts','profile_reposts']){
  const h=handler();
  assert.equal((await h.handle(make({action:'feed',mode,author_id:'invalid'}))).status,400);
  assert.equal(h.calls.length,0);
 }
 const h=handler(),res=await h.handle(make({action:'feed',mode:'list_everything',author_id:creator}));
 assert.equal(res.status,200);
 assert.equal(h.calls[0].args.p_mode,'friends');
});
test('reposting continues through server side paid/visibility and moderation workflow',async()=>{
 const h=handler();
 const response=await h.handle(make({action:'repost',post_id:postId,text:'Reposted this update.',audience:'verified',paid:true}));
 assert.equal(response.status,201);
 assert.equal(h.calls[0].name,'ccx_feed_create_trusted');
 assert.equal(h.calls[0].args.p_actor,viewer);
 assert.equal(h.calls[0].args.p_repost,postId);
 assert.equal(h.calls[0].args.p_body,'Reposted this update.');
});
test('feed UI uses original and repost tabs, clear attribution, no post share control',()=>{
 const ui=read('src/supabase/ConnectFeed.jsx');
 const backend=read('supabase/functions/connect-feed/handler.mjs');
 assert.match(ui,/data-feed-activity-tabs="true"/);
 assert.match(ui,/Dashboard feed activity/);
 assert.match(ui,/Profile activity/);
 assert.match(ui,/profile_reposts/);
 assert.match(ui,/profile_posts/);
 assert.match(ui,/my_reposts/);
 assert.match(ui,/data-repost-attribution="true"/);
 assert.match(ui,/Repeat2 size=\{17\}/);
 assert.match(ui,/onClick=\{\(\)=>void mutate\('repost'/);
 assert.match(ui,/local\.original\.author_name/);
 assert.match(ui,/repostNote/);
 assert.doesNotMatch(ui,/<Share2|>Share<\/button>|const share=|onClick=\{share\}|setReposting/);
 assert.doesNotMatch(ui,/Sharing this professional update\.', 'Legacy caption must remain only in suppressed-text compatibility logic');
 assert.match(backend,/profile_reposts/);
 assert.match(backend,/my_reposts/);
});
test('profile viewers receive tabs without changing role permissions',()=>{
 const discovery=read('src/supabase/CreatorDiscovery.jsx');
 const owner=read('src/supabase/MemberPublicProfile.jsx');
 assert.match(discovery,/profileId=\{selected\.id\} userId=\{user\.id\} paid=\{paid\}/);
 assert.match(owner,/profileId=\{profile\.id\}/);
 assert.match(owner,/Profile posts and reposts/);
});
test('database applies filters before pagination, preserving access and block policies',()=>{
 const sql=read('supabase/migrations/20261121134639_separate_member_feed_and_reposts.sql');
 assert.match(sql,/p_mode in \('profile_reposts','my_reposts'\) and p\.repost_of is not null/);
 assert.match(sql,/p_mode<>'my_reposts' or p\.author_id=p_actor/);
 assert.match(sql,/p_mode not in \('profile','profile_posts','profile_reposts'\)/);
 assert.match(sql,/public\.ccx_feed_can_view\(p_actor,p\.id\)/);
 assert.match(sql,/where p\.status='published' and p\.hidden_at is null/);
 assert.match(sql,/limit p_limit/);
 assert.doesNotMatch(sql,/drop table|truncate table|delete from public\.community_posts/i);
});
