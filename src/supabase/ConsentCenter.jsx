import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-5';
const button='rounded-lg bg-[#4F8CFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function ConsentCenter({user,canGrant=false}){
  const [collabs,setCollabs]=useState([]);
  const [selected,setSelected]=useState('');
  const [records,setRecords]=useState([]);
  const [participation,setParticipation]=useState(false);
  const [recording,setRecording]=useState(false);
  const [distribution,setDistribution]=useState(false);
  const [download,setDownload]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const call=useCallback(async(action,extra={})=>{
    const {data,error:callError}=await supabase.functions.invoke('collaboration-consent',{body:{action,...extra}});
    if(callError||data?.error)throw new Error(data?.error||callError?.message||'Consent service unavailable');
    return data;
  },[]);

  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{const data=await call('list_mine');setCollabs(data.items||[]);}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  },[call]);

  const loadSelected=useCallback(async(id)=>{
    if(!id){setRecords([]);return;}
    setBusy(true);setError('');
    try{const data=await call('status',{collaboration_id:id});setRecords(data.consents||[]);}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  },[call]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{loadSelected(selected);},[selected,loadSelected]);
  const own=records.find(r=>r.user_id===user?.id);
  const submit=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const result=await call('grant',{collaboration_id:selected,
        participation_consent:participation,recording_consent:recording,
        distribution_consent:distribution,download_consent:download});
      setNotice('Your choices have been recorded. You may withdraw consent later.');
      await loadSelected(selected);
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };

  const withdraw=async()=>{
    if(!window.confirm('Withdraw your recorded consent? This will pause the collaboration and notify the other parties for review.'))return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await call('revoke',{collaboration_id:selected});
      setNotice(result.status==='revoked'?'Consent withdrawn; collaboration paused for human review.':'Consent was already withdrawn.');
      await loadSelected(selected);await load();
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };

  return <div className="max-w-4xl space-y-4">
    <h2 className="text-2xl font-semibold">Consent & rights controls</h2>
    <p className="text-sm text-[#9AA6BC]">Participation, recording, publication and downloading require separate, informed choices. A contract signature is not a substitute for performer consent.</p>
    <p className="text-sm text-[#9AA6BC]">You may withdraw your recorded consent even after cancelling a paid subscription. Withdrawal flags the collaboration for review; it does not automatically remove content hosted elsewhere or decide legal rights.</p>
    {error&&<p className="rounded-lg bg-red-950 text-red-200 p-3 text-sm" role="alert">{error}</p>}
    {notice&&<p className="rounded-lg bg-emerald-950 text-emerald-200 p-3 text-sm" role="status">{notice}</p>}
    <section className={panel}>
      <label className="text-sm block">Your collaboration
        <select className="w-full mt-2 rounded-lg bg-[#0F1520] border border-[#34445D] p-3" value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">Choose a collaboration</option>
          {collabs.map(c=><option value={c.id} key={c.id}>{c.title} ({c.status})</option>)}
        </select>
      </label>
      {!collabs.length&&<p className="text-sm text-[#9AA6BC] mt-2">You have no collaborations yet.</p>}
    </section>
    {selected&&<section className={panel}>
      <h3 className="font-semibold mb-3">Recorded consent status</h3>
      {records.map(r=><div className="border-b border-[#34445D] py-2 text-sm" key={r.user_id}>
        <p>{r.user_id===user?.id?'You':r.user_id}</p>
        <p className="text-[#9AA6BC]">{r.revoked_at?'Withdrawn':r.participation_consent&&r.recording_consent?'Participation and recording consent recorded':'Not fully recorded'} · Publication {r.distribution_consent?'authorized':'not authorized'} · Downloads {r.download_consent?'authorized':'not authorized'}</p>
      </div>)}
      {!records.length&&<p className="text-sm text-[#9AA6BC]">No performer consent has been recorded.</p>}
      {own&&!own.revoked_at&&<button disabled={busy} className="rounded-lg bg-red-700 mt-4 px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={withdraw}>Withdraw my consent</button>}
      {own?.revoked_at&&<p className="text-amber-300 mt-4 text-sm">You have withdrawn consent. A new reviewed agreement would be needed before proceeding.</p>}
    </section>}
    {selected&&canGrant&&!own?.revoked_at&&!own&&<section className={panel}>
      <h3 className="font-semibold mb-3">Make your choices</h3>
      <div className="space-y-3 text-sm">
        <label className="flex gap-3 items-start"><input className="mt-1" type="checkbox" checked={participation} onChange={e=>setParticipation(e.target.checked)}/>I voluntarily agree to participate in this collaboration.</label>
        <label className="flex gap-3 items-start"><input className="mt-1" type="checkbox" checked={recording} onChange={e=>setRecording(e.target.checked)}/>I voluntarily agree to recording for this collaboration.</label>
        <label className="flex gap-3 items-start"><input className="mt-1" type="checkbox" checked={distribution} onChange={e=>setDistribution(e.target.checked)}/>I additionally authorize publication and distribution according to the agreed terms.</label>
        <label className="flex gap-3 items-start"><input className="mt-1" type="checkbox" checked={download} onChange={e=>setDownload(e.target.checked)}/>I additionally authorize downloads by audiences, subject to the agreed terms.</label>
      </div>
      <button className={button+' mt-4'} disabled={busy||!participation||!recording} onClick={submit}>Record my consent choices</button>
      <p className="text-xs text-[#9AA6BC] mt-3">This preliminary platform record does not replace a complete, project-specific release or legal consent review.</p>
    </section>}
  </div>;
}
