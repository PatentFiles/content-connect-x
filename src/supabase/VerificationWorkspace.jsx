/** Account role is not evidence of age. Use the actual owner-scoped verification row. */
import React,{useCallback,useEffect,useState} from 'react';
import {RefreshCw,ShieldCheck} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import YotiVerification from './YotiVerification';
import {useRoleWorkspace} from './RoleWorkspaceContext';
export default function VerificationWorkspace({user}){
 const workspace=useRoleWorkspace();
 const admitted=workspace.account?.onboarding_complete===true;
 const [record,setRecord]=useState(null),[loaded,setLoaded]=useState(false);
 const [error,setError]=useState('');
 const reload=useCallback(async()=>{
  if(!user?.id)return;
  const {data,error:failure}=await supabase.from('age_verification_requests').select('id,status,created_at,verified_at,expires_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1);
  if(failure)throw failure;
  setRecord(data?.[0]||null);setLoaded(true);
  window.dispatchEvent(new Event('ccx-verification-refreshed'));
 },[user?.id]);
 useEffect(()=>{setLoaded(false);setRecord(null);void reload().catch(e=>setError(e.message));},[reload]);
 useEffect(()=>{if(record?.status!=='pending')return;const timer=window.setInterval(()=>void reload().catch(()=>{}),15000);return()=>window.clearInterval(timer);},[record?.status,reload]);
 const approved=record?.status==='approved'&&(!record.expires_at||Date.parse(record.expires_at)>Date.now());
 const pending=record?.status==='pending';
 return <section className="max-w-2xl space-y-5">
  <header><h1 className="text-2xl font-bold">Age verification</h1><p className="mt-2 text-sm text-[#B7C5DA]">Your actual verification status is checked independently of administrator access and role previews.</p></header>
  {error&&<p role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  <div className="ccx-surface space-y-3 p-5"><p className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/>{!loaded?'Checking status…':approved?'Independently age verified':pending?'Previous review pending · continue with Yoti':admitted?'Account access active · independent age evidence not recorded':'Complete signup verification'}</p>
   <p className="text-sm text-[#A9BED8]">{admitted?'Your site-entry step is already complete. This page displays evidence status; it does not lock individual features.':'Complete the Yoti ID and selfie check to enter the site.'}</p>
   <button type="button" className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" onClick={()=>void reload().then(()=>window.dispatchEvent(new Event('focus'))).catch(e=>setError(e.message))}><RefreshCw size={16}/>Refresh verification status</button>
  </div>
  {!approved&&<YotiVerification onApproval={()=>void reload().then(()=>window.dispatchEvent(new Event('focus'))).catch(e=>setError(e.message))}/>}

 </section>;
}
