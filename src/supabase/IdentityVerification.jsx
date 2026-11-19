/** Capture UI only. Production admission and private pilot results remain server-owned. */
import React,{useEffect,useRef,useState} from 'react';
import {Camera,CheckCircle2,RefreshCw,ShieldCheck} from 'lucide-react';
import {identityAction,identityUpload} from './identityApi';
import LiveIdentityCamera from './LiveIdentityCamera';
import IdentityUploadProgress from './IdentityUploadProgress';
const field='mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900';
export default function IdentityVerification({onApproval=()=>{},onboarding=false,action=identityAction,uploadAction=identityUpload,testing=false}){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState(''),[documentType,setDocumentType]=useState('drivers_license'),[country,setCountry]=useState('US');
 const [consent,setConsent]=useState(false),[correction,setCorrection]=useState('');
 const [cameraBusy,setCameraBusy]=useState(false),[transfers,setTransfers]=useState(/** @type {Record<string,{phase:string,percent:number|null}>} */ ({}));
 const alive=useRef(true),approval=useRef(onApproval),inputs=useRef({}),uploadController=useRef(null),operation=useRef(false);
 approval.current=onApproval;
 const accept=async(result)=>{
  if(!alive.current)return;
  if(result.session!==undefined){setState(old=>({...old,...result}));setCorrection(result.session?.expected_name||'');}
  else setState(result);
  // A pilot result is never an onboarding-completion callback, even if all checks pass.
  if(result.session?.status==='approved'&&!testing)await approval.current?.();
 };
 const refresh=async()=>{
  const result=await action('status');await accept(result);
  if(alive.current)setName(previous=>previous||result.legal_name||'');
 };
 const perform=async(fn)=>{
  if(operation.current)return;operation.current=true;setBusy(true);setError('');
  try{await fn();}catch(e){if(alive.current)setError(e.message);}finally{operation.current=false;if(alive.current)setBusy(false);}
 };
 useEffect(()=>{alive.current=true;void perform(refresh);return()=>{alive.current=false;uploadController.current?.abort();};},[]);
 useEffect(()=>{
  if(state?.session?.status!=='processing')return;
  const timer=window.setInterval(()=>{void refresh().catch(()=>{});},5000);
  return()=>window.clearInterval(timer);
 },[state?.session?.status]);
 const session=state?.session,status=session?.status,locked=busy||cameraBusy;
 const start=()=>perform(async()=>{
  setTransfers({});
  await accept(await action('start',{legal_name:name,document_type:documentType,issuing_country:country,consent,notice_version:state.notice_version}));
 });
 /** The percentage follows upload events, never a timer. Completion is shown
  * only after the backend confirms this session's evidence was saved. */
 const saveEvidence=async(kind,file)=>{
  uploadController.current?.abort();const controller=new AbortController();uploadController.current=controller;
  const onProgress=progress=>{if(alive.current&&uploadController.current===controller)setTransfers(old=>({...old,[kind]:progress}));};
  onProgress({phase:'authorizing',percent:0});
  try{
   const result=await uploadAction(session.id,kind,file,{onProgress,signal:controller.signal});
   if(result?.session?.id!==session.id||result.session.uploaded?.[kind]!==true)throw Error('The private save could not be confirmed. Check status before retrying.');
   onProgress({phase:'complete',percent:100});await accept(result);
  }catch(error){
   if(alive.current&&uploadController.current===controller)setTransfers(old=>({...old,[kind]:{...old[kind],phase:'error'}}));
   throw error;
  }finally{if(uploadController.current===controller)uploadController.current=null;}
 };
 const upload=(kind,file)=>perform(async()=>{
  if(!file)return;
  if(!['image/jpeg','image/png'].includes(file.type)||file.size>8*1024*1024)throw Error('Use a JPEG or PNG no larger than 8 MB.');
  await saveEvidence(kind,file);
 });
 const submit=()=>perform(async()=>{
  setState(old=>({...old,session:{...old.session,status:'processing',message:'Your ID and live camera capture are being checked.'}}));
  try{await accept(await action('submit',{session_id:session.id}));}catch(e){await refresh().catch(()=>{});throw e;}
 });
 const restart=()=>perform(async()=>{
  if(['collecting','retryable_error','review_required','name_mismatch'].includes(status))await action('cancel',{session_id:session.id});
  setState(old=>({...old,session:null}));setConsent(false);setCorrection('');setTransfers({});
 });
 const complete=session?.uploaded?.front&&session?.uploaded?.capture&&(session.document_type==='passport'||session?.uploaded?.back);
 const canStart=!session||['cancelled','expired','eligible_to_retry'].includes(status);
 return <section className="ccx-surface rounded-3xl p-6 shadow-lg sm:p-8" aria-labelledby="identity-heading">
  <ShieldCheck className="mx-auto mb-3 text-[var(--cc-link)]" size={36}/>
  <h1 id="identity-heading" className="text-center text-2xl font-bold">{testing?'Private identity test':'Identity and age verification'}</h1>
  <p className="mt-3 text-sm leading-6 text-[var(--cc-text-secondary)]">{testing?'Test your own government-issued photo ID and live camera capture. Results are diagnostic only. Your account access and profile names will not change.':'Use a valid government-issued photo ID and a live camera capture. Your private legal name must match your ID. Your public display or stage name stays separate.'}</p>
  {!state&&<p role="status" className="mt-5">Loading verification…</p>}
  {state?.enabled===false&&<p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{testing?'Private testing is paused, expired, or awaiting a successful cleanup check. No test uploads are accepted. Your existing access is unchanged.':'Identity verification is not available yet. Your account remains restricted until the service is connected and verification succeeds. No ID uploads are accepted while it is unavailable.'}</p>}
  {state&&!state.email_confirmed&&<p role="status" className="mt-4 text-sm">Confirm your email address before continuing.</p>}
  {status==='approved'&&<p role="status" className="mt-5 flex items-center justify-center gap-2 text-emerald-800"><CheckCircle2/>{testing?session.message:'Verification complete'}</p>}
  {session?.message&&status!=='approved'&&<p role="status" className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-900">{session.message}</p>}
  {canStart&&state?.enabled&&<div className="mt-5 space-y-4">
   <label className="block text-sm font-medium">Full legal name on your ID<input autoComplete="name" maxLength={160} value={name} onChange={e=>setName(e.target.value)} className={field}/></label>
   <label className="block text-sm font-medium">Document type<select value={documentType} onChange={e=>setDocumentType(e.target.value)} className={field}><option value="drivers_license">Driver’s license</option><option value="passport">Passport</option><option value="national_id">National identity card</option></select></label>
   <label className="block text-sm font-medium">Issuing country<select value={country} onChange={e=>setCountry(e.target.value)} className={field}>{state.supported_countries?.map(code=><option key={code} value={code}>{code==='US'?'United States':code}</option>)}</select></label>
   <div className="max-h-56 overflow-y-auto rounded-xl border p-3 text-sm leading-6 whitespace-pre-wrap">{state.notice}</div>
   <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/>I have read the notice and consent to the described ID, facial-comparison, liveness, and evidence-retention processing.</label>
   <button type="button" disabled={locked||!consent||!name.trim()||!state.email_confirmed} onClick={start} className="ccx-primary min-h-12 w-full rounded-xl px-4 py-3">Start verification</button>
  </div>}
  {status==='collecting'&&state?.enabled&&<div className="mt-5 space-y-5">
   {['front',...(session.document_type==='passport'?[]:['back'])].map(kind=>{
    const label=kind==='front'?(session.document_type==='passport'?'Passport photo page':'Front of ID'):'Back of ID';
    return <div key={kind} className="rounded-xl border p-4" data-identity-document={kind}>
     <h2 className="text-sm font-medium">{label}</h2>
     {session.uploaded?.[kind]?<p className="mt-2 flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 size={18} aria-hidden="true"/>Saved privately</p>:<>
      <input ref={node=>{inputs.current[kind]=node;}} type="file" accept="image/jpeg,image/png" capture="environment" disabled={locked} hidden aria-label={`${label} photo`} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(kind,file);}}/>
      <button type="button" disabled={locked} onClick={()=>inputs.current[kind]?.click()} aria-label={`Take photo of ${label.toLowerCase()}`} className="ccx-secondary mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3"><Camera size={18} aria-hidden="true"/>Take photo</button>
      <p className="mt-2 text-xs leading-5 text-slate-600">Keep the whole ID visible and avoid glare. JPEG or PNG, up to 8 MB.</p>
     </>}
     <IdentityUploadProgress progress={transfers[kind]} label={label}/>
    </div>;
   })}
   {session.uploaded?.capture?<div className="rounded-xl border p-4"><h2 className="font-semibold">Live camera check</h2><p className="mt-2 text-sm text-emerald-800">Your live capture is saved privately.</p></div>:<LiveIdentityCamera key={session.id} session={session} disabled={busy} onCapture={file=>saveEvidence('capture',file)} onBusyChange={setCameraBusy}/>}
   <IdentityUploadProgress progress={transfers.capture} label="Live camera capture"/>
   <button type="button" disabled={locked||!complete} onClick={submit} className="ccx-primary min-h-12 w-full rounded-xl px-4 py-3">Check my identity and age</button>
  </div>}
  {status==='processing'&&<p role="status" className="mt-4 text-center text-sm">Checking your saved evidence. You can return to this screen to check the result.</p>}
  {status==='name_mismatch'&&<div className="mt-5 space-y-3">
   <label className="block text-sm font-medium">Legal name read from your ID<input maxLength={160} autoComplete="name" value={correction} onChange={e=>setCorrection(e.target.value)} className={field}/></label>
   <button type="button" disabled={locked||!state?.enabled} onClick={()=>perform(async()=>accept(await action('confirm_name',{session_id:session.id,legal_name:correction})))} className="ccx-primary min-h-12 w-full rounded-xl px-4 py-3">{testing?'Update test name and finish':'Update private legal name and finish'}</button>
  </div>}
  {status==='retryable_error'&&<button type="button" disabled={locked||!state?.enabled} onClick={submit} className="ccx-primary mt-4 min-h-11 w-full rounded-xl px-4 py-3">Retry verification</button>}
  {!testing&&['age_restricted','review_required','name_mismatch','retryable_error'].includes(status)&&<button type="button" disabled={locked||session.review_requested} onClick={()=>perform(async()=>accept(await action('request_review',{session_id:session.id})))} className="ccx-secondary mt-4 min-h-11 w-full rounded-xl px-4 py-3">{session.review_requested?'Review requested — access remains restricted':'Request a review'}</button>}
  {['collecting','review_required','name_mismatch','retryable_error'].includes(status)&&<button type="button" disabled={locked} onClick={restart} className="mt-3 min-h-11 w-full text-sm">Cancel this attempt and start again</button>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <button type="button" disabled={locked} onClick={()=>perform(refresh)} className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-[var(--cc-link)]"><RefreshCw size={16}/>Check status</button>
  {onboarding&&<p className="mt-5 text-center text-xs text-[var(--cc-text-secondary)]">Account created · Identity verification · Enter the site</p>}
 </section>;
}
