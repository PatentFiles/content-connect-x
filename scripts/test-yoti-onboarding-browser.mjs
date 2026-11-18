/** Actual React onboarding in Chromium. Historical filename retained for the
 * quality workflow; Content Connect no longer uses Yoti for this screen.
 * All provider responses are isolated fixtures; no real ID, camera or API calls.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';
const browserPath=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(p=>fs.existsSync(p));
assert.ok(browserPath,'A real Chromium browser is required');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-identity-'));let browser,socket;
try{
 const fixture=path.join(folder,'source.html');await createControlFixture(fixture);
 const template=fs.readFileSync(fixture,'utf8');
 const mock=`export async function identityAction(action){
  if(action!=='status')throw Error('No real identity mutation may be made by this test');
  const scenario=window.__scenario;
  const sessions={
   collecting:{id:'fixture',status:'collecting',document_type:'drivers_license',uploaded:{},directions:['left','right']},
   approved:{id:'fixture',status:'approved'},
   age_restricted:{id:'fixture',status:'age_restricted',eligible_on:'2099-01-02',message:'You are under 18 and restricted from using this service.'},
   name_mismatch:{id:'fixture',status:'name_mismatch',expected_name:'Synthetic Legal Name',message:'The legal name does not match. Your public display name will not change.'},
   review_required:{id:'fixture',status:'review_required',message:'Every required check must pass before admission.'}
  };
  return {enabled:scenario!=='disabled',email_confirmed:true,legal_name:'Synthetic User',notice_version:'ci',notice:'Synthetic browser fixture notice, not a production consent notice.',retention_days:7,supported_countries:['US'],session:sessions[scenario]||null};
 }
 export async function identityUpload(){throw Error('No documents may be uploaded by this UI test');}`;
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Gate from './src/supabase/AgeGateOnboarding.jsx';window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message));window.__approval=0;window.__signout=0;createRoot(document.getElementById('root')).render(<Gate onReload={()=>{window.__approval++;}} onSignOut={()=>{window.__signout++;}}/>);`,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'identity-fixture',setup(b){b.onResolve({filter:/identityApi/},()=>({path:'identity-api',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js'}));}}]});
 const html=template.replace(/<body[\s\S]*<\/body>/,()=>`<body><div id="root"></div><script>window.__scenario='ready';</script><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body>`).replace('<head>','<head><base href="https://fixture.invalid/">');
 browser=spawn(browserPath,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Browser startup timed out')),20000);let log='';browser.once('error',error=>{clearTimeout(timer);reject(error);});browser.once('exit',code=>{clearTimeout(timer);reject(new Error('Browser exited during startup: '+code));});browser.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();
 socket.addEventListener('message',event=>{const response=JSON.parse(event.data);const request=pending.get(response.id);if(!request)return;pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(new Error(JSON.stringify(response.error))):request.resolve(response.result);});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const response=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));return response.result?.value;};
 await page('Page.enable');await page('Runtime.enable');const {frameTree}=await page('Page.getFrameTree');
 const load=async scenario=>{await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html:html.replace("window.__scenario='ready'",`window.__scenario='${scenario}'`)});await evaluate("new Promise((resolve,reject)=>{let attempts=0;const poll=()=>{if(document.querySelector('h1')&&!document.body.textContent.includes('Loading verification'))return requestAnimationFrame(()=>requestAnimationFrame(resolve));if(++attempts>100)return reject(Error('Screen did not load'));setTimeout(poll,20);};poll();})");};
 await load('ready');
 for(const width of [320,390,768,1440]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const state=await evaluate(`({heading:document.querySelector('h1').textContent,files:document.querySelectorAll('input[type=file]').length,overflow:document.documentElement.scrollWidth>innerWidth+1,disabled:document.querySelector('.ccx-primary').disabled,errors:window.__errors})`);
  assert.equal(state.heading,'Identity and age verification');assert.equal(state.files,0);assert.equal(state.overflow,false);assert.equal(state.disabled,true);assert.deepEqual(state.errors,[]);
 }
 await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Sign out')).click();new Promise(r=>setTimeout(r,50))");assert.equal(await evaluate('window.__signout'),1);
 for(const scenario of ['disabled','collecting','age_restricted','name_mismatch','review_required','approved']){
  await load(scenario);assert.deepEqual(await evaluate('window.__errors'),[]);
  const files=await evaluate("document.querySelectorAll('input[type=file]').length");assert.equal(files,scenario==='collecting'?2:0);
  assert.equal(await evaluate('window.__approval'),scenario==='approved'?1:0);
  if(scenario==='disabled')assert.equal(await evaluate("document.body.textContent.includes('not available yet')"),true);
  if(scenario==='collecting')assert.equal(await evaluate("document.body.textContent.includes('Enable camera')"),true);
  if(scenario==='name_mismatch')assert.equal(await evaluate("document.querySelector('input')?.value"),'Synthetic Legal Name');
  if(scenario==='age_restricted')assert.equal(await evaluate("document.body.textContent.includes('under 18')"),true);
 }
 console.log('PASS 11 actual React identity browser scenarios: four viewport widths, sign-out, disabled, collecting, underage, legal-name mismatch, review and approved callback. No real identity data or provider calls.');
 await send('Browser.close');
}finally{
 socket?.close();if(browser&&browser.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},5000);browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();});
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}catch(error){if(!['ENOTEMPTY','EBUSY'].includes(error.code))throw error;console.warn('Temporary browser-profile cleanup deferred:',error.code);}
}
