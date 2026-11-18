/** Mandatory signup capture. The server, never this component, grants membership. */
import React,{useEffect,useRef,useState} from 'react';
import {Camera,CheckCircle2,RefreshCw,ShieldCheck} from 'lucide-react';
import {identityAction,identityUpload} from './identityApi';
const field='mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900';
export default function IdentityVerification({onApproval=()=>{},onboarding=false}){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState(''),[documentType,setDocumentType]=useState('drivers_license'),[country,setCountry]=useState('US');
 const [consent,setConsent]=useState(false),[correction,setCorrection]=useState('');
 const [camera,setCamera]=useState(false),[instruction,setInstruction]=useState('');
 const video=useRef(null),stream=useRef(null),alive=useRef(true),cancelCapture=useRef(false),approval=useRef(onApproval);
 approval.current=onApproval;
 const stopCamera=()=>{cancelCapture.current=true;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(alive.current){setCamera(false);setInstruction('');}};
 const accept=async(result)=>{
  if(!alive.current)return;
  if(result.session!==undefined){setState(old=>({...old,...result}));setCorrection(result.session?.expected_name||'');}
  else setState(result);
  if(result.session?.status==='approved')await approval.current?.();
 };
 const refresh=async()=>{
  const result=await identityAction('status');await accept(result);
  if(alive.current)setName(previous=>previous||result.legal_name||'');
 };
 const perform=async(fn)=>{setBusy(true);setError('');try{await fn();}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}};
 useEffect(()=>{alive.current=true;void perform(refresh);return()=>{alive.current=false;stopCamera();};},[]);
 useEffect(()=>{
  if(state?.session?.status!=='processing')return;
  const timer=window.setInterval(()=>{void refresh().catch(()=>{});},5000);
  return()=>window.clearInterval(timer);
 },[state?.session?.status]);
 const session=state?.session,status=session?.status;
 const start=()=>perform(async()=>{
  await accept(await identityAction('start',{legal_name:name,document_type:documentType,issuing_country:country,consent,notice_version:state.notice_version}));
 });
 const upload=(kind,file)=>perform(async()=>{
  if(!file)return;
  if(!['image/jpeg','image/png'].includes(file.type)||file.size>8*1024*1024)throw Error('Use a JPEG or PNG no larger than 8 MB.');
  await accept(await identityUpload(session.id,kind,file));
 });
 const enableCamera=()=>perform(async()=>{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Live camera capture requires a supported browser over HTTPS.');
  stopCamera();
  stream.current=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});
  if(!alive.current){stream.current.getTracks().forEach(track=>track.stop());stream.current=null;return;}
  cancelCapture.current=false;setCamera(true);
  await new Promise(resolve=>window.setTimeout(resolve,0));
  if(!video.current){stopCamera();throw Error('The camera could not be opened.');}
  video.current.srcObject=stream.current;await video.current.play();
  setInstruction('Keep only your own face visible. Remove sunglasses and use even lighting.');
 });
 const capture=()=>perform(async()=>{
  if(!video.current?.videoWidth)throw Error('Wait for the camera to become ready.');
  cancelCapture.current=false;
  const wait=async(ms)=>{await new Promise(resolve=>window.setTimeout(resolve,ms));if(cancelCapture.current||!alive.current)throw Error('Camera capture cancelled.');};
  const frame=phase=>{
   const source=video.current;if(!source?.videoWidth)throw Error('The camera stopped.');
   const canvas=document.createElement('canvas'),ratio=Math.min(640/source.videoWidth,640/source.videoHeight,1);
   canvas.width=Math.round(source.videoWidth*ratio);canvas.height=Math.round(source.videoHeight*ratio);
   canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
   const base64=canvas.toDataURL('image/jpeg',0.78).split(',')[1];
   if(base64.length>200000)throw Error('The camera image is too large. Please try again.');
   return {phase,timestamp:performance.now(),frame_base64:base64};
  };
  try{
   const frames=[];setInstruction('Look straight at the camera. Hold still.');await wait(2000);
   const started=performance.now();frames.push(frame('turn1_start'));
   setInstruction(`Slowly turn your head to your ${session.directions[0]}. Hold that position.`);await wait(4000);frames.push(frame('turn1_peak'));
   setInstruction('Return to the center and look straight at the camera.');await wait(4000);frames.push(frame('turn1_return'));
   await wait(2000);frames.push(frame('turn_start'));
   setInstruction(`Now slowly turn your head to your ${session.directions[1]}. Hold that position.`);await wait(4000);frames.push(frame('turn_peak'));
   setInstruction('Return to the center and look straight at the camera.');await wait(4000);frames.push(frame('turn_return'));
   const payload={challenge_id:session.challenge_id,challenge_type:'head_turn',directions:session.directions,start_timestamp:started,end_timestamp:performance.now(),frames};
   setInstruction('Saving your camera capture securely.');
   await accept(await identityUpload(session.id,'capture',new File([JSON.stringify(payload)],'capture.json',{type:'application/json'})));
  }finally{stopCamera();}
 });
 const submit=()=>perform(async()=>{
  setState(old=>({...old,session:{...old.session,status:'processing',message:'Your ID and live camera capture are being checked.'}}));
  try{await accept(await identityAction('submit',{session_id:session.id}));}catch(e){await refresh().catch(()=>{});throw e;}
 });
 const restart=()=>perform(async()=>{
  stopCamera();
  if(['collecting','retryable_error','review_required','name_mismatch'].includes(status))await identityAction('cancel',{session_id:session.id});
  setState(old=>({...old,session:null}));setConsent(false);setCorrection('');
 });
 const complete=session?.uploaded?.front&&session?.uploaded?.capture&&(session.document_type==='passport'||session?.uploaded?.back);
 const canStart=!session||['cancelled','expired','eligible_to_retry'].includes(status);
 return <section className="ccx-surface rounded-3xl p-6 shadow-lg sm:p-8" aria-labelledby="identity-heading">
  <ShieldCheck className="mx-auto mb-3 text-[var(--cc-link)]" size={36}/>
  <h1 id="identity-heading" className="text-center text-2xl font-bold">Identity and age verification</h1>
  <p className="mt-3 text-sm leading-6 text-[var(--cc-text-secondary)]">Use a valid government-issued photo ID and a live camera capture. Your private legal name must match your ID. Your public display or stage name stays separate.</p>
  {!state&&<p role="status" className="mt-5">Loading verification…</p>}
  {state?.enabled===false&&<p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Identity verification is not available yet. Your account remains restricted until the service is connected and verification succeeds. No ID uploads are accepted while it is unavailable.</p>}
  {state&&!state.email_confirmed&&<p role="status" className="mt-4 text-sm">Confirm your email address before continuing.</p>}
  {status==='approved'&&<p role="status" className="mt-5 flex items-center justify-center gap-2 text-emerald-800"><CheckCircle2/>Verification complete</p>}
  {session?.message&&status!=='approved'&&<p role="status" className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-900">{session.message}</p>}
  {canStart&&state?.enabled&&<div className="mt-5 space-y-4">
   <label className="block text-sm font-medium">Full legal name on your ID<input autoComplete="name" maxLength={160} value={name} onChange={e=>setName(e.target.value)} className={field}/></label>
   <label className="block text-sm font-medium">Document type<select value={documentType} onChange={e=>setDocumentType(e.target.value)} className={field}><option value="drivers_license">Driver’s license</option><option value="passport">Passport</option><option value="national_id">National identity card</option></select></label>
   <label className="block text-sm font-medium">Issuing country<select value={country} onChange={e=>setCountry(e.target.value)} className={field}>{state.supported_countries?.map(code=><option key={code} value={code}>{code==='US'?'United States':code}</option>)}</select></label>
   <div className="max-h-56 overflow-y-auto rounded-xl border p-3 text-sm leading-6 whitespace-pre-wrap">{state.notice}</div>
   <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/>I have read the notice and consent to the described ID, facial-comparison, liveness, and evidence-retention processing.</label>
   <button type="button" disabled={busy||!consent||!name.trim()||!state.email_confirmed} onClick={start} className="ccx-primary min-h-12 w-full rounded-xl px-4 py-3">Start verification</button>
  </div>}
  {status==='collecting'&&state?.enabled&&<div className="mt-5 space-y-5">
   {['front',...(session.document_type==='passport'?[]:['back'])].map(kind=><label key={kind} className="block rounded-xl border p-4 text-sm font-medium">{kind==='front'?(session.document_type==='passport'?'Passport photo page':'Front of ID'):'Back of ID'}{session.uploaded?.[kind]?<span className="ml-3 text-emerald-800">Saved privately</span>:<input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(kind,file);}} className="mt-3 block w-full text-sm"/>}</label>)}
   <div className="rounded-xl border p-4">
    <h2 className="font-semibold">Live camera check</h2>
    {session.uploaded?.capture?<p className="mt-2 text-sm text-emerald-800">Your live capture is saved privately.</p>:<>
     <p className="mt-2 text-sm leading-6">Follow two head-turn instructions. A photo upload is not accepted as a live selfie. Keep your face in frame throughout.</p>
     {camera&&<video ref={video} autoPlay playsInline muted className="mt-3 w-full -scale-x-100 rounded-xl bg-slate-100" aria-label="Live camera preview"/>}
     {instruction&&<p role="status" aria-live="polite" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-900">{instruction}</p>}
     <button type="button" disabled={busy} onClick={camera?capture:enableCamera} className="ccx-secondary mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3"><Camera size={18}/>{camera?'Start head-turn capture':'Enable camera'}</button>
     {camera&&<button type="button" onClick={stopCamera} className="mt-2 min-h-11 w-full text-sm">Stop camera</button>}
    </>}
   </div>
   <button type="button" disabled={busy||!complete} onClick={submit} className="ccx-primary min-h-12 w-full rounded-xl px-4 py-3">Check my identity and age</button>
  </div>}
  {status==='processing'&&<p role="status" className="mt-4 text-center text-sm">Checking your saved evidence. You can return to this screen to check the result.</p>}
  {status==='name_mismatch'&&<div className="mt-5 space-y-3">
   <label className="block text-sm font-medium">Legal name read from your ID<input maxLength={160} autoComplete="name" value={correction} onChange={e=>setCorrection(e.target.value)} className={field}/></label>
   <button type="button" disabled={busy||!state?.enabled} onClick={()=>perform(async()=>accept(await identityAction('confirm_name',{session_id:session.id,legal_name:correction})))} className="ccx-primary min-h-12 w-full rounded-xl px-4 py-3">Update private legal name and finish</button>
  </div>}
  {status==='retryable_error'&&<button type="button" disabled={busy||!state?.enabled} onClick={submit} className="ccx-primary mt-4 min-h-11 w-full rounded-xl px-4 py-3">Retry verification</button>}
  {['age_restricted','review_required','name_mismatch','retryable_error'].includes(status)&&<button type="button" disabled={busy||session.review_requested} onClick={()=>perform(async()=>accept(await identityAction('request_review',{session_id:session.id})))} className="ccx-secondary mt-4 min-h-11 w-full rounded-xl px-4 py-3">{session.review_requested?'Review requested — access remains restricted':'Request a review'}</button>}
  {['collecting','review_required','name_mismatch','retryable_error'].includes(status)&&<button type="button" disabled={busy} onClick={restart} className="mt-3 min-h-11 w-full text-sm">Cancel this attempt and start again</button>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <button type="button" disabled={busy} onClick={()=>perform(refresh)} className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-[var(--cc-link)]"><RefreshCw size={16}/>Check status</button>
  {onboarding&&<p className="mt-5 text-center text-xs text-[var(--cc-text-secondary)]">Account created · Identity verification · Enter the site</p>}
 </section>;
}
