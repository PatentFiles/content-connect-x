import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'fix/identity-mobile-camera-progress');
const path='scripts/test-identity-onboarding-browser.mjs';
let source=fs.readFileSync(path,'utf8');
assert.equal(createHash('sha1').update('blob '+Buffer.byteLength(source)+'\0'+source).digest('hex'),'349b2a15796543b7536b0a2498730800f03ab045','Review concurrent test changes before applying');
const replace=(before,after)=>{assert.ok(source.includes(before),'Missing expected test fragment: '+before.slice(0,90));source=source.replace(before,after);};
replace("await click('Enable camera')","await click('Open selfie camera')");
replace("const wait=async(expression,label)=>{const end=Date.now()+5000;","const wait=async(expression,label,timeout=5000)=>{const end=Date.now()+timeout;");
replace("const record=async name=>{","const record=async(name,expectedUploads=0)=>{");
replace("assert.equal(await evaluate('window.__uploads'),0);results.push", "assert.equal(await evaluate('window.__uploads'),expectedUploads);results.push");
replace("createRoot(document.getElementById('root')).render(<Gate", "const root=createRoot(document.getElementById('root'));window.__unmountIdentity=()=>root.unmount();root.render(<Gate");
replace("export async function identityUpload(){window.__uploads++;throw Error('Actual uploads are forbidden in this test');}",String.raw`export async function identityUpload(id,kind,file,{onProgress=()=>{},signal}={}){
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
}`);
const oldCamera="Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw Error('Camera permission denied for test.');}}});";
const newCamera=String.raw`window.__cameraMode='denied';window.__cameraCalls=0;window.__cameraPolicy=true;window.__tracks=[];
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
replace(oldCamera,newCamera);
const extra=String.raw`
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
 await click('Start head-turn capture');
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
`;
replace(' console.log(`PASS ${results.length} real React scenarios',extra+'\n console.log(`PASS ${results.length} real React scenarios');
source=source.replace('No real ID, biometric accuracy or provider transaction was tested.','Synthetic camera streams and API responses only; no physical phone, real ID, biometric accuracy or provider transaction was tested.');
fs.writeFileSync(path,source);
const note=`\n## Mobile identity capture feedback — November 18, 2026\n\nThe shared signup/private-test capture screen uses explicit **Take photo** buttons with camera icons and the existing rear-camera file capture. Upload progress measures browser-transferred bytes from 0–100%; it never runs a fabricated timer. A distinct **Saving securely** state remains until the server returns the matching session/evidence receipt. Network/timeout errors do not claim a private save. Both identity endpoints retain their existing server authentication and private-storage path.\n\nThe live selfie video is mounted before permission is requested and waits for actual playable frames. Opening/permission states, bounded timeouts, an autoplay gesture fallback, contextual errors and cancellation are visible. Late permission grants, unmounts and interrupted captures release camera tracks. The existing server-bound six-frame/two-turn challenge is unchanged: a file upload cannot replace liveness. Public hero designs, logged-out styling, admission, names, birthday policy, evidence retention and infrastructure are unchanged.\n\nRegression tests use synthetic files, controlled API receipts, and playable canvas MediaStreams in Chromium. They do not establish physical iPhone/Android compatibility or biometric accuracy. Publish the tested GitHub main revision through the existing Bolt website, then retest on the actual phone.\n`;
fs.appendFileSync('README.md',note);
fs.writeFileSync('docs/IDENTITY_MOBILE_CAPTURE.md','# Mobile identity capture repair\n'+note);
// One-time branch-only tooling must not remain in the final application tree.
fs.unlinkSync('scripts/repair-mobile-identity-once.mjs');
fs.unlinkSync('.github/workflows/mobile-identity-repair-once.yml');
console.log('Installed real-component camera/progress regressions and documentation. No backend, public styles, or uploaded evidence changed.');
