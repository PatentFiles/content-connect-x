/** Isolated browser acceptance of the actual ID/selfie onboarding screen. No provider calls. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';
const browserPath=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(p=>fs.existsSync(p));
assert.ok(browserPath,'A real Chromium browser is required');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-yoti-'));let browser,socket;
try{
 const fixture=path.join(folder,'source.html');await createControlFixture(fixture);
 let template=fs.readFileSync(fixture,'utf8');
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Gate from './src/supabase/AgeGateOnboarding.jsx';window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message));window.__approval=0;window.__signout=0;createRoot(document.getElementById('root')).render(<Gate onReload={()=>{window.__approval++;}} onSignOut={()=>{window.__signout++;}}/>);`,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'provider-fixture',setup(b){b.onResolve({filter:/integrationApi/},()=>({path:'fixture-api',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function integrationAction(action){if(action==='yoti_readiness')return {yoti_configured:window.__scenario!=='disabled'};if(action==='yoti_status')return {status:window.__scenario==='approved'?'age_confirmed':'not_started'};throw Error('No real provider session may be created by this test');}`,loader:'js'}));}}]});
 const html=template.replace(/<body[\s\S]*<\/body>/,()=>`<body><div id="root"></div><script>window.__scenario='ready';</script><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body>`).replace('<head>','<head><base href="https://fixture.invalid/">');
 browser=spawn(browserPath,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Browser startup timed out')),20000);let log='';
  browser.once('error',error=>{clearTimeout(timer);reject(error);});
  browser.once('exit',code=>{clearTimeout(timer);reject(new Error('Browser exited during startup: '+code));});
  browser.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
 });
 socket=new WebSocket(endpoint);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();
 socket.addEventListener('message',event=>{const response=JSON.parse(event.data);const request=pending.get(response.id);if(!request)return;pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(new Error(JSON.stringify(response.error))):request.resolve(response.result);});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'));},20000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const response=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));return response.result?.value;};
 await page('Page.enable');await page('Runtime.enable');
 const {frameTree}=await page('Page.getFrameTree');
 await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html});

 const results=[];
 for(const width of [320,390,768,1440]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate("new Promise(resolve=>{const ready=()=>document.querySelector('h1')&&document.querySelector('.ccx-primary')&&!document.querySelector('.ccx-primary').disabled?requestAnimationFrame(()=>requestAnimationFrame(resolve)):setTimeout(ready,20);ready();})");
  await evaluate("(()=>{const image=document.querySelector('img[alt=Yoti]');if(image){image.src="+JSON.stringify('data:image/svg+xml;base64,'+fs.readFileSync('public/yoti-logo.svg').toString('base64'))+";image.hidden=false;}return new Promise(r=>setTimeout(r,50));})()");
  const state=await evaluate(`(()=>({heading:document.querySelector('h1').textContent,files:document.querySelectorAll('input[type=file]').length,overflow:document.documentElement.scrollWidth>innerWidth+1,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent,disabled:e.disabled})),errors:window.__errors}))()`);
  assert.equal(state.heading,'Age verification');assert.equal(state.files,0);assert.equal(state.overflow,false);assert.deepEqual(state.errors,[]);
  assert.deepEqual(state.buttons.map(v=>v.text),['Verify with Yoti','Sign out and finish later']);
  results.push({width,passed:true});
  if(process.env.PROVIDER_SCREENSHOT_DIR&&[390,1440].includes(width)){
   fs.mkdirSync(process.env.PROVIDER_SCREENSHOT_DIR,{recursive:true});
   const shot=await page('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(process.env.PROVIDER_SCREENSHOT_DIR,`yoti-onboarding-${width}.png`),Buffer.from(shot.data,'base64'));
  }
 }
 await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Sign out')).click();new Promise(r=>setTimeout(r,50))");assert.equal(await evaluate('window.__signout'),1);
 // Re-rendered provider outcomes test the same real component with isolated responses.
 for(const scenario of ['disabled','approved']){
  const variant=html.replace("window.__scenario='ready'",`window.__scenario='${scenario}'`);
  await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html:variant});
  await evaluate("new Promise(resolve=>setTimeout(resolve,250))");
  if(scenario==='disabled'){assert.equal(await evaluate("document.querySelector('.ccx-primary')?.disabled"),true);assert.equal(await evaluate("document.body.textContent.includes('temporarily unavailable')"),true);assert.equal(await evaluate('window.__approval'),0);}
  else{assert.equal(await evaluate("document.querySelector('h1').textContent"),'Age verified');assert.equal(await evaluate('window.__approval'),1);}
 }
 console.log('PASS 7 actual React Yoti browser checks: four widths, sign-out, disabled provider and server approval callback. No ID uploads or provider network requests.');
 if(process.env.PROVIDER_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.PROVIDER_SCREENSHOT_DIR,'provider-browser-results.json'),JSON.stringify(results,null,2));
 await send('Browser.close');
}finally{
 socket?.close();
 // Chrome's child processes may finish profile writes after Browser.close().
 // Wait for process exit and retry asynchronously, never blocking its exit event.
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{
  const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},5000);
  browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();
 });
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}
 catch(error){
  // A locked throwaway profile is not a failed geometry assertion. Keep all
  // assertion/runtime failures fatal, and report cleanup-only OS contention.
  if(!['ENOTEMPTY','EBUSY'].includes(error.code))throw error;
  console.warn('Browser checks completed; temporary profile cleanup deferred:',error.code);
 }
}
