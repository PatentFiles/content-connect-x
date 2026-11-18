/** Render real screens with isolated API fixtures. Never signs in, changes data,
 * calls a provider, or uses credentials. Guards the shared white design system. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';

const browserPath=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(p=>fs.existsSync(p));
assert.ok(browserPath,'A real Chromium browser is required');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-professional-'));
let browser,socket;
const output=process.env.STYLE_SCREENSHOT_DIR;
const mock=`
import {defaultDashboardLayout,widgetsForRole} from './src/supabase/dashboardWidgets.mjs';
const role=new URLSearchParams(location.search).get('role')||'creator';
const user={id:'00000000-0000-4000-8000-000000000001',email:'style-fixture@example.invalid'};
const loggedIn=location.pathname==='/host-dashboard';
const session=loggedIn?{user,access_token:'isolated-ui-fixture'}:null;
function chain(table){const q={select(){return this},eq(){return this},is(){return this},order(){return this},limit(){return this},range(){return this},maybeSingle(){return this},single(){return this},then(resolve){return Promise.resolve({data:table==='host_profiles'?null:[],count:0,error:null}).then(resolve)}};return q;}
const channel={on(){return this},subscribe(){return this},track:async()=>{},untrack:async()=>{},send:async()=>{},presenceState:()=>({})};
function reply(action){
 if(action==='onlyhost_status')return {registered:true,host_terms_current:true};
 if(action==='host_dashboard_summary')return {properties:0,views_30d:0,booking_requests:0,upcoming:0,conversations:0,by_property:[]};
 if(action==='host_market_overview')return {items:[],owned_items:[],areas:[],has_more:false,next_offset:0};
 if(action==='property_catalog')return {amenities:[{id:'wifi',label:'Wi-Fi',category:'comfort',status:'approved'}],countries:[],regions:[],cities:[],areas:[]};
 if(action==='host_defaults_get')return {settings:null};
 return {items:[],pending_images:[],pending_videos:[],amenities:[],countries:[],cities:[],regions:[],areas:[]};
}
export const supabase={
 auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal1'},error:null}),listFactors:async()=>({data:{all:[],totp:[]},error:null})}},
 from:table=>chain(table),channel:()=>Object.create(channel),removeChannel:async()=>{},
 functions:{invoke:async(name,{body}={})=>({data:reply(body?.action),error:null})},
 rpc:async(name)=>({data:name==='ccx_dashboard_action'?{schema_version:1,role,layout:defaultDashboardLayout(role),revision:1,checked_at:'2026-11-18T12:00:00Z',metrics:Object.fromEntries(widgetsForRole(role).map(w=>[w.id,{status:'ready',value:0,subtitle:'Isolated UI fixture — not live account activity'}]))}:[],error:null})
};
export const supabaseConfiguration={ready:true};
export const requireSupabase=()=>supabase;
`;
const fixture=`
import React from 'react';import {createRoot} from 'react-dom/client';
import App from './src/supabase/SupabaseApp.jsx';
import Host from './src/supabase/OnlyHostApp.jsx';
import Shell from './src/supabase/OriginalShell.jsx';
import Dashboard from './src/supabase/CustomDashboard.jsx';
import Workspace from './src/supabase/MemberWorkspace.jsx';
import {MODULE_FEATURES} from './src/supabase/featureModules.mjs';
const role=new URLSearchParams(location.search).get('role')||'creator';
const user={id:'00000000-0000-4000-8000-000000000001',email:'style-fixture@example.invalid'};
const profile={id:user.id,role_type:role,display_name:'Design review (test account)'};
const flags=Object.fromEntries(Object.values(MODULE_FEATURES).map(key=>[key,true]));flags.__ccxLoaded=true;flags.__ccxAccess=Object.fromEntries(Object.values(MODULE_FEATURES).map(key=>[key,{eligible:true,reason:'ready'}]));
window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));
const view=location.pathname==='/dashboard'?<Shell user={user} profile={profile} isAdmin approved tab="dashboard" featureFlags={flags} onNavigate={()=>{}} onSignOut={()=>{}}><Dashboard profile={profile} onNavigate={()=>{}}/></Shell>:
 location.pathname==='/collaborations'?<Shell user={user} profile={profile} isAdmin approved tab="collaborations" featureFlags={flags} onNavigate={()=>{}} onSignOut={()=>{}}><Workspace user={user} flags={flags} paid initialSection="collaborations"/></Shell>:
 ['/hostconnect','/host-dashboard'].includes(location.pathname)?<Host/>:<App/>;
createRoot(document.getElementById('fixture-root')).render(view);
`;
try {
 const base=path.join(folder,'template.html');await createControlFixture(base);
 const template=fs.readFileSync(base,'utf8');
 const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),sourcefile:'professional-fixture.jsx',loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}','window.location.pathname':'window.__stylePath','location.pathname':'window.__stylePath','window.location.search':'window.__styleSearch','location.search':'window.__styleSearch'},plugins:[{name:'isolated-professional-fixture',setup(b){b.onResolve({filter:/api\/supabaseClient/},()=>({path:'supabase',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
 const html=template.replace(/<body>[\s\S]*<\/body>/,()=>`<body><div id="fixture-root"></div><script>window.__stylePath="/";window.__styleSearch="";window.__errors=[];window.addEventListener("error",e=>window.__errors.push(e.message));</script><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body>`);
 browser=spawn(browserPath,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Browser startup timed out')),20000);let log='';browser.once('error',reject);browser.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const response=JSON.parse(event.data),r=pending.get(response.id);if(!r)return;pending.delete(response.id);clearTimeout(r.timer);response.error?r.reject(Error(JSON.stringify(response.error))):r.resolve(response.result);});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 await page('Page.enable');await page('Runtime.enable');
 const {frameTree}=await page('Page.getFrameTree');
 // Block external requests. Fonts, maps and provider services are not part of an isolated theme check.
 await page('Network.enable');await page('Network.setBlockedURLs',{urls:['https://*','http://*.supabase.co/*']});
 const results=[];
 async function inspect(label,width){
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const state=await evaluate(`(()=>{
   const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
   const badButtons=[...document.querySelectorAll('.ccx-primary,.ccx-action-primary,.oh-primary,.ccx-solid-action,.oh-gallery-primary')].filter(e=>visible(e)&&!e.disabled).filter(e=>{const s=getComputedStyle(e);return s.backgroundImage!=='none'||s.animationName!=='none'||s.color!=='rgb(255, 255, 255)';}).map(e=>({text:e.textContent.slice(0,40),bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
   const darkPanels=[...document.querySelectorAll('.ccx-surface,.oh-panel,.oh-dialog')].filter(visible).filter(e=>{const rgb=getComputedStyle(e).backgroundColor.match(/[\\d.]+/g)?.map(Number)||[];return rgb.length>=3&&Math.max(...rgb.slice(0,3))<240&&rgb[3]!==0;}).map(e=>e.className);
   return {background:getComputedStyle(document.body).backgroundColor,colorScheme:getComputedStyle(document.documentElement).colorScheme,overflow:document.documentElement.scrollWidth>innerWidth+1,badButtons,darkPanels,errors:window.__errors||[],headings:[...document.querySelectorAll('h1')].map(e=>e.textContent)};
  })()`);
  assert.equal(state.background,'rgb(255, 255, 255)',label+' background');
  assert.equal(state.colorScheme,'light',label+' browser chrome');
  assert.equal(state.overflow,false,label+' horizontal overflow');
  assert.deepEqual(state.badButtons,[],label+' solid button styling');
  assert.deepEqual(state.darkPanels,[],label+' light surfaces');
  assert.deepEqual(state.errors,[],label+' runtime errors');
  results.push({label,width,passed:true});
  if(output&&[390,1440].includes(width)){fs.mkdirSync(output,{recursive:true});const shot=await page('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,`${label.replace(/[^a-z0-9-]/gi,'-')}-${width}.png`),Buffer.from(shot.data,'base64'));}
 }
 async function navigate(route,width){
  await page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  const [routePath,search='']=route.split('?');
  const screen=html.replace('window.__stylePath="/";window.__styleSearch="";',`window.__stylePath=${JSON.stringify(routePath)};window.__styleSearch=${JSON.stringify(search?'?'+search:'')};`);
  await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html:screen});
  await new Promise(resolve=>setTimeout(resolve,100));
  await evaluate(`new Promise((resolve,reject)=>{let count=0;const ready=()=>{if(document.querySelector('#fixture-root')?.textContent.trim()&&!/^Loading/.test(document.querySelector('#fixture-root').textContent.trim()))setTimeout(resolve,100);else if(++count>100)reject(Error('Screen did not load: '+JSON.stringify({text:document.body?.textContent?.slice(0,300),errors:window.__errors})));else setTimeout(ready,20);};ready();})`);
 }
 for(const route of ['/','/login','/signup','/pricing','/hostconnect','/collaborations','/host-dashboard']){
  for(const width of [320,390,768,1440]){
   console.log('Checking',route,width);await navigate(route,width);await inspect(route==='/'?'homepage':route.slice(1),width);
   if(route==='/host-dashboard'){
    await evaluate("document.querySelector('.oh-new-space-action').click();new Promise(r=>setTimeout(r,100))");
    await inspect('new-space-modal',width);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('dialog')).colorScheme"),'light');
    await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await evaluate("new Promise(r=>setTimeout(r,70));");
    await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Set Default Rules')).click();new Promise(r=>setTimeout(r,70))");
    await inspect('default-rules-modal',width);
   }
  }
 }
 for(const role of ['creator','agent','studio','photographer','videographer','video_editor']){
  await navigate('/dashboard?role='+role,1440);await inspect('dashboard-'+role,1440);
 }
 console.log(`PASS ${results.length} real-screen light-theme checks: public pages, signup, pricing, collaborations, host dashboard/modals, six roles; mobile through desktop and OS dark preference.`);
 if(output)fs.writeFileSync(path.join(output,'professional-theme-results.json'),JSON.stringify(results,null,2));
 await send('Browser.close');
} finally {
 socket?.close();
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},5000);browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();});
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}catch(e){if(!['ENOTEMPTY','EBUSY'].includes(e.code))throw e;}
}
