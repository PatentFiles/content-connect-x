/** Non-dismissible, full-screen onboarding. No authenticated adult routes are mounted until 18+ is independently approved. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,UploadCloud,LogOut,RefreshCw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import YotiVerification from './YotiVerification';
import {PROFESSIONAL_ROLES} from './membershipCatalog.mjs';

const field='mt-1 w-full rounded-xl border border-[#34445D] bg-[#0F1520] px-3 py-2.5 text-sm text-white';
export default function AgeGateOnboarding({user,profile,verification,onSaved,onReload,onSignOut}){
 const [name,setName]=useState(profile?.display_name||'');
 const [role,setRole]=useState(PROFESSIONAL_ROLES.some(r=>r.id===profile?.role_type)?profile.role_type:'creator');
 const [city,setCity]=useState(profile?.city||''),[state,setState]=useState(profile?.state||''),[country,setCountry]=useState(profile?.country||'');
 const [files,setFiles]=useState({id:null,selfie:null});
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const complete=profile?.profile_complete===true;
 const pending=verification?.status==='pending';
 useEffect(()=>{
  if(!complete||verification?.status==='approved')return;
  const interval=window.setInterval(()=>{void onReload().catch(()=>{});},15000);
  const focus=()=>{void onReload().catch(()=>{});};
  window.addEventListener('focus',focus);
  return()=>{window.clearInterval(interval);window.removeEventListener('focus',focus);};
 },[complete,verification?.status,onReload]);
 const saveProfile=async e=>{
  e.preventDefault();setError('');setNotice('');setLoading(true);
  try{
   if(name.trim().length<2||!city.trim()||!country.trim())
    throw Error('Display name, city and country are required before verification.');
   const {error:writeError}=await supabase.from('member_profiles').upsert({
    id:user.id,display_name:name.trim().slice(0,100),role_type:role,
    city:city.trim().slice(0,100),state:state.trim().slice(0,100),
    country:country.trim().slice(0,100),profile_complete:true,
    updated_at:new Date().toISOString()
   },{onConflict:'id'});
   if(writeError)throw writeError;
   await onSaved();
  }catch(e){setError(e.message||'Unable to save profile.');}finally{setLoading(false);}
 };
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
 return <div className="ccx-app fixed inset-0 z-[200] overflow-y-auto bg-[#090D16] px-4 py-6 text-[#F5F3FF] sm:grid sm:place-items-center sm:py-10">
  <div className="ccx-surface mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#34415D] bg-[#11182b]/95 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="mandatory-onboarding-title">
   <div className="border-b border-[#34415D] p-5 sm:p-7">
    <div className="mb-3 flex items-center gap-3">
     <img src="/content_connect_logo.png" className="h-10 w-10 rounded-xl" alt=""/>
     <div><p className="ccx-eyebrow">Content Connect X</p><p className="text-xs text-[#AABBD4]">Protected professional network · Adults only</p></div>
    </div>
    <h1 id="mandatory-onboarding-title" className="text-2xl font-bold">
     {!complete?'Create your professional profile':'Verify you are 18 or older'}
    </h1>
    <p className="mt-2 text-sm leading-6 text-[#B8C5DA]">
     {!complete?'First create your basic profile. You must then complete independent age verification before accessing member features.'
      :'Verification is mandatory for every account, including administrators. You cannot access profiles, messages or production features until your age is approved.'}
    </p>
    <div className="mt-4 flex gap-2 text-xs">
     <span className={(!complete?'ccx-primary':'ccx-secondary')+' rounded-lg px-3 py-2'}>1 · Profile</span>
     <span className={(complete?'ccx-primary':'ccx-secondary')+' rounded-lg px-3 py-2'}>2 · 18+ verification</span>
    </div>
   </div>
   <div className="max-h-none space-y-4 overflow-y-visible p-5 sm:p-7">
    {error&&<p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
    {!complete?<form onSubmit={saveProfile} className="space-y-4">
     <label className="block text-sm">Professional display name<input required minLength={2} maxLength={100} className={field} value={name} onChange={e=>setName(e.target.value)}/></label>
     <label className="block text-sm">Professional role<select className={field} value={role} onChange={e=>setRole(e.target.value)}>
      {PROFESSIONAL_ROLES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
     </select></label>
     <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">City<input className={field} required maxLength={100} autoComplete="address-level2" value={city} onChange={e=>setCity(e.target.value)}/></label>
      <label className="text-sm">State / region<input className={field} maxLength={100} autoComplete="address-level1" value={state} onChange={e=>setState(e.target.value)}/></label>
     </div>
     <label className="block text-sm">Country<input className={field} required maxLength={100} autoComplete="country-name" value={country} onChange={e=>setCountry(e.target.value)}/></label>
     <p className="text-xs leading-5 text-[#AABBD4]">Only general city-level location is used for free local connections. Never enter a home address here.</p>
     <button className="ccx-primary w-full rounded-xl px-5 py-3 font-semibold" disabled={loading}>{loading?'Saving…':'Continue to age verification'}</button>
    </form>:<>
     <div className="rounded-xl border border-[#33415E] bg-[#10192A] p-4">
      <div className="flex gap-2 items-center text-sm font-semibold"><ShieldCheck size={18} className="text-[#FF88D5]"/>Verification status</div>
      <p className="mt-2 text-sm text-[#C6D1E4]">{pending?'Your independent ID review is pending. Access remains locked.':verification?.status==='rejected'?'The earlier verification was rejected. You can submit new valid documents.':'Not yet independently verified.'}</p>
     </div>
     <YotiVerification onApproval={onReload}/>
     {!pending&&<section className="ccx-surface space-y-3 p-4">
      <h2 className="font-semibold">Manual government ID and selfie review</h2>
      <p className="text-xs leading-5 text-[#AFBED4]">Your documents are held privately and can only be reviewed by authorized staff. An administrator cannot approve their own verification.</p>
      <label className="block text-sm">Government ID (PDF or image)
       <input type="file" className="mt-2 block w-full text-xs" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={loading} onChange={upload('id')}/></label>
      <label className="block text-sm">Selfie (image)
       <input type="file" className="mt-2 block w-full text-xs" accept="image/jpeg,image/png,image/webp" disabled={loading} onChange={upload('selfie')}/></label>
      <button type="button" className="ccx-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
       disabled={loading||!files.id||!files.selfie} onClick={submit}><UploadCloud size={17}/>Submit for independent review</button>
     </section>}
     <button type="button" className="ccx-secondary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm"
      disabled={loading} onClick={()=>void onReload().catch(e=>setError(e.message))}><RefreshCw size={17}/>Check verification status</button>
    </>}
   </div>
   <footer className="sticky bottom-0 border-t border-[#34415D] bg-[#11182b] p-4 sm:p-5">
    <button type="button" onClick={logout} disabled={loading}
     className="ccx-secondary flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"><LogOut size={17}/>Log out and finish later</button>
    <p className="mt-2 text-center text-xs text-[#A7B7CE]">Returning to the site will reopen the mandatory verification process.</p>
   </footer>
  </div>
 </div>;
}
