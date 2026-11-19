/** Camera lifecycle primitives. No image is uploaded and no identity decision is
 * made here. Late permission grants must not leave a camera running after cancel.
 */
export const cameraAbort=()=>new DOMException('Camera capture cancelled.','AbortError');
export function stopTracks(stream){for(const track of stream?.getTracks?.()||[]){track.onended=null;track.stop();}}
export function cameraAccessIssue(nav=globalThis.navigator,doc=globalThis.document,secure=globalThis.isSecureContext){
 if(secure===false)return 'The live camera needs HTTPS. Open the published website in Safari or Chrome.';
 if(!nav?.mediaDevices?.getUserMedia)return 'This browser cannot open a live camera. Open the published website directly in Safari or Chrome, not an in-app browser.';
 const policy=doc?.permissionsPolicy||doc?.featurePolicy;
 if(policy?.allowsFeature&&!policy.allowsFeature('camera'))return 'Camera access is blocked in this embedded preview. Open the published website directly in a new browser tab.';
 return null;
}
export function cameraErrorMessage(error){
 if(error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError'||/permission denied/i.test(error?.message||''))return 'Camera permission denied. Allow camera access for this website in your browser settings, then tap Open selfie camera again.';
 if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return 'No camera was found. Use a phone or computer with a working front camera.';
 if(error?.name==='NotReadableError'||error?.name==='TrackStartError')return 'The camera is busy or unavailable. Close other camera apps or tabs, then try again.';
 if(error?.name==='OverconstrainedError')return 'The requested camera is unavailable. Try your default front camera in Safari or Chrome.';
 if(error?.name==='CameraPermissionTimeout')return 'Still waiting for camera permission. Check the browser permission prompt, allow camera access, then try again.';
 if(error?.name==='CameraPreviewTimeout')return 'The camera opened but its preview did not start. Close other camera apps and try again in Safari or Chrome.';
 if(error?.name==='AbortError')return 'Camera capture cancelled. Your saved ID photos have not been removed.';
 return 'The live camera could not start. Allow camera access and open the published website directly in Safari or Chrome.';
}
export function requestIdentityCamera({mediaDevices=globalThis.navigator?.mediaDevices,signal,timeoutMs=25000}={}){
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
  const fail=error=>{if(settled)return;settled=true;cleanup();reject(error);};
  const abort=()=>fail(cameraAbort());
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{const error=Error('Camera permission timed out');error.name='CameraPermissionTimeout';fail(error);},timeoutMs);
  try{
   // Called synchronously from the click handler; do not wait on another API first.
   const pending=mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480}}});
   Promise.resolve(pending).then(stream=>{
    if(settled){stopTracks(stream);return;}
    if(!stream?.getVideoTracks?.().some(track=>track.readyState==='live')){stopTracks(stream);fail(Error('No active video track'));return;}
    settled=true;cleanup();resolve(stream);
   },fail);
  }catch(error){fail(error);}
 });
}
export function playIdentityPreview(video,stream,{signal,timeoutMs=15000}={}){
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const events=['loadedmetadata','loadeddata','canplay','playing'];
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);for(const name of events)video?.removeEventListener(name,ready);video?.removeEventListener('error',failed);};
  const finish=error=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve();};
  const abort=()=>finish(cameraAbort());
  const failed=()=>finish(Error('Preview failed'));
  const ready=()=>{if(video.videoWidth>0&&video.videoHeight>0&&video.readyState>=2&&!video.paused)finish();};
  if(!video){finish(Error('Camera preview is unavailable'));return;}
  if(signal?.aborted){abort();return;}
  signal?.addEventListener('abort',abort,{once:true});
  for(const name of events)video.addEventListener(name,ready);
  video.addEventListener('error',failed);
  timer=setTimeout(()=>{const error=Error('Camera preview timed out');error.name='CameraPreviewTimeout';finish(error);},timeoutMs);
  try{
   video.muted=true;video.defaultMuted=true;video.playsInline=true;
   video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
   if(video.srcObject!==stream)video.srcObject=stream;
   // A rejected autoplay promise becomes an explicit tap-to-start action in UI.
   Promise.resolve(video.play()).then(ready,error=>finish(error));ready();
  }catch(error){finish(error);}
 });
}
export function cameraDelay(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(cameraAbort());return;}
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(cameraAbort());};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
}
