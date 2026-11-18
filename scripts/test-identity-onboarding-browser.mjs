/** Actual React onboarding in Chromium. APIs are synthetic and all external HTTP
 * is blocked. This validates UI behavior, not OCR or biometric accuracy. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';
const chrome=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(p=>fs.existsSync(p));
assert.ok(chrome,'A real Chromium browser is required; do not silently skip.');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-identity-browser-'));
const results=[],pending=new Map();let browser,socket,sequence=0;
const session=(status='collecting',extra={})=>({id:'20000000-0000-4000-8000-000000000001',status,reason:status,message:'Complete your identity check.',document_type:'drivers_license',issuing_country:'US',legal_name:'Jordan Avery Example',expected_name:null,challenge_id:'30000000-0000-4000-8000-000000000001',directions:['left','right'],uploaded:{front:false,back:false,selfie:false,capture:false},expires_at:'2099-01-01T00:00:00Z',review_requested:false,...extra});
const state=(extra={})=>({enabled:true,policy:'ccx-idv-v2',email_confirmed:true,notice:'Synthetic test notice: no real documents, photographs, or identity data are sent by this isolated browser test.',notice_version:'synthetic-test-only',retention_days:1,supported_countries:['US'],legal_name:'Jordan Avery Example',admitted:false,session:null,...extra});
const mock=`export async function identityAction(action,values={}){
 window.__calls.push({action,values:structuredClone(values)});
 if(action==='status'){if(window.__fixture.error)throw Error(window.__fixture.error);return structuredClone(window.__fixture.response);}
 if(action==='start'){
  if(values.consent!==true||!values.legal_name||!values.notice_version)throw Error('Missing consent or legal name');
  window.__fixture.response.session=structuredClone(window.__fixture.newSession);
 }else if(action==='confirm_name'){
  if(window.__fixture.rejectName||values.legal_name!==window.__fixture.response.session.expected_name)throw Error('The server did not accept this legal name.');
  window.__fixture.response.session={...window.__fixture.response.session,status:'approved',message:'Verification complete'};
 }else if(action==='submit'){
  window.__fixture.response.session={...window.__fixture.response.session,status:'review_required',reason:'face_or_liveness_not_verified',message:'Your account remains restricted.'};
 }else if(action==='request_review'){window.__fixture.response.session.review_requested=true;
 }else if(action==='cancel'){window.__fixture.response.session.status='cancelled';
 }else throw Error('Unexpected fixture action: '+action);
 return {session:structuredClone(window.__fixture.response.session)};
}
export async function identityUpload(){window.__uploads++;throw Error('No real evidence uploads are allowed in this test');}`;
try{
 const fixturePath=path.join(folder,'source.html');await createControlFixture(fixturePath);
 const template=fs.readFileSync(fixturePath,'utf8');
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Gate from './src/supabase/AgeGateOnboarding.jsx';createRoot(document.getElementById('root')).render(<Gate onReload={()=>{window.__approval++;}} onSignOut={()=>{window.__signout++;}}/>);`,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-identity-apis',setup(b){
  b.onResolve({filter:/(?:^|\/)identityApi(?:\.js)?$/},()=>({path:'identity',namespace:'fixture'}));
  // Stub the other-brand compatibility import too: no real client in this fixture.
  b.onResolve({filter:/(?:^|\/)integrationApi(?:\.js)?$/},()=>({path:'legacy',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='identity'?mock:`export async function integrationAction(){throw Error('The Content Connect flow must not call Yoti');}`,loader:'js'}));
 }}]});
 browser=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chromium startup timed out')),20000);browser.once('error',e=>{clearTimeout(timer);reject(e);});browser.once('exit',code=>{clearTimeout(timer);reject(Error('Chromium exited: '+code));});browser.stderr.on('data',data=>{output+=data;const m=output.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const r=JSON.parse(event.data),entry=pending.get(r.id);if(!entry)return;pending.delete(r.id);clearTimeout(entry.timer);r.error?entry.reject(Error(JSON.stringify(r.error))):entry.resolve(r.result);});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 await page('Page.enable');await page('Runtime.enable');await page('Network.enable');await page('Network.setBlockedURLs',{urls:['http://*','https://*']});
 const wait=async(expression,label)=>{const end=Date.now()+5000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out: '+label+'; browser errors: '+JSON.stringify(await evaluate('window.__errors')));};
 const button=text=>`[...document.querySelectorAll('#root button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
 const click=async text=>{assert.equal(await evaluate(`Boolean(${button(text)})`),true,'Missing '+text);await wait(`!${button(text)}.disabled`,'enabled '+text);await evaluate(`${button(text)}.click()`);};
 const mount=async(response,options={},width=390)=>{
  await page('Page.navigate',{url:'about:blank'});
  await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  const setup=`window.__fixture=${JSON.stringify({response,newSession:session(),...options}).replace(/</g,'\\u003c')};window.__errors=[];window.__approval=0;window.__signout=0;window.__calls=[];window.__uploads=0;window.__network=0;window.addEventListener('error',e=>window.__errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));window.fetch=async()=>{window.__network++;throw Error('Unexpected network request');};Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw Error('Camera permission denied for test.');}}});`;
  const html=template.replace(/<body[\s\S]*<\/body>/,()=>`<body><div id="root"></div><script>${setup}</script><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body>`);
  const {frameTree}=await page('Page.getFrameTree');await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
  await wait(`document.querySelector('#root h1')&&window.__calls.some(c=>c.action==='status')`,'initial status');
  // body.textContent includes inline scripts containing all loading/error strings.
  // Assertions must inspect rendered application content, never bundled source.
  await wait(`!document.querySelector('#root').textContent.includes('Loading verification')||document.querySelector('#root [role=alert]')`,'settled state');
 };
 const record=async name=>{assert.deepEqual(await evaluate('window.__errors'),[],name);assert.equal(await evaluate('window.__network'),0);assert.equal(await evaluate('window.__uploads'),0);results.push({name,passed:true});};
 for(const width of [320,390,768,1440]){
  await mount(state(),{},width);assert.equal(await evaluate("document.querySelector('#root h1').textContent"),'Identity and age verification');
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false);assert.equal(await evaluate(`${button('Start verification')}.disabled`),true);assert.equal(await evaluate('window.__approval'),0);assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),0);await record('consent screen '+width+'px');
 }
 await evaluate("document.querySelector('#root input[type=checkbox]').click()");await wait(`!${button('Start verification')}.disabled`,'consented start');await click('Start verification');
 await wait("document.querySelectorAll('#root input[type=file]').length===2",'ID front/back');
 const start=await evaluate("window.__calls.find(c=>c.action==='start')");assert.equal(start.values.legal_name,'Jordan Avery Example');assert.equal(start.values.consent,true);assert.equal(start.values.notice_version,'synthetic-test-only');assert.equal('display_name' in start.values,false);assert.equal(await evaluate('window.__approval'),0);await record('consent and private legal name submitted without admission');
 await click('Enable camera');await wait("document.querySelector('#root [role=alert]')?.textContent.includes('Camera permission denied')",'camera denial');assert.equal(await evaluate('window.__approval'),0);await record('camera denial remains restricted');
 await mount(state({session:session('collecting',{document_type:'passport'})}));assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),1);await record('passport photo page only');
 await mount(state({enabled:false}));assert.equal(await evaluate("document.querySelector('#root').textContent.includes('No ID uploads are accepted')"),true);assert.equal(await evaluate(`Boolean(${button('Start verification')})`),false);assert.equal(await evaluate('window.__approval'),0);await record('disabled service blocks collection');
 await mount(state({email_confirmed:false}));await evaluate("document.querySelector('#root input[type=checkbox]').click()");assert.equal(await evaluate(`${button('Start verification')}.disabled`),true);await record('email confirmation required');
 await mount(state({session:session('collecting',{uploaded:{front:true,back:true,selfie:true,capture:true}})}));await click('Check my identity and age');await wait("document.querySelector('#root').textContent.includes('Your account remains restricted.')",'failed liveness');assert.equal(await evaluate('window.__approval'),0);await record('failed face or liveness cannot admit');
 for(const reason of ['under_18','birthday_wait']){
  await mount(state({session:session('age_restricted',{reason,eligible_on:'2099-01-02',message:'Access restricted until 2099-01-02 (UTC). '+reason})}));
  assert.equal(await evaluate(`Boolean(${button('Start verification')})`),false);assert.equal(await evaluate(`Boolean(${button('Check my identity and age')})`),false);assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),0);await click('Request a review');await wait("document.querySelector('#root').textContent.includes('Review requested')",'review requested');assert.equal(await evaluate('window.__approval'),0);await record(reason+' review does not bypass restriction');
 }
 const mismatch=()=>state({session:session('name_mismatch',{expected_name:'Jordan Avery Example',message:'Your public display name will not change.'})});
 await mount(mismatch(),{rejectName:true});await click('Update private legal name and finish');await wait("document.querySelector('#root [role=alert]')?.textContent.includes('server did not accept')",'rejected correction');assert.equal(await evaluate('window.__approval'),0);await record('name correction cannot override server rejection');
 await mount(mismatch());await click('Update private legal name and finish');await wait('window.__approval===1','accepted correction');const correction=await evaluate("window.__calls.find(c=>c.action==='confirm_name')");assert.equal(correction.values.legal_name,'Jordan Avery Example');assert.equal('display_name' in correction.values,false);await record('accepted private-name correction reloads admission');
 await mount(state({session:session('eligible_to_retry')}));assert.equal(await evaluate(`Boolean(${button('Start verification')})`),true);assert.equal(await evaluate('window.__approval'),0);await record('birthday eligibility requires a new check');
 await mount(state(),{error:'Verification status is unavailable.'});assert.equal(await evaluate("document.querySelector('#root [role=alert]').textContent"),'Verification status is unavailable.');assert.equal(await evaluate('window.__approval'),0);await record('status failure remains restricted');
 await mount(state({session:session('approved')}));await wait('window.__approval===1','approved callback');assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),0);await record('trusted approved status reloads admission');
 await click('Sign out and finish later');await wait('window.__signout===1','sign out');await record('sign out available');
 console.log(`PASS ${results.length} real React identity onboarding scenarios with synthetic API responses. No real ID, biometric accuracy or provider transaction was tested.`);
 if(process.env.IDENTITY_BROWSER_RESULTS_DIR){fs.mkdirSync(process.env.IDENTITY_BROWSER_RESULTS_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.IDENTITY_BROWSER_RESULTS_DIR,'identity-browser-results.json'),JSON.stringify({tests:results,realProviderCalls:false,modelAccuracyTested:false},null,2));}
 await send('Browser.close');
}finally{
 for(const item of pending.values())clearTimeout(item.timer);pending.clear();socket?.close();
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},5000);browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();});
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}catch(e){if(!['EBUSY','ENOTEMPTY'].includes(e.code))throw e;console.warn('Temporary browser profile cleanup deferred:',e.code);}
}
