/** Actual React screens, local synthetic APIs, no production accounts or network writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';
const chrome=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(fs.existsSync);
assert.ok(chrome,'Chromium is required');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-trust-dashboard-'));
let server,browser,socket;
const mock=`
const user={id:'00000000-0000-4000-8000-000000000001'};
const people=[{id:'00000000-0000-4000-8000-000000000002',display_name:'Synthetic professional',role_type:'creator',city:'Phoenix',country:'United States',bio:'Synthetic professional biography',age_verified:true}];
let authUser=user;const listeners=new Set();
window.__db={calls:[],layout:JSON.parse(sessionStorage.getItem('fixture-layout')||'null'),revision:0,failLoad:location.search.includes('failLoad'),allowProfile:true,failIntake:false,staff:location.search.includes('staff=1')};
window.__signOut=()=>{authUser=null;window.__db.staff=false;for(const listener of listeners)listener('SIGNED_OUT',null);};
export const supabase={auth:{onAuthStateChange(cb){listeners.add(cb);queueMicrotask(()=>cb('INITIAL_SESSION',{user:authUser}));return {data:{subscription:{unsubscribe(){listeners.delete(cb);}}}};}},
 rpc:async(name,args={})=>{
  const db=window.__db;db.calls.push({name,args});
  if(name==='ccx_dashboard_action'){
   if(db.failLoad)return {error:{message:'Synthetic load unavailable'}};
   if(args.p_action==='save'){db.layout=args.p_layout;db.revision++;sessionStorage.setItem('fixture-layout',JSON.stringify(db.layout));return {data:{layout:db.layout,revision:db.revision,role:'creator'}};}
   return {data:{schema_version:1,role:'creator',layout:db.layout,revision:db.revision,metrics:{favorites:{status:'ready',value:0,subtitle:'Synthetic metric'}},checked_at:'2026-11-19T12:00:00Z'}};
  }
  if(name==='ccx_trust_public_config')return {data:{ready:location.search.includes('ready=1'),policies_approved:false}};
  if(name==='ccx_trust_review'){
   if(!db.staff)return {error:{message:'Staff MFA required'}};
   if(args.p_action==='list')return {data:{items:[{id:people[0].id,kind:'support',status:'pending',priority:'normal',created_at:'2026-11-19T12:00:00Z'}]}};
   if(args.p_action==='read')return {data:{id:people[0].id,payload:{details:'private-case-fixture'},status:'pending'}};
   return {data:{updated:true}};
  }
  return {data:{}};
 },functions:{invoke:async(name,{body})=>{
  window.__db.calls.push({name,body});
  if(name==='directory')return {data:{results:body.ids&&!window.__db.allowProfile?[]:people}};
  if(name==='member-workflows')return {data:{socials:{Website:'https://example.invalid/portfolio',Unsafe:'javascript:alert(1)'}}};
  if(name==='trust-intake')return window.__db.failIntake?{error:{message:'Synthetic transport failure'}}:{data:{received:true,reference:'synthetic-receipt'}};
  return {data:{}};
 }}
};
export const supabaseConfiguration={ready:true};
`;
const fixture=`
import React from 'react';import {createRoot} from 'react-dom/client';
import Dashboard from './src/supabase/CustomDashboard.jsx';
import TrustSite from './src/supabase/TrustSite.jsx';
import PrivacyBoundary from './src/supabase/SessionPrivacyBoundary.jsx';
import {widgetsForRole} from './src/supabase/dashboardWidgets.mjs';
window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));
window.__catalogCount=widgetsForRole('creator').length;
document.documentElement.dataset.ccxAppearance=location.pathname.startsWith('/trust')?'public':'workspace';
const profile={id:'00000000-0000-4000-8000-000000000001',role_type:'creator',display_name:'Synthetic dashboard',city:'Phoenix',country:'US'};
createRoot(document.getElementById('fixture-root')).render(<PrivacyBoundary><TrustSite><div className="ccx-original-shell"><main style={{padding:24,maxWidth:1100,margin:'auto'}}><Dashboard profile={profile} onNavigate={tab=>window.__navigation=tab}/></main></div></TrustSite></PrivacyBoundary>);
`;
try{
 const templatePath=path.join(folder,'template.html');await createControlFixture(templatePath);
 const template=fs.readFileSync(templatePath,'utf8');
 const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),sourcefile:'trust-fixture.jsx',loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'fixture',setup(b){b.onResolve({filter:/api\/supabaseClient/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
 const styles=['src/supabase/workspace-refinement.css','src/supabase/trust-site.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
 const html=template.replace('</head>','<style>'+styles+'</style></head>').replace(/<body>[\s\S]*<\/body>/,()=>'<body><div id="fixture-root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script></body>');
 server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Browser startup timeout')),20000);let log='';browser.once('error',reject);browser.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();socket.addEventListener('message',e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(!p)return;pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error(method+' timeout')),20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,80));}throw Error('Timed out: '+expression);};
 const click=async text=>{assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return false;b.click();return true;})()`),true,'Click '+text);};
 const visit=async route=>{await page('Page.navigate',{url:origin+route});await waitFor('!!window.__db && !!document.querySelector(".ccx-trust-footer")');};
 const noErrors=async()=>assert.deepEqual(await evaluate('window.__errors'),[]);
 await page('Page.enable');await page('Runtime.enable');await page('Network.enable');await page('Network.setBlockedURLs',{urls:['https://*']});
 await page('Emulation.setDeviceMetricsOverride',{width:1320,height:1000,deviceScaleFactor:1,mobile:false});
 await visit('/dashboard');await waitFor('document.body.textContent.includes("Your dashboard, your way")');
 assert.equal(await evaluate('document.querySelectorAll(".ccx-dashboard-card").length'),0);
 assert.equal(await evaluate('window.__db.calls.some(c=>c.name==="directory")'),false);
 await click('Customize Dashboard');assert.equal(await evaluate('document.querySelectorAll(".ccx-catalog-option").length===window.__catalogCount'),true);
 assert.equal(await evaluate('(()=>{document.querySelector("[aria-label=\"Add Featured creators\"]").click();return true;})()'),true);
 await waitFor('!!document.querySelector(".ccx-person-preview")');await click('Save dashboard');await waitFor('document.body.textContent.includes("Dashboard saved")');
 assert.deepEqual(await evaluate('window.__db.layout'),[{id:'featured_creators',width:'wide'}]);
 await evaluate('document.querySelector(".ccx-person-preview").click()');await waitFor('document.querySelector("dialog[open]")?.textContent.includes("Synthetic professional biography")');
 await waitFor('document.querySelector(".ccx-profile-links a")?.textContent==="Website"');
 assert.equal(await evaluate('!!document.querySelector("a[href^=\"javascript:\"]")'),false);await click('Close');
 await evaluate('window.__db.allowProfile=false;document.querySelector(".ccx-person-preview").click()');await waitFor('document.body.textContent.includes("no longer available")');await click('Close');
 await visit('/dashboard');await waitFor('!!document.querySelector(".ccx-person-preview")');
 assert.equal(await evaluate('document.querySelectorAll(".ccx-dashboard-card").length'),1);
 await noErrors();
 if(process.env.STYLE_SCREENSHOT_DIR){fs.mkdirSync(process.env.STYLE_SCREENSHOT_DIR,{recursive:true});const shot=await page('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(process.env.STYLE_SCREENSHOT_DIR,'dashboard-professionals.png'),Buffer.from(shot.data,'base64'));}
 await click('Customize Dashboard');await click('Clear dashboard');await click('Save dashboard');await waitFor('document.body.textContent.includes("Your dashboard, your way")');
 await visit('/dashboard?failLoad=1');await waitFor('document.body.textContent.includes("Synthetic load unavailable")');
 assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Customize Dashboard").disabled'),true);
 await evaluate('window.__db.failLoad=false');await click('Retry dashboard');await waitFor('document.body.textContent.includes("Your dashboard, your way")');
 await visit('/trust/content-removal');await waitFor('document.body.textContent.includes("Request intake is not open yet")');assert.equal(await evaluate('document.querySelectorAll("form").length'),0);
 await visit('/trust/cookies');await waitFor('document.querySelectorAll("input[type=checkbox]").length===2');
 assert.equal(await evaluate('[...document.querySelectorAll("input[type=checkbox]")].every(e=>!e.checked)'),true);
 await evaluate('document.querySelector("input[type=checkbox]").click()');await click('Save preferences and reload');await waitFor('document.querySelector("input[type=checkbox]")?.checked===true');
 await click('Reject optional services');await waitFor('document.querySelectorAll("input[type=checkbox]").length===2 && [...document.querySelectorAll("input[type=checkbox]")].every(e=>!e.checked)');
 await visit('/trust/support?ready=1');await waitFor('!!document.querySelector("form")');
 await evaluate('window.__db.failIntake=true;const t=document.querySelector("textarea");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(t,"Synthetic support request without any personal data");t.dispatchEvent(new Event("input",{bubbles:true}));');
 await click('Submit request');await waitFor('!!document.querySelector("[role=alert]")');assert.equal(await evaluate('document.body.textContent.includes("Request recorded")'),false);
 await evaluate('window.__db.failIntake=false');await click('Submit request');await waitFor('document.body.textContent.includes("synthetic-receipt")');
 await noErrors();
 await visit('/trust/review?staff=1');await click('Load review queue');await waitFor('!!document.querySelector(".ccx-trust-cases button")');await evaluate('document.querySelector(".ccx-trust-cases button").click()');await waitFor('document.body.textContent.includes("private-case-fixture")');
 await evaluate('window.__signOut()');await waitFor('!document.body.textContent.includes("private-case-fixture")');await click('Load review queue');await waitFor('document.body.textContent.includes("Staff MFA required")');
 await page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await visit('/trust/anti-trafficking');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),true,'No mobile horizontal overflow');await noErrors();
 if(process.env.STYLE_SCREENSHOT_DIR){const shot=await page('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(process.env.STYLE_SCREENSHOT_DIR,'trust-mobile.png'),Buffer.from(shot.data,'base64'));}
 console.log('PASS real-browser empty/preserved dashboards, full picker, profile reauthorization, failed-load UX, cookie persistence/rejection, closed intake, success/error receipts, staff logout clearing and mobile footer. Synthetic fixtures only.');
}finally{socket?.close();browser?.kill('SIGTERM');if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(folder,{recursive:true,force:true});}
