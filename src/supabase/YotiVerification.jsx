/** The ID camera and selfie/liveness UI run on Yoti, not in an imitation uploader. */
import React,{useEffect,useRef,useState} from 'react';
import {Camera,CheckCircle2,RefreshCw} from 'lucide-react';
import {integrationAction} from './integrationApi';
export default function YotiVerification({brand='content_connect',onApproval=()=>{},onboarding=false}){
 const [status,setStatus]=useState(null),[configured,setConfigured]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const callback=useRef(onApproval);callback.current=onApproval;
 const alive=useRef(true);
 const check=async(refresh=true)=>{
  setBusy(true);setError('');
  try{
   const [readiness,result]=await Promise.all([integrationAction('yoti_readiness',{brand}),integrationAction('yoti_status',{refresh})]);
   if(!alive.current)return null;
   setConfigured(readiness.yoti_configured===true);setStatus(result);
   if(result.status==='age_confirmed')await callback.current?.();
   return result;
  }catch(e){if(alive.current)setError(e.message);return null;}
  finally{if(alive.current)setBusy(false);}
 };
 useEffect(()=>{
  alive.current=true;let timer;
  const returned=Boolean(window.history.state?.ccxYotiReturned);
  if(returned){const h={...window.history.state};delete h.ccxYotiReturned;window.history.replaceState(h,'',window.location.href);}
  // A pending session may have completed while signed out, so fetch a real
  // provider result on return, sign-in and explicit refresh; never trust URL flags.
  const poll=async(attempt)=>{
   const result=await check(true);
   if(alive.current&&attempt<2&&['pending','processing'].includes(result?.status))timer=window.setTimeout(()=>void poll(attempt+1),5000);
  };
  void poll(0);
  return()=>{alive.current=false;window.clearTimeout(timer);};
 },[]);
 const start=async()=>{
  setBusy(true);setError('');
  try{
   const result=await integrationAction('yoti_start',{brand});
   const url=new URL(result.url);
   if(url.origin!=='https://age.yoti.com'||url.username||url.password)throw Error('Invalid verification link');
   window.location.assign(url.href);
  }catch(e){setError(e.message);setBusy(false);}
 };
 const approved=status?.status==='age_confirmed';
 const messages={pending:'You can continue verification or check its status.',processing:'Yoti is checking your document and selfie.',rejected:'The age check did not pass. You can try again with a valid government ID.',cancelled:'Verification was cancelled. Your account is saved.',expired:'That session expired. Start a new check.',provider_error:'Yoti could not complete the check. Please retry.',review_required:'This attempt did not meet the required document-and-selfie checks. Please start again.'};
 return <section className="ccx-surface rounded-3xl p-6 text-center shadow-2xl sm:p-9" aria-labelledby="yoti-age-heading">
  <div className="mx-auto mb-6 flex h-12 items-center justify-center" aria-label="Yoti">
   <img src="/yoti-logo.svg" alt="Yoti" className="h-10 w-auto" onError={e=>{e.currentTarget.hidden=true;e.currentTarget.nextElementSibling?.removeAttribute('hidden');}}/>
   <span hidden className="text-4xl font-bold tracking-tight text-[#32A8F0]">Yoti</span>
  </div>
  <h1 id="yoti-age-heading" className="text-2xl font-bold">{approved?'Age verified':'Age verification'}</h1>
  <p className="mt-3 text-sm leading-6 text-[#BBC8DE]">{approved?'Your verification is complete.':"Confirm you’re 18 or older with your government ID and a live selfie."}</p>
  {approved?<div role="status" className="mt-6 flex justify-center gap-2 text-emerald-300"><CheckCircle2 size={21}/>Verified by Yoti</div>:<>
   <button type="button" onClick={start} disabled={busy||configured!==true} className="ccx-primary mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold"><Camera size={20}/>{busy?'Please wait…':'Verify with Yoti'}</button>
   <p className="mt-3 text-xs leading-5 text-[#9DAFC9]">Yoti will guide you through photographing your ID and taking a selfie. Your ID photos are not uploaded to Content Connect X.</p>
  </>}
  {configured===false&&<p role="status" className="mt-4 rounded-xl bg-amber-950/40 p-3 text-sm text-amber-200">Verification is temporarily unavailable. Your account is saved; please return when the service is connected.</p>}
  {messages[status?.status]&&!approved&&<p role="status" className="mt-4 text-sm text-[#C5D7ED]">{messages[status.status]}</p>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-950/70 p-3 text-sm text-red-200">{error}</p>}
  {(status?.status&&status.status!=='not_started'||error)&&<button type="button" disabled={busy} onClick={()=>check(true)} className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm text-[#9BDAF6]"><RefreshCw size={15}/>Check verification status</button>}
  {onboarding&&<p className="mt-6 text-xs text-[#8298B6]">Account created · Verification · Enter the site</p>}
 </section>;
}
