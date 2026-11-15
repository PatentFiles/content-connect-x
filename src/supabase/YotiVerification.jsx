/** Hosted Yoti age verification; facial estimates are not conflated with verified performer identity. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,Camera,RefreshCw,ExternalLink} from 'lucide-react';
import {integrationAction} from './integrationApi';
export default function YotiVerification({brand='content_connect'}){
 const [status,setStatus]=useState(null),[readiness,setReadiness]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=async(verify=false)=>{
  setBusy(true);setError('');
  try{const [a,b]=await Promise.all([integrationAction('status'),integrationAction('yoti_status',{refresh:verify})]);
   setReadiness(a);setStatus(b);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{void refresh(false);},[]);
 const begin=async(mode)=>{
  setBusy(true);setError('');setNotice('');
  try{
   const response=await integrationAction('yoti_start',{mode,brand});
   const u=new URL(response.url);
   if(u.protocol!=='https:'||u.hostname!=='age.yoti.com')throw Error('Verification link was invalid');
   window.location.assign(u.toString());
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-4 p-5">
  <div className="flex justify-between items-center gap-2"><div><h3 className="flex gap-2 items-center font-bold"><ShieldCheck size={18} className="text-[#FF83D6]"/>Yoti identity & age check</h3>
   <p className="mt-1 text-sm text-[#B6C4DB]">Secure hosted selfie/liveness and document verification. You are redirected to Yoti; facial images are not uploaded to CCX.</p></div>
   <button className="ccx-secondary rounded-xl p-3" onClick={()=>refresh(true)} disabled={busy} aria-label="Refresh Yoti verification status"><RefreshCw size={17}/></button></div>
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-xs text-red-200">{error}</p>}
  {notice&&<p className="text-sm text-emerald-200">{notice}</p>}
  {status?.status&&status.status!=='not_started'&&<p className="text-sm">Latest Yoti session: <strong className="capitalize">{status.status.replaceAll('_',' ')}</strong> {status.method&&'· '+status.method}</p>}
  <div className="flex flex-wrap gap-2">
   <button onClick={()=>begin('age_gate')} disabled={busy||!readiness?.yoti_configured} className="ccx-secondary inline-flex gap-2 items-center rounded-xl px-4 py-3 text-sm"><Camera size={17}/>18+ age verification</button>
   <button onClick={()=>begin('performer_identity')} disabled={busy||!readiness?.yoti_configured} className="ccx-primary inline-flex gap-2 items-center rounded-xl px-4 py-3 text-sm"><ExternalLink size={17}/>Performer document check</button>
  </div>
  {!readiness?.yoti_configured&&<p className="text-xs text-amber-200">Yoti is not connected yet. Continue with the private ID-and-selfie manual review below.</p>}
  <p className="text-xs leading-5 text-[#9FB2CD]">An age result is not automatically a verified performer identity. Independent review of identity/recordkeeping evidence is still required before protected creator tools are enabled.</p>
 </section>;
}
