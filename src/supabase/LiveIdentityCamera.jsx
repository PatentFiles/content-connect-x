/** Real live capture only: a saved selfie never replaces the head-turn evidence.
 * Keep the video mounted before requesting permission, wait for actual playable
 * frames (not a zero-delay React render guess), and stop every camera on cleanup.
 */
import React,{useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {headTurnPlan,runHeadTurnSequence} from './identityCaptureSequence.mjs';
import {Camera,Loader2} from 'lucide-react';
import {cameraAccessIssue,cameraErrorMessage,requestIdentityCamera,playIdentityPreview,stopTracks,cameraDelay} from './identityCamera.mjs';
/** @param {{session: any, disabled?: boolean, onCapture: (file: File) => Promise<void>, onBusyChange?: (busy: boolean) => void}} props */
export default function LiveIdentityCamera({session,disabled=false,onCapture,onBusyChange=()=>{}}){
 const [phase,setPhase]=useState('idle'),[instruction,setInstruction]=useState(''),[error,setError]=useState('');
 const [countdown,setCountdown]=useState(null);
 const video=useRef(null),media=useRef(null),controller=useRef(null),epoch=useRef(0),alive=useRef(true);
 const callbacks=useRef({onCapture,onBusyChange});callbacks.current={onCapture,onBusyChange};
 const release=()=>{
  epoch.current++;controller.current?.abort();controller.current=null;stopTracks(media.current);media.current=null;
  if(video.current){video.current.pause();video.current.srcObject=null;}
 };
 const close=()=>{release();if(alive.current){setPhase('idle');setInstruction('');setCountdown(null);}};
 useEffect(()=>{
  alive.current=true;
  const leave=()=>{if(media.current){close();setError('The camera stopped when you left this page. Your ID photos are still saved. Open the selfie camera again.');}};
  const visibility=()=>{if(document.visibilityState==='hidden')leave();};
  window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',visibility);
  return()=>{alive.current=false;release();callbacks.current.onBusyChange(false);window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 useEffect(()=>{callbacks.current.onBusyChange(!['idle','error'].includes(phase));},[phase]);
 const current=run=>alive.current&&epoch.current===run;
 const preview=async run=>{
  try{
   await playIdentityPreview(video.current,media.current,{signal:controller.current?.signal});
   if(current(run)){setPhase('ready');setInstruction('Your selfie camera is ready. Keep your whole face visible, remove sunglasses, and use even lighting.');}
  }catch(issue){
   if(!current(run))return;
   if(issue.name==='NotAllowedError'){
    setPhase('playback_required');setInstruction('Your camera is connected. Tap Start camera preview below to show it.');
   }else{release();setPhase('error');setError(cameraErrorMessage(issue));setInstruction('');}
  }
 };
 const open=async()=>{
  if(disabled)return;release();
  const issue=cameraAccessIssue();
  if(issue){setError(issue);setPhase('error');return;}
  const run=++epoch.current;controller.current=new AbortController();
  // Flush only this user gesture so the existing <video> is visibly ready even
  // when a cached permission resolves before React would otherwise commit.
  flushSync(()=>{setError('');setPhase('requesting');setInstruction('Requesting camera permission. Tap Allow if your browser asks.');});
  try{
   const stream=await requestIdentityCamera({signal:controller.current.signal});
   if(!current(run)){stopTracks(stream);return;}
   media.current=stream;
   for(const track of stream.getVideoTracks())track.onended=()=>{
    if(current(run)){release();setPhase('error');setInstruction('');setError('The camera connection stopped. Close other camera apps and open the selfie camera again.');}
   };
   setPhase('starting');setInstruction('Opening your selfie preview…');await preview(run);
  }catch(error){if(current(run)){release();setPhase('error');setInstruction('');setError(cameraErrorMessage(error));}}
 };
 const resume=()=>{if(disabled)return;setPhase('starting');void preview(epoch.current);};
 const capture=async()=>{
  if(disabled||phase!=='ready'||!media.current)return;
  const run=epoch.current,signal=controller.current.signal;
  setError('');setPhase('capturing');
  const frame=phase=>{
   const source=video.current;
   if(!current(run)||!source?.videoWidth||source.readyState<2)throw Error('The camera stopped.');
   const canvas=document.createElement('canvas'),ratio=Math.min(640/source.videoWidth,640/source.videoHeight,1);
   canvas.width=Math.round(source.videoWidth*ratio);canvas.height=Math.round(source.videoHeight*ratio);
   canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
   const frame_base64=canvas.toDataURL('image/jpeg',0.78).split(',')[1];
   if(frame_base64.length>200000)throw Error('The camera frame is too large. Try again in even lighting.');
   return {phase,timestamp:performance.now(),frame_base64};
  };
  try{
   const sequence=await runHeadTurnSequence({directions:session.directions,signal,frame,delay:cameraDelay,onCue:cue=>{if(current(run)){setInstruction(cue.text);setCountdown(cue.countdown);}}});
   const payload={challenge_id:session.challenge_id,challenge_type:'head_turn',directions:session.directions,...sequence};
   setCountdown(null);
   // Release the hardware immediately after capture, before a slow upload.
   stopTracks(media.current);media.current=null;if(video.current){video.current.pause();video.current.srcObject=null;}
   setPhase('uploading');setInstruction('Uploading your live capture. See its progress below.');
   await callbacks.current.onCapture(new File([JSON.stringify(payload)],'capture.json',{type:'application/json'}));
   if(current(run)){release();setPhase('idle');setInstruction('');}
  }catch(issue){if(current(run)){release();setPhase('error');setInstruction('');setError(issue.name==='AbortError'?cameraErrorMessage(issue):'The live capture could not be completed or saved. Check status before retrying; your saved ID photos have not been removed.');}}
 };
 const opening=['requesting','starting'].includes(phase),showPreview=!['idle','error','uploading'].includes(phase);
 const embedded=typeof window!=='undefined'&&window.self!==window.top;
 return <div className="rounded-xl border p-4" data-identity-camera="true">
  <h2 className="font-semibold">Live camera check</h2>
  <p className="mt-2 text-sm leading-6">Open your front camera here, then follow two head-turn instructions. A photo upload is not accepted as a live selfie.</p>
  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-900" data-capture-instructions="true">
   <p className="font-semibold">Before you start</p>
   <p>Keep the phone still, your whole face in view, and both eyes visible. A 3–2–1 countdown comes before the first picture. Follow these two movements:</p>
   <ol className="mt-2 list-decimal space-y-1 pl-5">{headTurnPlan(session.directions).map(item=><li key={item.step}>{item.instruction}</li>)}</ol>
   <p className="mt-2">Turn gently, not to a full side profile. Wait for the on-screen instruction before looking back.</p>
  </div>
  <div hidden={!showPreview} className="mt-3 overflow-hidden rounded-xl bg-slate-900">
   <video ref={video} autoPlay playsInline muted aria-label="Live camera preview" className="aspect-[4/3] w-full -scale-x-100 object-contain"/>
  </div>
  {phase==='capturing'&&countdown!==null&&<div data-identity-countdown="true" className="mt-3 text-center text-5xl font-bold tabular-nums" aria-label={String(countdown)+' seconds remaining'}>{countdown}</div>}
  {instruction&&<p role="status" aria-live="polite" className="mt-3 flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-900">{(opening||phase==='uploading')&&<Loader2 size={18} className="mt-0.5 shrink-0 animate-spin" aria-hidden="true"/>}<span>{instruction}</span></p>}
  {error&&<div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}{embedded&&<a href={window.location.href} target="_blank" rel="noopener noreferrer" className="mt-2 block underline">Open this page in a new tab</a>}</div>}
  {['idle','error'].includes(phase)&&<button type="button" disabled={disabled} onClick={open} className="ccx-secondary mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3"><Camera size={18} aria-hidden="true"/>Open selfie camera</button>}
  {phase==='playback_required'&&<button type="button" disabled={disabled} onClick={resume} className="ccx-primary mt-3 min-h-11 w-full rounded-xl px-4 py-3">Start camera preview</button>}
  {phase==='ready'&&<button type="button" disabled={disabled} onClick={capture} className="ccx-primary mt-3 min-h-11 w-full rounded-xl px-4 py-3">Start head-turn capture</button>}
  {showPreview&&<button type="button" onClick={close} className="mt-2 min-h-11 w-full text-sm">{opening?'Cancel camera request':'Stop camera'}</button>}
 </div>;
}
