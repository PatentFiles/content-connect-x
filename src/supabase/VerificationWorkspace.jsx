/** Account role is not evidence of age. Use the actual owner-scoped verification row. */
import React,{useCallback,useEffect,useState} from 'react';
import {UploadCloud,RefreshCw,ShieldCheck} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import YotiVerification from './YotiVerification';
import {useRoleWorkspace} from './RoleWorkspaceContext';
export default function VerificationWorkspace({user}){
 const workspace=useRoleWorkspace();
 const admitted=workspace.account?.onboarding_complete===true;
 const [record,setRecord]=useState(null),[loaded,setLoaded]=useState(false);
 const [paths,setPaths]=useState({id:null,selfie:null}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const reload=useCallback(async()=>{
  if(!user?.id)return;
  const {data,error:failure}=await supabase.from('age_verification_requests').select('id,status,created_at,verified_at,expires_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1);
  if(failure)throw failure;
  setRecord(data?.[0]||null);setLoaded(true);
  window.dispatchEvent(new Event('ccx-verification-refreshed'));
 },[user?.id]);
 useEffect(()=>{setLoaded(false);setRecord(null);setPaths({id:null,selfie:null});void reload().catch(e=>setError(e.message));},[reload]);
 useEffect(()=>{if(record?.status!=='pending')return;const timer=window.setInterval(()=>void reload().catch(()=>{}),15000);return()=>window.clearInterval(timer);},[record?.status,reload]);
 const approved=record?.status==='approved'&&(!record.expires_at||Date.parse(record.expires_at)>Date.now());
 const pending=record?.status==='pending';
 const upload=kind=>async event=>{
  const file=event.target.files?.[0];if(!file)return;
  setBusy(true);setError('');setNotice('');
  try{
   const allowed=kind==='id'?['application/pdf','image/jpeg','image/png','image/webp']:['image/jpeg','image/png','image/webp'];
   if(!allowed.includes(file.type)||file.size===0||file.size>10485760)throw Error(kind==='id'?'Use a PDF, JPEG, PNG or WebP up to 10 MB.':'Use a JPEG, PNG or WebP selfie up to 10 MB.');
   const ext=file.type==='application/pdf'?'pdf':file.type.split('/')[1];
   const path=user.id+'/'+kind+'-'+crypto.randomUUID()+'.'+ext;
   const {error:failure}=await supabase.storage.from('age-verification').upload(path,file,{contentType:file.type,upsert:false});
   if(failure)throw failure;setPaths(v=>({...v,[kind]:path}));setNotice((kind==='id'?'ID':'Selfie')+' uploaded privately.');
  }catch(e){setError(e.message);}finally{setBusy(false);event.target.value='';}
 };
 const submit=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('submit-age-verification',{body:{id_document_path:paths.id,selfie_document_path:paths.selfie}});
   if(failure){let message=failure.message;try{message=(await failure.context?.json())?.error||message;}catch{/* retain message */}throw Error(message);}
   if(data?.error)throw Error(data.error);
   setPaths({id:null,selfie:null});setNotice('Submitted for independent review. This does not immediately approve your account.');await reload();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="max-w-2xl space-y-5">
  <header><h1 className="text-2xl font-bold">Age verification</h1><p className="mt-2 text-sm text-[#B7C5DA]">Your actual verification status is checked independently of administrator access and role previews.</p></header>
  {error&&<p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
  <div className="ccx-surface space-y-3 p-5"><p className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/>{!loaded?'Checking status…':approved?'Independently age verified':pending?'Review pending':admitted?'Account access active · independent age evidence not recorded':'Complete signup verification'}</p>
   <p className="text-sm text-[#A9BED8]">{admitted?'Your site-entry step is already complete. This page displays evidence status; it does not lock individual features.':'Complete the independent review to enter the site.'}</p>
   <button type="button" className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" disabled={busy} onClick={()=>void reload().then(()=>window.dispatchEvent(new Event('focus'))).catch(e=>setError(e.message))}><RefreshCw size={16}/>Refresh verification status</button>
  </div>
  {!approved&&<YotiVerification onApproval={()=>void reload().then(()=>window.dispatchEvent(new Event('focus'))).catch(e=>setError(e.message))}/>}
  {loaded&&!approved&&!pending&&<div className="ccx-surface space-y-4 p-5"><h2 className="font-semibold">Private ID and selfie review</h2><p className="text-sm text-[#B7C5DA]">An authorized independent reviewer must review your evidence. These documents are never shown in Discovery or shared with collaborators.</p>
   <label className="block text-sm">Government ID<input type="file" className="mt-2 block w-full" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={upload('id')}/>{paths.id&&<span className="text-xs text-emerald-300">Uploaded</span>}</label>
   <label className="block text-sm">Selfie<input type="file" className="mt-2 block w-full" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload('selfie')}/>{paths.selfie&&<span className="text-xs text-emerald-300">Uploaded</span>}</label>
   <button type="button" className="ccx-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" disabled={busy||!paths.id||!paths.selfie} onClick={submit}><UploadCloud size={17}/>{busy?'Working…':'Submit for independent review'}</button>
  </div>}
 </section>;
}
