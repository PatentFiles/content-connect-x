/** Exercise every role-generated desktop and mobile nav link in real React Chromium.
 * Isolated accounts and API fixtures; no provider/network writes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';
import {ROLE_ROUTES} from '../src/supabase/roleNavigationData.mjs';
const chrome=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(fs.existsSync);
assert.ok(chrome,'Chromium required for all-role navigation audit');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-role-clicks-'));
let browser,socket;
const mock=[
 "const q={select(){return this},eq(){return this},is(){return this},order(){return this},limit(){return this},maybeSingle(){return this},then(resolve){return Promise.resolve({data:[],count:0,error:null}).then(resolve)}};",
 "export const supabase={from:()=>({...q}),channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:async()=>{}};",
 "export const supabaseConfiguration={ready:true};",
 "export const requireSupabase=()=>supabase;"
].join('\n');
const fixture=[
 "import React,{useState} from 'react';",
 "import {createRoot} from 'react-dom/client';",
 "import Shell from './src/supabase/OriginalShell.jsx';",
 "import {MODULE_FEATURES} from './src/supabase/featureModules.mjs';",
 "const flags=Object.fromEntries(Object.values(MODULE_FEATURES).map(v=>[v,true]));",
 "flags.__ccxLoaded=true;",
 "flags.__ccxAccess=Object.fromEntries(Object.values(MODULE_FEATURES).map(v=>[v,{eligible:true,reason:'ready'}]));",
 "const user={id:'00000000-0000-4000-8000-000000000001'};",
 "const profile={id:user.id,display_name:'Role navigation fixture',role_type:window.__role,profile_complete:true};",
 "window.__navigations=[];window.__signouts=0;",
 "function App(){const [tab,setTab]=useState('dashboard');",
 "const navigate=next=>{window.__navigations.push(next);setTab(next)};",
 "return React.createElement(Shell,{user,profile,tab,onNavigate:navigate,approved:true,isAdmin:window.__admin,featureFlags:flags,onSignOut:()=>{window.__signouts++}},",
 "React.createElement('div',{'data-route-marker':tab},'Route: '+tab));}",
 "createRoot(document.getElementById('fixture-root')).render(React.createElement(App));"
].join('\n');
try{
 const file=path.join(folder,'base.html');await createControlFixture(file);
 const template=fs.readFileSync(file,'utf8');
 const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),sourcefile:'role-clicks.js',loader:'js'},
  bundle:true,write:false,format:'iife',platform:'browser',
  define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},
  plugins:[{name:'fixture',setup(b){
   b.onResolve({filter:/api\/supabaseClient/},()=>({path:'supabase',namespace:'mock'}));
   b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js'}));
   b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
  }}]});
 const code=bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
 browser=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking',
  '--remote-debugging-port=0','--user-data-dir='+path.join(folder,'chrome'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Chromium startup timed out')),40000);let log='';
  browser.once('error',reject);browser.stderr.on('data',chunk=>{
   log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}
  });
 });
 socket=new WebSocket(endpoint);
 await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});
 });
 const pending=new Map();let seq=0;
 socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data),p=pending.get(message.id);if(!p)return;
  pending.delete(message.id);clearTimeout(p.timer);
  message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);
 });
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},30000);
  pending.set(id,{resolve,reject,timer});
  socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async(fn,...args)=>{
  const expression='('+fn.toString()+')(...'+JSON.stringify(args)+')';
  const result=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
 };
 await page('Page.enable');await page('Runtime.enable');await page('Network.enable');
 await page('Network.setBlockedURLs',{urls:['https://*']});
 const {frameTree}=await page('Page.getFrameTree');
 let totalDesktop=0,totalMobile=0;
 for(const role of [...Object.keys(ROLE_ROUTES),'creator-admin']){
  const currentRole=role==='creator-admin'?'creator':role,admin=role==='creator-admin';
  await page('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const html=template.replace(/<body>[\s\S]*<\/body>/,()=>'<body><div id="fixture-root"></div><script>window.__role='+JSON.stringify(currentRole)+';window.__admin='+JSON.stringify(admin)+
   ';window.__errors=[];window.addEventListener("error",e=>window.__errors.push(e.message));window.addEventListener("unhandledrejection",e=>window.__errors.push(String(e.reason)));</script><script>'+code+'</script></body>');
  await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
  const desktop=await evaluate(async role=>{
   const pause=()=>new Promise(resolve=>setTimeout(resolve,12));
   for(let i=0;i<150&&!document.querySelector('nav[aria-label="Grouped role navigation"]');i++)await pause();
   const root=document.querySelector('nav[aria-label="Grouped role navigation"]');
   if(!root)throw Error('Desktop nav never mounted for '+role);
   const sections=[...root.querySelectorAll('section.ccx-nav-section')];
   const groupNames=sections.map(x=>x.querySelector('h2')?.textContent.trim()).filter(Boolean);
   const clicked=[];
   const getSection=name=>[...root.querySelectorAll('section.ccx-nav-section')].find(x=>x.querySelector('h2')?.textContent.trim()===name);
   if(root.querySelector('.ccx-nav-heading-button')||document.querySelector('.ccx-nav-rail'))
    throw Error('Retired double navigation is still present for '+role);
   for(const name of groupNames){
    const section=getSection(name);
    if(!section||!section.querySelector('h2.ccx-nav-heading'))
     throw Error('Missing static section heading '+name);
    const labels=[...section.querySelectorAll('button.ccx-nav-link')].map(x=>x.textContent.trim());
    for(const label of labels){
     const button=[...getSection(name).querySelectorAll('button.ccx-nav-link')].find(x=>x.textContent.trim()===label);
     if(!button)throw Error('Missing desktop button '+role+' / '+label);
     const before=window.__navigations.length;button.click();await pause();
     if(window.__navigations.length!==before+1)throw Error('Inert desktop click '+role+' / '+label);
     const destination=window.__navigations.at(-1);
     const rendered=destination==='verification'
      ?[...document.querySelectorAll('h1')].some(el=>el.textContent.includes('Age verification'))
      :document.querySelector('[data-route-marker]')?.dataset.routeMarker===destination;
     if(!rendered)throw Error('Desktop route did not render '+role+' / '+label+' / '+destination);
     clicked.push(label);
    }
   }
   for(const required of ['My Profile','View Profile','Year in Review','Notifications','Discovery','Properties'])
    if(!clicked.includes(required))throw Error('Missing required route '+role+' / '+required);
   if(['agent','studio'].includes(role)&&!clicked.includes('Roster'))throw Error('Missing Roster for '+role);
   if(['photographer','videographer','video_editor'].includes(role)&&!clicked.includes('Portfolio'))throw Error('Missing Portfolio for '+role);
   if(role==='creator-admin'&&!clicked.includes('Platform Controls'))throw Error('Missing admin control link');
   const prev=window.__navigations.length;
   const settings=[...document.querySelectorAll('.ccx-nav-exit button')].find(b=>b.textContent.trim()==='Settings');
   if(!settings)throw Error('Bottom Settings link missing');
   settings.click();await pause();
   if(window.__navigations.length!==prev+1||window.__navigations.at(-1)!=='settings')
    throw Error('Bottom Settings link is inert');
   const exit=[...document.querySelectorAll('.ccx-nav-exit button')].find(b=>b.textContent.trim()==='Log Out');
   if(!exit)throw Error('Bottom Log out button missing');exit.click();
   if(window.__signouts!==1)throw Error('Desktop sign-out callback failed');
   if(window.__errors.length)throw Error('Runtime errors: '+window.__errors.join(' / '));
   return clicked.length;
  },role);
  totalDesktop+=desktop;
  await page('Emulation.setDeviceMetricsOverride',{width:390,height:850,deviceScaleFactor:1,mobile:true});
  const mobile=await evaluate(async role=>{
   const pause=()=>new Promise(resolve=>setTimeout(resolve,12));
   const trigger=()=>document.querySelector('button[aria-label="Open navigation menu"]');
   if(!trigger())throw Error('Mobile hamburger missing');
   const dialog=()=>document.querySelector('[role="dialog"][aria-label="Navigation"]');
   const open=async()=>{trigger().click();await pause();if(!dialog())throw Error('Mobile drawer did not open');};
   await open();
   const labels=[...dialog().querySelectorAll('nav[aria-label="Mobile navigation"] button.ccx-nav-link')].map(x=>x.textContent.trim());
   if(!labels.length)throw Error('Mobile nav empty');
   for(const label of ['My Profile','View Profile','Year in Review','Notifications','Discovery','Properties'])
    if(!labels.includes(label))throw Error('Mobile link absent: '+label+' for '+role);
   dialog().querySelector('button[aria-label="Close navigation"]').click();await pause();
   if(dialog())throw Error('Mobile Close button failed');
   for(const label of labels){
    await open();
    const button=[...dialog().querySelectorAll('nav[aria-label="Mobile navigation"] button.ccx-nav-link')].find(x=>x.textContent.trim()===label);
    if(!button)throw Error('Mobile item disappeared '+role+' / '+label);
    const before=window.__navigations.length;button.click();await pause();
    if(window.__navigations.length!==before+1||dialog())throw Error('Mobile route or close failed '+role+' / '+label);
    const destination=window.__navigations.at(-1);
    const rendered=destination==='verification'
     ?[...document.querySelectorAll('h1')].some(el=>el.textContent.includes('Age verification'))
     :document.querySelector('[data-route-marker]')?.dataset.routeMarker===destination;
    if(!rendered)throw Error('Mobile route not rendered '+role+' / '+label+' / '+destination);
   }
   await open();
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await pause();
   if(dialog())throw Error('Escape did not close drawer');
   await open();
   const signout=dialog().querySelector('button[aria-label="Sign out"]');
   if(!signout)throw Error('Mobile sign out not found');signout.click();await pause();
   if(window.__signouts!==2)throw Error('Mobile sign out callback did not fire');
   if(window.__errors.length)throw Error('Runtime errors: '+window.__errors.join(' / '));
   return labels.length;
  },role);
  totalMobile+=mobile;
  console.log('PASS '+role+': '+desktop+' desktop routes, '+mobile+' mobile routes');
 }
 assert.ok(totalDesktop>=95&&totalMobile>=95,'Too few actual interactive role routes were exercised');
 console.log('PASS '+totalDesktop+' desktop and '+totalMobile+' mobile React route clicks across every role, plus admin preview');
 await send('Browser.close');
}finally{
 socket?.close();
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{
  const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},6000);
  browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();
 });
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}catch(e){if(!['ENOTEMPTY','EBUSY'].includes(e.code))throw e;}
}
