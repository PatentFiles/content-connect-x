import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { ShieldCheck, ClipboardCheck, RefreshCw } from 'lucide-react';

const panel='ccx-surface p-5';
const input='w-full rounded-lg bg-[#0F1520] border border-[#34445D] px-3 py-2 text-sm';
const button='rounded-lg ccx-action-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function TrustCenter({isAdmin=false}){
  const [own,setOwn]=useState(null);
  const [collaborationId,setCollaborationId]=useState('');
  const [team,setTeam]=useState(null);
  const [consent,setConsent]=useState(false);
  const [adminTarget,setAdminTarget]=useState('');
  const [reference,setReference]=useState('');
  const [provider,setProvider]=useState('');
  const [expires,setExpires]=useState('');
  const [verifiedOffsite,setVerifiedOffsite]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const call=async(action,args={})=>{
    const {data,error}=await supabase.functions.invoke('performer-readiness',{body:{action,...args}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Service temporarily unavailable');
    return data;
  };
  const load=async()=>{
    setBusy(true);setError('');
    try{setOwn(await call('my_status'));}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  useEffect(()=>{load();},[]);
  const request=async()=>{
    setBusy(true);setError('');setNotice('');
    try{const result=await call('request_background_screening',{consent});setNotice(result.note||'Request saved.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const check=async()=>{
    setBusy(true);setError('');setTeam(null);
    try{setTeam(await call('check_collaboration_clearance',{collaboration_id:collaborationId}));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const approve=async()=>{
    if(!window.confirm('Confirm you independently verified this current clearance with the provider?'))return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await call('admin_record_provider_clearance',{
        user_id:adminTarget,provider_reference:reference,provider,
        expires_at:new Date(expires).toISOString(),confirmed_by_provider:verifiedOffsite
      });
      setNotice('Provider confirmation recorded through '+new Date(result.expires_at).toLocaleString());
      setReference('');setAdminTarget('');setVerifiedOffsite(false);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="space-y-4 max-w-4xl">
    <div className="flex items-center justify-between"><div><h2 className="text-2xl font-semibold">Trust & shoot readiness</h2><p className="text-sm text-[#9AA6BC] mt-1">Professional verification without exposing medical records or background reports.</p></div><button onClick={load} className={button} disabled={busy} aria-label="Refresh trust status"><RefreshCw size={17}/></button></div>
    {error&&<p role="alert" className="p-3 rounded-lg bg-red-950 text-red-200">{error}</p>}
    {notice&&<p role="status" className="p-3 rounded-lg bg-emerald-950 text-emerald-200">{notice}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <section className={panel}><h3 className="font-semibold flex gap-2 items-center"><ShieldCheck size={18} className="text-blue-400"/> STI work-clearance status</h3>
        <p className="text-sm text-[#9AA6BC] my-3">A time-limited provider confirmation, not an individual test result or guarantee of zero risk.</p>
        <p className="font-semibold">{own?.work_clearance?.confirmed?'Current clearance confirmed':'No current provider confirmation'}</p>
        {own?.work_clearance?.confirmed&&<p className="text-sm text-[#9AA6BC] mt-2">Expires {new Date(own.work_clearance.expires_at).toLocaleString()}</p>}
        <p className="text-xs text-[#9AA6BC] mt-3">Recheck directly with the testing provider close to the production date.</p>
      </section>
      <section className={panel}><h3 className="font-semibold flex gap-2 items-center"><ClipboardCheck size={18} className="text-blue-400"/> Optional background screening</h3>
        <p className="text-sm text-[#9AA6BC] my-3">This saves an expression of interest. No screening starts until a qualified provider and required disclosures are available.</p>
        <p className="text-sm">{own?.background_screening ? 'Request: '+own.background_screening.request_status.replaceAll('_',' ') : 'No request submitted'}</p>
        <label className="flex items-start gap-2 text-sm mt-4"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>I voluntarily request more information about optional professional background screening. This is not authorization to obtain a consumer report.</span></label>
        <button disabled={busy||!consent} className={button+' mt-3'} onClick={request}>Save screening interest</button>
      </section>
    </div>
    <section className={panel}><h3 className="font-semibold">Collaboration work-readiness check</h3><p className="text-sm text-[#9AA6BC] my-2">Available only to collaboration participants; no medical details are returned.</p>
      <div className="flex flex-wrap gap-2"><input className={input+' flex-1 min-w-[180px]'} value={collaborationId} onChange={e=>setCollaborationId(e.target.value)} placeholder="Collaboration ID"/><button className={button} disabled={busy||!collaborationId} onClick={check}>Check status</button></div>
      {team&&<div className="mt-3 space-y-2"><p className="text-sm font-medium">{team.ready?'All listed members currently confirmed':'At least one member is not currently confirmed'}</p>{(team.members||[]).map(p=><div key={p.user_id} className="flex justify-between gap-3 text-sm border-b border-[#263248] pb-2"><span className="break-all">{p.user_id}</span><span>{p.clearance_confirmed?'Confirmed':'Not confirmed'}</span></div>)}</div>}
    </section>
    {isAdmin&&<section className={panel}><h3 className="font-semibold">Administrative provider confirmation</h3>
      <p className="text-sm text-[#9AA6BC] my-3">Only after independently checking the provider's work-clearance system. Never infer clearance from a screenshot or self-report.</p>
      <div className="grid md:grid-cols-2 gap-3"><label className="text-sm">Member ID<input className={input+' mt-1'} value={adminTarget} onChange={e=>setAdminTarget(e.target.value)}/></label><label className="text-sm">Provider name<input className={input+' mt-1'} value={provider} onChange={e=>setProvider(e.target.value)}/></label><label className="text-sm">Provider confirmation reference<input className={input+' mt-1'} value={reference} onChange={e=>setReference(e.target.value)}/></label><label className="text-sm">Clearance expires<input className={input+' mt-1'} type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)}/></label></div>
      <label className="flex gap-2 items-start mt-3 text-sm"><input type="checkbox" className="mt-1" checked={verifiedOffsite} onChange={e=>setVerifiedOffsite(e.target.checked)}/>I checked the provider's clearance system.</label>
      <button className={button+' mt-3'} disabled={busy||!adminTarget||!provider||!reference||!expires||!verifiedOffsite} onClick={approve}>Record reviewed clearance</button>
    </section>}
  </div>;
}
