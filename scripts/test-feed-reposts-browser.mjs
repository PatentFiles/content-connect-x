/** Real React / Chromium feed interactions with synthetic Supabase responses.
 * No production account, provider network, media upload or database mutation.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';
const chrome=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(fs.existsSync);
assert.ok(chrome,'Chromium is required');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-repost-browser-'));
let browser,socket;
const mock=[
 "const viewer='10000000-0000-4000-8000-000000000001';",
 "const original={id:'20000000-0000-4000-8000-000000000002',author_id:'30000000-0000-4000-8000-000000000003',author:{display_name:'Original Artist',role_type:'photographer'},body:'Original professional photo shoot update.',audience:'verified',published_at:'2026-11-21T10:00:00Z',allow_repost:true,likes:2,comments:1,saved:false,liked:false,photos:[],repost_of:null};",
 "const mine={...original,id:'40000000-0000-4000-8000-000000000004',author_id:viewer,author:{display_name:'Fixture Member',role_type:'creator'},body:'My own professional update.'};",
 "const repost={...original,id:'50000000-0000-4000-8000-000000000005',author_id:viewer,author:{display_name:'Fixture Member',role_type:'creator'},body:'Sharing this professional update.',repost_of:original.id,allow_repost:false,original:{id:original.id,body:original.body,author_id:original.author_id,author_name:'Original Artist',created_at:original.published_at,photos:[{id:'60000000-0000-4000-8000-000000000006',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2RwAAAABJRU5ErkJggg==',caption:'Approved original photo',content_label:'professional'}]}};",
 "window.__feedApi={calls:[],reposts:0};",
 "export const supabase={",
 "from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{feed_view:'discover',default_audience:'verified'},error:null})}),",
 "functions:{invoke:async(name,{body})=>{window.__feedApi.calls.push(body);",
 "if(name!=='connect-feed')return {data:{},error:null};",
 "if(body.action==='feed')return {data:{items:body.mode==='discover'?[original]:body.mode==='profile_posts'?[mine]:body.mode==='my_reposts'||body.mode==='profile_reposts'?[repost]:[],cursor:null},error:null};",
 "if(body.action==='repost'){window.__feedApi.reposts++;return {data:{item:{status:'published'}},error:null}}",
 "if(body.action==='like')return {data:{liked:true},error:null};",
 "if(body.action==='comments')return {data:{items:[]},error:null};",
 "if(body.action==='save')return {data:{saved:true},error:null};",
 "if(body.action==='report')return {data:{note:'Report received.'},error:null};",
 "return {data:{},error:null}}}",
 "};"
].join('\n');
const entry=[
 "import React from 'react';import {createRoot} from 'react-dom/client';",
 "import ConnectFeed from './src/supabase/ConnectFeed.jsx';",
 "const viewer='10000000-0000-4000-8000-000000000001';",
 "window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message));",
 "window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));",
 "createRoot(document.getElementById('fixture-root')).render(React.createElement(ConnectFeed,",
 "{userId:viewer,paid:true,profileId:window.__profileView?viewer:null,onNavigate:tab=>window.__navigated=tab}));"
].join('\n');
try{
 const templatePath=path.join(folder,'base.html');await createControlFixture(templatePath);
 const template=fs.readFileSync(templatePath,'utf8');
 const bundled=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'feed-fixture.jsx',loader:'jsx'},
  bundle:true,write:false,format:'iife',platform:'browser',
  define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},
  plugins:[{name:'feed-fixtures',setup(b){
   b.onResolve({filter:/api\/supabaseClient/},()=>({path:'feed-client',namespace:'mock'}));
   b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));
   b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
  }}]});
 const code=bundled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
 browser=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking',
  '--remote-debugging-port=0','--user-data-dir='+path.join(folder,'chrome'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Feed Chromium startup timeout')),40000);let logs='';
  browser.once('error',reject);browser.stderr.on('data',chunk=>{
   logs+=chunk;const m=logs.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}
  });
 });
 socket=new WebSocket(endpoint);
 await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});
 });
 let serial=0;const pending=new Map();
 socket.addEventListener('message',event=>{
  const msg=JSON.parse(event.data),p=pending.get(msg.id);if(!p)return;
  pending.delete(msg.id);clearTimeout(p.timer);
  msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);
 });
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},30000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evalInBrowser=async(fn,...args)=>{
  const expression='('+fn.toString()+')(...'+JSON.stringify(args)+')';
  const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;
 };
 await page('Page.enable');await page('Runtime.enable');await page('Network.enable');
 await page('Network.setBlockedURLs',{urls:['https://*']});
 const {frameTree}=await page('Page.getFrameTree');
 async function mount(profileView,width){
  await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
  const html=template.replace(/<body>[\s\S]*<\/body>/,()=>'<body><div id="fixture-root"></div><script>window.__profileView='+
   JSON.stringify(profileView)+';</script><script>'+code+'</script></body>');
  await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
  await evalInBrowser(async()=>{
   for(let i=0;i<150;i++){
    if(document.querySelector('[data-connect-feed] [role=tablist]')&&document.querySelector('[data-connect-post]'))return;
    await new Promise(r=>setTimeout(r,20));
   }
   throw Error('Feed did not load '+document.body.textContent.slice(0,300));
  });
 }
 for(const width of [390,1440]){
  await mount(false,width);
  await evalInBrowser(async()=>{
   const pause=()=>new Promise(r=>setTimeout(r,30));
   const tabs=[...document.querySelectorAll('[role=tab]')];
   if(tabs.length!==2||tabs[0].textContent.trim()!=='Feed'||!tabs[1].textContent.includes('Reposts'))
    throw Error('Dashboard Feed and Reposts tabs missing');
   const post=document.querySelector('[data-connect-post]');
   if(!post?.textContent.includes('Original professional photo shoot update.'))throw Error('Original feed post absent');
   for(const text of ['Comments','Repost','Report'])
    if(![...post.querySelectorAll('button')].some(b=>b.textContent.includes(text)))throw Error('Missing '+text+' action');
   if(post.querySelector('button[aria-label="Save post"]')===null)throw Error('Save action unavailable');
   if([...post.querySelectorAll('button')].some(b=>b.textContent.trim()==='Share'))throw Error('Share action still visible');
   post.querySelector('button[aria-label="Repost to your profile"]').click();await pause();
   if(window.__feedApi.reposts!==1)throw Error('Repost click did not call API');
   const call=window.__feedApi.calls.find(x=>x.action==='repost');
   if(call.text!=='Reposted this update.')throw Error('Unexpected repost payload');
   tabs[1].click();
   for(let i=0;i<50&&!document.querySelector('[data-repost-attribution]');i++)await pause();
   const repost=document.querySelector('[data-connect-post]');
   if(!repost?.textContent.includes('Fixture Member reposted')||!repost.textContent.includes('Original Artist'))
    throw Error('Repost attribution incorrect');
   if(repost.textContent.includes('Sharing this professional update.'))throw Error('Legacy generic caption leaked');
   if(!repost.querySelector('[data-original-repost-media] img[alt="Approved original photo"]'))throw Error('Original approved photo was not rendered');
   if(repost.querySelector('button[aria-label="Repost to your profile"]'))throw Error('Nested repost button must be hidden');
   if(window.__errors.length)throw Error('JS errors: '+window.__errors.join(', '));
  });
  await mount(true,width);
  await evalInBrowser(async()=>{
   const pause=()=>new Promise(r=>setTimeout(r,30));
   const tabs=[...document.querySelectorAll('[role=tab]')];
   if(tabs[0].textContent.trim()!=='Posts')throw Error('Profile Posts tab missing');
   if(!document.body.textContent.includes('My own professional update.'))throw Error('Own posts absent');
   tabs[1].click();
   for(let i=0;i<50&&!document.querySelector('[data-repost-attribution]');i++)await pause();
   if(!document.body.textContent.includes('Fixture Member reposted'))throw Error('Profile repost not rendered');
   const call=window.__feedApi.calls.find(x=>x.action==='feed'&&x.mode==='profile_reposts');
   if(!call||!call.author_id)throw Error('Profile repost backend query missing author');
   if(window.__errors.length)throw Error('Profile JS errors '+window.__errors.join(', '));
  });
  console.log('PASS mobile/desktop repost feed and profile interactions at '+width+'px');
 }
 await send('Browser.close');
}finally{
 socket?.close();
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{
  const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},6000);
  browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();
 });
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}catch(e){if(!['ENOTEMPTY','EBUSY'].includes(e.code))throw e;}
}
