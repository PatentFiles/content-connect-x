/** Enterprise regression: private profile avatars and clean social cards.
 * Every role dashboard reuses the same post renderer; source fields are never
 * disclosed as storage paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createConnectFeedHandler} from '../supabase/functions/connect-feed/handler.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const author='10000000-0000-4000-8000-000000000001';
const originalAuthor='20000000-0000-4000-8000-000000000002';
const viewer='30000000-0000-4000-8000-000000000003';
const post='40000000-0000-4000-8000-000000000004';
const request=()=>new Request('https://fixture.invalid/functions/v1/connect-feed',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'feed',mode:'discover'})
});
function service(items,signFailure=false){
 const signed=[],calls=[];
 const handler=createConnectFeedHandler({
  authenticate:async()=>({id:viewer}),
  db:{rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='ccx_feed_page')return {data:{items},error:null};
   return {data:null,error:{message:'Unexpected fixture operation'}};
  }},
  storage:{from:bucket=>{
   assert.equal(bucket,'member-private','Profiles must not be served from a public bucket');
   return {createSignedUrl:async(path,ttl)=>{
    signed.push({path,ttl});
    if(signFailure)throw Error('Synthetic image service unavailable');
    return {data:{signedUrl:'https://fixture.invalid/signed/'+path},error:null};
   }};
  }}
 });
 return {handler,signed,calls};
}
test('allowed authors receive short-lived signed avatars, including original repost author',async()=>{
 const paths=[author+'/profile/avatar-main.webp',originalAuthor+'/profile/avatar-original.png'];
 const r=service([{id:post,author_id:author,author_avatar_path:paths[0],display_name:'Photographer',
  role_type:'photographer',body:'Professional photos',repost_of:'50000000-0000-4000-8000-000000000005',
  media:[],original:{id:'50000000-0000-4000-8000-000000000005',author_id:originalAuthor,
   author_avatar_path:paths[1],author_name:'Original creator',body:'A professional post',media:[]}}]);
 const response=await r.handler(request());
 assert.equal(response.status,200);
 const body=await response.json();
 const entry=body.items[0];
 assert.equal(entry.author.avatar_url,'https://fixture.invalid/signed/'+paths[0]);
 assert.equal(entry.original.author_avatar_url,'https://fixture.invalid/signed/'+paths[1]);
 assert.deepEqual(r.signed,[{path:paths[0],ttl:600},{path:paths[1],ttl:600}]);
 assert.equal(entry.author_avatar_path,undefined);
 assert.equal(entry.original.author_avatar_path,undefined);
 assert.doesNotMatch(JSON.stringify(body),/"avatar_path"|medical\/|identity\/|real_name/i);
});
test('foreign, traversal, wrong-format and medical avatar paths cannot be signed',async()=>{
 const paths=[
  originalAuthor+'/profile/avatar-other.jpg',
  author+'/profile/avatar-../../medical.jpg',
  author+'/medical/avatar-test.jpg',
  author+'/profile/avatar-test.pdf',
  author+'/profile/avatar-extra/nested.jpg'
 ];
 for(const avatar_path of paths){
  const r=service([{id:post,author_id:author,author_avatar_path:avatar_path,body:'Safe message',media:[]}]);
  const response=await r.handler(request());assert.equal(response.status,200);
  assert.equal((await response.json()).items[0].author.avatar_url,null);
  assert.equal(r.signed.length,0,'Forbidden avatar path was signed: '+avatar_path);
 }
});
test('avatar signing outage never erases the post or blocks comments and reactions',async()=>{
 const r=service([{id:post,author_id:author,author_avatar_path:author+'/profile/avatar-1.png',
  body:'Safe professional update',media:[],likes:5}],true);
 const response=await r.handler(request());
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.items[0].author.avatar_url,null);
 assert.equal(data.items[0].body,'Safe professional update');
 assert.equal(data.items[0].likes,5);
});
test('shared post UI uses visible avatars, compact top-right times, no audience/debug copy',()=>{
 const feed=read('src/supabase/ConnectFeed.jsx');
 const dashboard=read('src/supabase/CustomDashboard.jsx');
 const entry=read('src/supabase/OriginalRoleDashboard.jsx');
 const policy=read('src/supabase/roleNavigationData.mjs');
 assert.match(feed,/data-feed-post-header="true"/);
 assert.match(feed,/data-feed-post-time="true"/);
 assert.match(feed,/Intl\.DateTimeFormat/);
 assert.match(feed,/minute:'2-digit'/);
 assert.match(feed,/FeedAvatar url=\{local\.author\?\.avatar_url\}/);
 assert.match(feed,/FeedAvatar url=\{local\.original\.author_avatar_url\}/);
 assert.match(feed,/rounded-full/);
 assert.match(feed,/data-feed-photo-gallery="true"/);
 assert.match(feed,/object-contain/);
 assert.match(feed,/max-h-\[min\(80vh,740px\)\]/);
 assert.match(feed,/data-original-repost-media="true"/);
 assert.match(feed,/data-feed-post-actions="true"/);
 for(const action of ['Like','Comments','Repost','Save','Report'])assert.ok(feed.includes(action),action);
 assert.doesNotMatch(feed,/>Share<\/button>|<Share2|Entire community ·|Unknown or restricted values/);
 assert.doesNotMatch(dashboard,/Unknown or restricted values are never shown as zero|Updated \{new Date\(data\.checked_at\)/);
 assert.match(dashboard,/<ConnectFeed userId=\{userId\} paid=\{paid\}/);
 assert.match(entry,/<CustomDashboard profile=\{profile\}/);
 for(const role of ['creator','agent','studio','photographer','videographer','video_editor'])
  assert.ok(policy.includes(role),'Role navigation missing '+role);
});
