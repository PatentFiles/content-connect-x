/** Non-dismissible, full-screen onboarding. No authenticated adult routes are mounted until 18+ is independently approved. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,UploadCloud,LogOut,RefreshCw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import YotiVerification from './YotiVerification';

export default function AgeGateOnboarding({user,verification,onReload,onSignOut}){
 const [files,setFiles]=useState({id:null,selfie:null});
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=verification?.status==='pending';
 useEffect(()=>{
  // Remain here until the trusted admission row is reloaded by the parent.
  const interval=window.setInterval(()=>{void onReload().catch(()=>{});},15000);
  const focus=()=>{void onReload().catch(()=>{});};
  window.addEventListener('focus',focus);
  return()=>{window.clearInterval(interval);window.removeEventListener('focus',focus);};
 },[onReload]);
 const upload=kind=>async e=>{
  const file=e.target.files?.[0];if(!file)return;
  setError('');setNotice('');setLoading(true);
  try{
   const valid=kind==='id'
    ?['application/pdf','image/jpeg','image/png','image/webp']
    :['image/jpeg','image/png','image/webp'];
   if(!valid.includes(file.type)||file.size>10*1024*1024)
    throw Error('Upload an accepted PDF or image under 10 MB. A selfie must be an image.');
   const suffix=file.type==='application/pdf'?'pdf':file.type.split('/')[1];
   const path=user.id+'/'+kind+'-'+crypto.randomUUID()+'.'+suffix;
   const {error:uploadError}=await supabase.storage.from('age-verification')
    .upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError)throw uploadError;
   setFiles(previous=>({...previous,[kind]:path}));
   setNotice((kind==='id'?'Government ID':'Selfie')+' stored privately for review.');
  }catch(err){setError(err.message||'Upload failed.');}finally{setLoading(false);}
 };
 const submit=async()=>{
  setLoading(true);setError('');setNotice('');
  try{
   if(!files.id||!files.selfie)throw Error('Upload your ID and selfie first.');
   const {data,error:requestError}=await supabase.functions.invoke('submit-age-verification',{
    body:{id_document_path:files.id,selfie_document_path:files.selfie}
   });
   if(requestError||data?.error)throw Error(data?.error||requestError?.message||'Verification unavailable');
   setFiles({id:null,selfie:null});
   setNotice('Submitted securely. An independent reviewer must confirm you are 18 or older before access is allowed.');
   await onReload();
  }catch(err){setError(err.message||'Submission failed.');}finally{setLoading(false);}
 };
 const logout=async()=>{
  setLoading(true);setError('');
  try{await onSignOut();}catch(e){setError(e.message||'Sign out failed.');}finally{setLoading(false);}
 };
 return <div className="ccx-app fixed inset-0 z-[200] overflow-y-auto bg-[#090D16] px-3 py-5 text-[#F5F3FF] sm:grid sm:place-items-center sm:px-4 sm:py-8">
  <div className="ccx-surface mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#34415D] bg-[#11182b]/95 text-center shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="mandatory-onboarding-title">
   <div className="border-b border-[#34415D] px-5 py-6 sm:px-8 sm:py-7">
    <div className="mb-4 flex flex-col items-center gap-2">
     <img src="/content_connect_logo.png" className="h-12 w-12 rounded-2xl" alt=""/>
     <div><p className="ccx-eyebrow">Content Connect X</p><p className="text-xs text-[#AABBD4]">Protected professional network · Adults only</p></div>
    </div>
    <h1 id="mandatory-onboarding-title" className="text-2xl font-bold leading-tight">
     Verify you are 18 or older
    </h1>
    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#B8C5DA]">
     Your account is created. Complete independent age verification to enter Content Connect X.
     You can finish your profile after verification. Logging out does not skip this step.
    </p>
    <div className="mt-5 flex justify-center gap-2 text-xs">
     <span className="ccx-secondary rounded-full px-3 py-2">1 · Account created</span>
     <span className="ccx-primary rounded-full px-3 py-2">2 · Age verification</span>
     <span className="ccx-secondary rounded-full px-3 py-2">3 · Enter the site</span>
    </div>
   </div>
   <div className="max-h-none space-y-4 overflow-y-visible px-4 py-5 sm:px-7 sm:py-6">
    {error&&<p role="alert" className="rounded-2xl border border-red-400/30 bg-red-950/70 p-3 text-sm leading-5 text-red-200">{error}</p>}
    {notice&&<p role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-950/70 p-3 text-sm leading-5 text-emerald-200">{notice}</p>}
    <>
     <section className="rounded-2xl border border-[#33415E] bg-[#10192A] p-5 text-center shadow-lg">
      <div className="flex items-center justify-center gap-2 text-sm font-semibold"><ShieldCheck size={18} className="text-[#FF88D5]"/>Verification status</div>
      <p className="mt-2 text-sm leading-6 text-[#C6D1E4]">{pending?'Your independent ID review is pending. Access remains locked.':verification?.status==='rejected'?'The earlier verification was rejected. You can submit new valid documents.':'Not yet independently verified.'}</p>
     </section>
     <div className="rounded-2xl border border-[#33415E] bg-[#0F1728]/60 p-1 shadow-lg"><YotiVerification onApproval={onReload}/></div>
     {!pending&&<section className="rounded-2xl border border-[#33415E] bg-[#10192A] p-5 text-center shadow-lg">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#263452] text-[#FF9DDE]"><UploadCloud size={20}/></div>
      <h2 className="font-semibold">Manual government ID and selfie review</h2>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#AFBED4]">Your documents are held privately and can only be reviewed by authorized staff. An administrator cannot approve their own verification.</p>
      <div className="mt-5 space-y-4 text-sm">
       <label className="flex flex-col items-center gap-2">Government ID <span className="text-xs text-[#AABBD4]">PDF or image</span>
        <input type="file" className="block w-full max-w-xs text-center text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-[#263452] file:px-3 file:py-2 file:text-[#F5F3FF]" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={loading} onChange={upload('id')}/></label>
       <label className="flex flex-col items-center gap-2">Selfie <span className="text-xs text-[#AABBD4]">Image only</span>
        <input type="file" className="block w-full max-w-xs text-center text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-[#263452] file:px-3 file:py-2 file:text-[#F5F3FF]" accept="image/jpeg,image/png,image/webp" disabled={loading} onChange={upload('selfie')}/></label>
      </div>
      <button type="button" className="ccx-primary mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
       disabled={loading||!files.id||!files.selfie} onClick={submit}><UploadCloud size={17}/>Submit for independent review</button>
     </section>}
     <button type="button" className="ccx-secondary flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
      disabled={loading} onClick={()=>void onReload().catch(e=>setError(e.message))}><RefreshCw size={17}/>Check verification status</button>
    </>
   </div>
   <footer className="sticky bottom-0 border-t border-[#34415D] bg-[#11182b] px-4 py-4 text-center sm:px-6 sm:py-5">
    <button type="button" onClick={logout} disabled={loading}
     className="ccx-secondary mx-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"><LogOut size={17}/>Log out and finish later</button>
    <p className="mt-3 text-xs leading-5 text-[#A7B7CE]">Returning to the site will reopen the mandatory verification process.</p>
   </footer>
  </div>
 </div>;
}
