import test from 'node:test';
import assert from 'node:assert/strict';
import {transferIdentityEvidence} from '../src/supabase/identityTransfer.mjs';
import {requestIdentityCamera,playIdentityPreview,cameraAccessIssue,cameraErrorMessage,cameraDelay} from '../src/supabase/identityCamera.mjs';
const sid='20000000-0000-4000-8000-000000000001';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Xhr{
 constructor(){this.upload={};this.headers={};this.status=200;this.aborted=false;}
 open(method,url){this.method=method;this.url=url;this.responseURL=url;}
 setRequestHeader(name,value){this.headers[name]=value;}
 send(body){this.body=body;}
 abort(){this.aborted=true;this.onabort?.();}
 progress(loaded,total,known=true){this.upload.onprogress({loaded,total,lengthComputable:known});}
 respond(body,status=200){this.status=status;this.responseText=typeof body==='string'?body:JSON.stringify(body);this.onload?.();}
}
function upload(options={}){
 const xhr=new Xhr(),events=[];
 const config={projectUrl:'https://yxuqbygykpfbioslljlf.supabase.co',publicKey:'sb_publishable_fixture_only',getSession:async()=>({data:{session:{access_token:'fixture-user-token'}}}),endpoint:'identity-pilot',sessionId:sid,kind:'front',file:new Blob(['synthetic-image-only'],{type:'image/jpeg'}),onProgress:e=>events.push(e),timeoutMs:1000,xhrFactory:()=>xhr,...options};
 return {xhr,events,promise:transferIdentityEvidence(config)};
}
const receipt=(kind='front')=>({test_only:true,admission_granted:false,session:{id:sid,uploaded:{[kind]:true,...(kind==='capture'?{selfie:true}:{})}}});
test('measures 0-100 upload bytes; 100% transfer is not a confirmed private save',async()=>{
 const {xhr,events,promise}=upload();await tick();
 assert.equal(xhr.method,'POST');assert.equal(xhr.headers.Authorization,'Bearer fixture-user-token');assert.equal(xhr.headers.apikey,'sb_publishable_fixture_only');assert.equal('Content-Type' in xhr.headers,false);
 assert.equal(xhr.body.get('session_id'),sid);assert.equal(xhr.body.get('kind'),'front');
 xhr.progress(25,100);assert.deepEqual(events.at(-1),{phase:'uploading',percent:25});
 await new Promise(r=>setTimeout(r,10));assert.equal(events.at(-1).percent,25,'No timer-based progress');
 xhr.progress(75,100);xhr.progress(50,100);assert.equal(events.at(-1).percent,75,'Never move backwards');
 xhr.progress(100,100);xhr.upload.onload();assert.deepEqual(events.at(-1),{phase:'saving',percent:100});
 let done=false;promise.then(()=>{done=true;});await tick();assert.equal(done,false);assert.equal(events.some(e=>e.phase==='complete'),false);
 xhr.respond(receipt());await promise;assert.deepEqual(events.at(-1),{phase:'complete',percent:100});
});
test('unknown transfer length is indeterminate, not a fabricated percentage',async()=>{
 const {xhr,events,promise}=upload();await tick();xhr.progress(100,0,false);assert.equal(events.at(-1).percent,null);xhr.respond(receipt());await promise;
});
for(const [name,body,status] of [
 ['server error',{error:'Evidence could not be saved'},500],
 ['missing evidence receipt',{test_only:true,admission_granted:false,session:{id:sid,uploaded:{front:false}}},200],
 ['different session',{...receipt(),session:{id:'wrong',uploaded:{front:true}}},200],
 ['pilot cannot grant admission',{...receipt(),admission_granted:true},200],
 ['not JSON','<html>failure</html>',502]
])test('does not show completion after '+name,async()=>{
 const {xhr,events,promise}=upload();await tick();xhr.upload.onload();xhr.respond(body,status);await assert.rejects(promise);assert.equal(events.some(e=>e.phase==='complete'),false);
});
test('capture receipt requires its separately saved selfie',async()=>{
 const {xhr,promise}=upload({kind:'capture'});await tick();xhr.respond({test_only:true,admission_granted:false,session:{id:sid,uploaded:{capture:true}}});await assert.rejects(promise,/did not confirm/);
});
test('network failure terminates progress without claiming success',async()=>{
 const {xhr,promise,events}=upload();await tick();xhr.onerror();await assert.rejects(promise,/connection was interrupted/);assert.equal(events.some(e=>e.phase==='complete'),false);
});
test('abort stops the transport; a late response cannot complete it',async()=>{
 const controller=new AbortController();const {xhr,promise,events}=upload({signal:controller.signal});await tick();controller.abort();await assert.rejects(promise,{name:'AbortError'});xhr.respond(receipt());assert.equal(xhr.aborted,true);assert.equal(events.some(e=>e.phase==='complete'),false);
});
test('timeout bounds even a stuck session refresh and never starts a late upload',async()=>{
 let release;const {xhr,promise}=upload({timeoutMs:5,getSession:()=>new Promise(resolve=>{release=resolve;})});await assert.rejects(promise,/timed out/);release({data:{session:{access_token:'late'}}});await tick();assert.equal(xhr.body,undefined);
});
test('invalid target and signed-out session never transmit an image',async()=>{
 for(const options of [{endpoint:'arbitrary-function'},{projectUrl:'https://untrusted.example/'},{getSession:async()=>({data:{session:null}})}]){
  const {xhr,promise}=upload(options);await assert.rejects(promise);assert.equal(xhr.body,undefined);
 }
});
test('successful-looking redirect response cannot confirm a save',async()=>{
 const {xhr,promise}=upload();await tick();xhr.responseURL='https://untrusted.example';xhr.respond(receipt());await assert.rejects(promise,/Unexpected upload response/);
});
function stream(){const track={readyState:'live',stops:0,stop(){this.readyState='ended';this.stops++;}};return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};}
test('requests the front camera without microphone access',async()=>{
 const media=stream();let constraints;
 assert.equal(await requestIdentityCamera({mediaDevices:{getUserMedia:c=>{constraints=c;return Promise.resolve(media);}}}),media);
 assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'user');media.track.stop();
});
test('cancelling a permission prompt stops any subsequently granted stream',async()=>{
 let grant;const controller=new AbortController();const promise=requestIdentityCamera({signal:controller.signal,mediaDevices:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}});
 controller.abort();await assert.rejects(promise,{name:'AbortError'});const media=stream();grant(media);await tick();assert.equal(media.track.readyState,'ended');
});
test('ignored permission prompt times out, and late grant is released',async()=>{
 let grant;const promise=requestIdentityCamera({timeoutMs:5,mediaDevices:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}});
 await assert.rejects(promise,{name:'CameraPermissionTimeout'});const media=stream();grant(media);await tick();assert.equal(media.track.stops,1);
});
test('permission denial is surfaced with actionable wording',async()=>{
 const issue=new DOMException('denied','NotAllowedError');await assert.rejects(requestIdentityCamera({mediaDevices:{getUserMedia:()=>Promise.reject(issue)}}),{name:'NotAllowedError'});assert.match(cameraErrorMessage(issue),/Camera permission denied/);
});
class Video extends EventTarget{
 constructor(){super();this.videoWidth=0;this.videoHeight=0;this.readyState=0;this.paused=true;this.attributes={};}
 setAttribute(k,v){this.attributes[k]=v;}
 play(){return Promise.resolve();}
 ready(){this.videoWidth=640;this.videoHeight=480;this.readyState=2;this.paused=false;this.dispatchEvent(new Event('playing'));}
}
test('preview waits for actual dimensions and playback, and configures mobile inline video',async()=>{
 const video=new Video(),media=stream();let done=false;const promise=playIdentityPreview(video,media).then(()=>{done=true;});await tick();assert.equal(done,false);assert.equal(video.srcObject,media);assert.equal(video.muted,true);assert.equal(video.defaultMuted,true);assert.equal(video.playsInline,true);assert.equal('webkit-playsinline' in video.attributes,true);video.ready();await promise;
});
test('autoplay denial preserves a distinguishable error for the tap-to-start UI',async()=>{
 const video=new Video();video.play=()=>Promise.reject(new DOMException('gesture required','NotAllowedError'));await assert.rejects(playIdentityPreview(video,stream()),{name:'NotAllowedError'});
});
test('preview timeout and abort cannot leave a forever-pending button',async()=>{
 await assert.rejects(playIdentityPreview(new Video(),stream(),{timeoutMs:5}),{name:'CameraPreviewTimeout'});
 const controller=new AbortController(),promise=playIdentityPreview(new Video(),stream(),{signal:controller.signal});controller.abort();await assert.rejects(promise,{name:'AbortError'});
});
test('camera context distinguishes unsupported, insecure and embedding-policy failures',()=>{
 assert.match(cameraAccessIssue({},null,true),/browser cannot/);assert.match(cameraAccessIssue({},null,false),/HTTPS/);
 const nav={mediaDevices:{getUserMedia(){}}};assert.match(cameraAccessIssue(nav,{permissionsPolicy:{allowsFeature:()=>false}},true),/embedded preview/);assert.equal(cameraAccessIssue(nav,{},true),null);
});
test('cancelling a head turn interrupts its delay immediately',async()=>{
 const controller=new AbortController(),promise=cameraDelay(10000,controller.signal);controller.abort();await assert.rejects(promise,{name:'AbortError'});
});


test('production capture requires revision and transmits it with the evidence receipt',async()=>{
 const {xhr,promise}=upload({endpoint:'identity-verification',evidenceRevision:2});
 await tick();
 assert.equal(xhr.body.get('evidence_revision'),'2');
 xhr.respond({session:{id:sid,evidence_revision:2,uploaded:{front:true}}});
 await promise;
});
test('production capture without revision never sends evidence',async()=>{
 const {xhr,promise}=upload({endpoint:'identity-verification'});
 await assert.rejects(promise,/Refresh your verification session/);
 assert.equal(xhr.body,undefined);
});
