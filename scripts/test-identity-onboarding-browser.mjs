/** Real React onboarding in Chromium with synthetic APIs. No actual evidence,
 * network verification, camera capture, or model accuracy is tested here. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import {createControlFixture} from './control-layout-audit.mjs';
const chrome=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(p=>fs.existsSync(p));
assert.ok(chrome,'A real Chromium browser is required');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-idv-browser-'));
const results=[],pending=new Map();let browser,socket,sequence=0;
const session=(status='collecting',extra={})=>({id:'20000000-0000-4000-8000-000000000001',status,reason:status,message:'Complete your identity check.',document_type:'drivers_license',issuing_country:'US',legal_name:'Jordan Avery Example',expected_name:null,challenge_id:'30000000-0000-4000-8000-000000000001',directions:['left','right'],uploaded:{front:false,back:false,selfie:false,capture:false},expires_at:'2099-01-01T00:00:00Z',review_requested:false,...extra});
const state=(extra={})=>({enabled:true,policy:'ccx-idv-v2',email_confirmed:true,notice:'Synthetic notice: no actual documents or identity data are transmitted in this isolated browser regression.',notice_version:'synthetic-test-only',retention_days:1,supported_countries:['US'],legal_name:'Jordan Avery Example',admitted:false,session:null,...extra});
const mock=`export async function identityAction(action,values={}){
 window.__calls.push({action,values:structuredClone(values)});
 const f=window.__fixture;
 if(action==='status'){if(f.error)throw Error(f.error);return structuredClone(f.response);}
 if(action==='start'){
  if(values.consent!==true||!values.legal_name||!values.notice_version)throw Error('Missing consent');
  f.response.session=structuredClone(f.newSession);
 }else if(action==='confirm_name'){
  if(f.rejectName||values.legal_name!==f.response.session.expected_name)throw Error('The server did not accept this legal name.');
  f.response.session={...f.response.session,status:'approved',message:'Verification complete'};
 }else if(action==='submit')f.response.session={...f.response.session,status:'review_required',reason:'face_or_liveness_not_verified',message:'Your account remains restricted.'};
 else if(action==='request_review')f.response.session.review_requested=true;
 else if(action==='cancel')f.response.session.status='cancelled';
 else throw Error('Unexpected action: '+action);
 return {session:structuredClone(f.response.session)};
}
export async function identityUpload(id,kind,file,{onProgress=()=>{},signal}={}){
 window.__uploads++;
 if(!window.__fixture.allowUploads)throw Error('Actual uploads are forbidden in this test');
 window.__capturePayload=kind==='capture'?JSON.parse(await file.text()):null;
 onProgress({phase:'authorizing',percent:0});
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(new DOMException('Synthetic upload cancelled','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});
  window.__uploadKind=kind;window.__uploadProgress=onProgress;
  window.__finishUpload=()=>{
   signal?.removeEventListener('abort',abort);
   const s=window.__fixture.response.session;s.uploaded[kind]=true;if(kind==='capture')s.uploaded.selfie=true;
   onProgress({phase:'complete',percent:100});resolve({session:structuredClone(s)});
  };
  window.__failUpload=()=>{signal?.removeEventListener('abort',abort);reject(Error('Synthetic save failure'));};
 });
}`;
try{
 const fixturePath=path.join(folder,'source.html');await createControlFixture(fixturePath);
 const template=fs.readFileSync(fixturePath,'utf8');
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Gate from './src/supabase/AgeGateOnboarding.jsx';const root=createRoot(document.getElementById('root'));window.__unmountIdentity=()=>root.unmount();root.render(<Gate onReload={()=>window.__approval++} onSignOut={()=>window.__signout++}/>);`,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-api',setup(b){
  b.onResolve({filter:/(?:^|\/)identityApi(?:\.js)?$/},()=>({path:'identity',namespace:'fixture'}));
  // The compatibility component imports the other-brand API even on CCX.
  b.onResolve({filter:/(?:^|\/)integrationApi(?:\.js)?$/},()=>({path:'legacy',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='identity'?mock:`export async function integrationAction(){throw Error('CCX must not call Yoti');}`,loader:'js'}));
 }}]});
 browser=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chromium startup timed out')),20000);browser.once('error',e=>{clearTimeout(timer);reject(e);});browser.once('exit',code=>{clearTimeout(timer);reject(Error('Chromium exited: '+code));});browser.stderr.on('data',data=>{output+=data;const m=output.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const r=JSON.parse(event.data),e=pending.get(r.id);if(!e)return;pending.delete(r.id);clearTimeout(e.timer);r.error?e.reject(Error(JSON.stringify(r.error))):e.resolve(r.result);});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 await page('Page.enable');await page('Runtime.enable');await page('Network.enable');await page('Network.setBlockedURLs',{urls:['http://*','https://*']});
 // CDP cannot serialize React-attached DOM nodes. Every polling result is Boolean.
 const wait=async(expression,label,timeout=5000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out: '+label+'; errors '+JSON.stringify(await evaluate('window.__errors')));};
 const button=text=>`[...document.querySelectorAll('#root button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
 const click=async text=>{assert.equal(await evaluate(`Boolean(${button(text)})`),true,'Missing '+text);await wait(`!${button(text)}.disabled`,'enabled '+text);await evaluate(`${button(text)}.click()`);};
 const textIncludes=text=>`document.querySelector('#root').textContent.includes(${JSON.stringify(text)})`;
 const mount=async(response,options={},width=390)=>{
  await page('Page.navigate',{url:'about:blank'});
  await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  const setup=`window.__fixture=${JSON.stringify({response,newSession:session(),...options}).replace(/</g,'\\u003c')};window.__errors=[];window.__approval=0;window.__signout=0;window.__calls=[];window.__uploads=0;window.__network=0;window.addEventListener('error',e=>window.__errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));window.fetch=async()=>{window.__network++;throw Error('Unexpected network request');};window.__cameraMode='denied';window.__cameraCalls=0;window.__cameraPolicy=true;window.__tracks=[];
Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
Object.defineProperty(document,'permissionsPolicy',{configurable:true,value:{allowsFeature:()=>window.__cameraPolicy}});
window.__makeCameraStream=()=>{
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;let frame=0;
 const draw=()=>{const c=canvas.getContext('2d');c.fillStyle=frame++%2?'#374151':'#475569';c.fillRect(0,0,640,480);c.fillStyle='#fff';c.font='24px sans-serif';c.fillText('SYNTHETIC CAMERA TEST '+frame,20,150);};draw();
 const stream=canvas.captureStream(15),timer=setInterval(draw,100);
 for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};window.__tracks.push(track);}
 return stream;
};
const originalPlay=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=function(){if(window.__blockPlayOnce){window.__blockPlayOnce=false;return Promise.reject(new DOMException('Tap required','NotAllowedError'));}return originalPlay.call(this);};
Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>{
 window.__cameraCalls++;
 if(window.__cameraMode==='stream')return Promise.resolve(window.__makeCameraStream());
 if(window.__cameraMode==='pending')return new Promise(resolve=>{window.__grantCamera=()=>resolve(window.__makeCameraStream());});
 return Promise.reject(new DOMException('Synthetic permission denial','NotAllowedError'));
}}});`;
  const html=template.replace(/<body[\s\S]*<\/body>/,()=>`<body><div id="root"></div><script>${setup}</script><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body>`);
  const {frameTree}=await page('Page.getFrameTree');await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
  await wait(`document.querySelector('#root h1')&&window.__calls.some(c=>c.action==='status')`,'initial status');
  // Never inspect body.textContent: it includes inline bundled script source.
  await wait(`!${textIncludes('Loading verification')}||document.querySelector('#root [role=alert]')`,'settled state');
 };
 const record=async(name,expectedUploads=0)=>{assert.deepEqual(await evaluate('window.__errors'),[],name);assert.equal(await evaluate('window.__network'),0);assert.equal(await evaluate('window.__uploads'),expectedUploads);results.push({name,passed:true});console.log('PASS '+name);};
 for(const width of [320,390,768,1440]){
  await mount(state(),{},width);assert.equal(await evaluate("document.querySelector('#root h1').textContent"),'Identity and age verification');
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false);assert.equal(await evaluate(`${button('Start verification')}.disabled`),true);assert.equal(await evaluate('window.__approval'),0);assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),0);await record('consent screen '+width+'px');
 }
 await evaluate("document.querySelector('#root input[type=checkbox]').click()");await wait(`!${button('Start verification')}.disabled`,'consented start');await click('Start verification');
 await wait("document.querySelectorAll('#root input[type=file]').length===2",'ID front/back');
 const start=await evaluate("window.__calls.find(c=>c.action==='start')");assert.equal(start.values.legal_name,'Jordan Avery Example');assert.equal(start.values.consent,true);assert.equal(start.values.notice_version,'synthetic-test-only');assert.equal('display_name' in start.values,false);assert.equal(await evaluate('window.__approval'),0);await record('consent and private legal name submitted without admission');
 await click('Open selfie camera');await wait(textIncludes('Camera permission denied'),'camera denial');assert.equal(await evaluate('window.__approval'),0);await record('camera denial remains restricted');
 await mount(state({session:session('collecting',{document_type:'passport'})}));assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),1);await record('passport photo page only');
 await mount(state({enabled:false}));assert.equal(await evaluate(textIncludes('No ID uploads are accepted')),true);assert.equal(await evaluate(`Boolean(${button('Start verification')})`),false);assert.equal(await evaluate('window.__approval'),0);await record('disabled service blocks collection');
 await mount(state({email_confirmed:false}));await evaluate("document.querySelector('#root input[type=checkbox]').click()");assert.equal(await evaluate(`${button('Start verification')}.disabled`),true);await record('email confirmation required');
 await mount(state({session:session('collecting',{uploaded:{front:true,back:true,selfie:true,capture:true}})}));await click('Check my identity and age');await wait(textIncludes('Your account remains restricted.'),'failed liveness');assert.equal(await evaluate('window.__approval'),0);await record('failed face or liveness cannot admit');
 for(const reason of ['under_18','birthday_wait']){
  await mount(state({session:session('age_restricted',{reason,eligible_on:'2099-01-02',message:'Access restricted until 2099-01-02 (UTC). '+reason})}));
  assert.equal(await evaluate(`Boolean(${button('Start verification')})`),false);assert.equal(await evaluate(`Boolean(${button('Check my identity and age')})`),false);assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),0);await click('Request a review');await wait(textIncludes('Review requested'),'review requested');assert.equal(await evaluate('window.__approval'),0);await record(reason+' review cannot bypass restriction');
 }
 const mismatch=()=>state({session:session('name_mismatch',{expected_name:'Jordan Avery Example',message:'Your public display name will not change.'})});
 await mount(mismatch(),{rejectName:true});await click('Update private legal name and finish');await wait(textIncludes('server did not accept'),'rejected correction');assert.equal(await evaluate('window.__approval'),0);await record('name correction cannot override server rejection');
 await mount(mismatch());await click('Update private legal name and finish');await wait('window.__approval===1','accepted correction');const correction=await evaluate("window.__calls.find(c=>c.action==='confirm_name')");assert.equal(correction.values.legal_name,'Jordan Avery Example');assert.equal('display_name' in correction.values,false);await record('accepted private-name correction reloads admission');
 await mount(state({session:session('eligible_to_retry')}));assert.equal(await evaluate(`Boolean(${button('Start verification')})`),true);assert.equal(await evaluate('window.__approval'),0);await record('birthday eligibility requires new check');
 await mount(state(),{error:'Verification status is unavailable.'});assert.equal(await evaluate("document.querySelector('#root [role=alert]').textContent"),'Verification status is unavailable.');assert.equal(await evaluate('window.__approval'),0);await record('status failure remains restricted');
 await mount(state({session:session('approved')}));await wait('window.__approval===1','approved callback');assert.equal(await evaluate("document.querySelectorAll('#root input[type=file]').length"),0);await record('trusted approved status reloads admission');
 await click('Sign out and finish later');await wait('window.__signout===1','sign out');await record('sign out available');

 // Actual React UI, synthetic images/API receipts, and actual playable canvas
 // MediaStreams. These tests never open a person's camera or contact Supabase.
 await mount(state({session:session()}),{allowUploads:true});
 assert.equal(await evaluate("document.querySelectorAll('[data-identity-document] button').length"),2);
 assert.equal(await evaluate("[...document.querySelectorAll('[data-identity-document] button')].every(b=>b.textContent.trim()==='Take photo'&&b.querySelector('svg'))"),true);
 assert.equal(await evaluate("[...document.querySelectorAll('[data-identity-document] input')].every(i=>i.hidden&&i.getAttribute('capture')==='environment')"),true);
 const choose=async kind=>{
  await evaluate("(()=>{const input=document.querySelector('[data-identity-document=\""+kind+"\"] input');const files=new DataTransfer();files.items.add(new File(['SYNTHETIC PHOTO, NOT AN ID'],'fixture.jpg',{type:'image/jpeg'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await wait("window.__uploadKind==="+JSON.stringify(kind),'photo queued');
 };
 await choose('front');
 await wait("document.querySelector('[data-identity-document=front] progress')?.value===0",'initial upload 0%');
 await evaluate("window.__uploadProgress({phase:'uploading',percent:25})");
 await wait(textIncludes('25% uploaded'),'visible upload 25%');
 await evaluate("window.__uploadProgress({phase:'saving',percent:100})");
 await wait(textIncludes('Saving securely'),'saving phase');
 assert.equal(await evaluate("document.querySelector('[data-identity-document=front]').textContent.includes('Saved privately')"),false);
 assert.equal(await evaluate("document.querySelector('[data-upload-phase=saving] progress').value"),100);
 await record('Take photo labels and measured 0–100% stay distinct from server save',1);
 await evaluate('window.__finishUpload()');await wait(textIncludes('Saved privately'),'confirmed front save');
 await choose('back');await evaluate('window.__failUpload()');await wait(textIncludes('Save not confirmed'),'failed save visible');
 assert.equal(await evaluate("document.querySelector('[data-identity-document=back]').textContent.includes('Saved privately')"),false);
 assert.equal(await evaluate("document.querySelector('[data-identity-document=front]').textContent.includes('Saved privately')"),true);
 await record('failed back upload preserves confirmed front and never shows false success',2);
 // Start a fresh synthetic component for the complete camera path.
 await mount(state({session:session('collecting',{uploaded:{front:true,back:true,selfie:false,capture:false}})}),{allowUploads:true});
 await evaluate("window.__cameraMode='stream'");
 assert.equal(await evaluate("Boolean(document.querySelector('video'))"),true,'Preview is mounted before the gesture');
 await click('Open selfie camera');await wait("Boolean("+button('Start head-turn capture')+")",'playable selfie camera');
 assert.equal(await evaluate("(()=>{const v=document.querySelector('video');return v.videoWidth>0&&!v.paused&&v.muted&&v.playsInline&&v.getBoundingClientRect().width>0;})()"),true);
 await record('cached camera permission opens a real inline video preview');
 assert.equal(await evaluate("document.querySelector('[data-capture-instructions]').textContent.includes('hold for three seconds')"),true);
 await click('Start head-turn capture');
 await wait("document.querySelector('[data-identity-countdown]')?.textContent==='3'",'visible 3–2–1 countdown');
 await wait("document.querySelector('[data-identity-countdown]')?.textContent==='2'",'visible second countdown step');
 await wait("document.querySelector('[data-identity-countdown]')?.textContent==='1'",'visible final countdown step');
 await wait("window.__uploadKind==='capture'",'complete two-turn live capture',30000);
 const capture=await evaluate('window.__capturePayload');
 assert.deepEqual(capture.frames.map(f=>f.phase),['turn1_start','turn1_peak','turn1_return','turn_start','turn_peak','turn_return']);
 assert.ok(capture.end_timestamp-capture.start_timestamp>=16000);assert.equal(capture.challenge_id,session().challenge_id);
 assert.equal(await evaluate("window.__tracks.every(t=>t.readyState==='ended')"),true,'Hardware released before upload');
 await evaluate("window.__uploadProgress({phase:'uploading',percent:50})");await wait(textIncludes('50% uploaded'),'capture upload progress');
 await evaluate('window.__finishUpload()');await wait(textIncludes('Your live capture is saved privately.'),'live capture saved');
 assert.equal(await evaluate('window.__approval'),0);await record('two real timed turns save a bound capture, never an account approval',1);
 await mount(state({session:session()}));await evaluate("window.__cameraMode='pending'");await click('Open selfie camera');
 await wait(textIncludes('Requesting camera permission'),'pending permission feedback');await click('Cancel camera request');
 await wait("Boolean("+button('Open selfie camera')+")",'cancel returns to retry');
 await evaluate('window.__grantCamera()');await wait("window.__tracks.length>0&&window.__tracks.every(t=>t.readyState==='ended')",'late stream closed');
 await record('cancelled permission request cannot open a late camera');
 await mount(state({session:session()}));await evaluate("window.__cameraMode='stream';window.__blockPlayOnce=true");await click('Open selfie camera');
 await wait("Boolean("+button('Start camera preview')+")",'gesture fallback visible');await click('Start camera preview');
 await wait("Boolean("+button('Start head-turn capture')+")",'tap resumes preview');assert.equal(await evaluate('window.__cameraCalls'),1);
 await click('Stop camera');await wait("window.__tracks.every(t=>t.readyState==='ended')",'stop releases hardware');
 await record('autoplay rejection offers a working tap-to-start preview');
 await mount(state({session:session()}));await evaluate('window.__cameraPolicy=false');await click('Open selfie camera');
 await wait(textIncludes('embedded preview'),'camera-policy guidance');assert.equal(await evaluate('window.__cameraCalls'),0);await record('embedding policy failure is visible, not a dead button');
 await mount(state({session:session()}));await evaluate("window.__cameraMode='stream'");await click('Open selfie camera');
 await wait("Boolean("+button('Start head-turn capture')+")",'camera before unmount');await evaluate('window.__unmountIdentity()');
 await wait("window.__tracks.every(t=>t.readyState==='ended')",'unmount releases camera');await record('leaving the verification screen releases the camera');

 console.log(`PASS ${results.length} real React scenarios with synthetic API responses. Synthetic camera streams and API responses only; no physical phone, real ID, biometric accuracy or provider transaction was tested.`);
 if(process.env.IDENTITY_BROWSER_RESULTS_DIR){fs.mkdirSync(process.env.IDENTITY_BROWSER_RESULTS_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.IDENTITY_BROWSER_RESULTS_DIR,'identity-browser-results.json'),JSON.stringify({tests:results,realProviderCalls:false,modelAccuracyTested:false},null,2));}
 await send('Browser.close');
}finally{
 for(const item of pending.values())clearTimeout(item.timer);pending.clear();socket?.close();
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},5000);browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();});
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}catch(e){if(!['EBUSY','ENOTEMPTY'].includes(e.code))throw e;console.warn('Temporary browser profile cleanup deferred:',e.code);}
}
