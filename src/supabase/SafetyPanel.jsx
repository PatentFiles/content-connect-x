/** Free member safety: report, block, and unblock. Enforcement runs in trusted Edge Functions. */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

export default function SafetyPanel(){
  const [blocked,setBlocked]=useState([]);
  const [target,setTarget]=useState('');
  const [reason,setReason]=useState('');
  const [details,setDetails]=useState('');
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const invoke=async(action,params={})=>{
    const {data,error:invokeError}=await supabase.functions.invoke('member-workflows',{body:{action,...params}});
    if(invokeError||data?.error)throw new Error(data?.error||invokeError?.message||'Request failed');
    return data;
  };
  const refresh=async()=>{
    setWorking(true);
    try{const result=await invoke('list_blocks');setBlocked(result.items||[]);}catch(e){setError(e.message);}finally{setWorking(false);}
  };
  useEffect(()=>{refresh();},[]);
  const action=async(type,payload)=>{
    setWorking(true);setError('');setNotice('');
    try{await invoke(type,payload);setNotice(type==='submit_report'?'Report submitted for moderation.':'Blocked list updated.');await refresh();}
    catch(e){setError(e.message);}finally{setWorking(false);}
  };
  return <section className="max-w-3xl space-y-4">
    <h2 className="text-xl font-semibold">Safety & reporting</h2>
    <p className="text-sm text-[#9AA6BC]">Report unsafe behavior or block another member. These controls are available to age-verified free members.</p>
    {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm">{notice}</p>}
    <div className="rounded-xl bg-[#151D2B] border border-[#263248] p-5 space-y-3">
      <label className="block text-sm">Member ID<input className="mt-1 w-full rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2" placeholder="Member UUID" value={target} onChange={e=>setTarget(e.target.value)}/></label>
      <button className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={working||!target} onClick={()=>action('block_user',{target_user_id:target})}>Block member</button>
      <label className="block text-sm">Reason for report<input value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2" placeholder="Explain the safety concern"/></label>
      <textarea className="w-full rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2" rows={3} placeholder="Additional context, without passwords or private documents" value={details} onChange={e=>setDetails(e.target.value)}/>
      <button className="rounded-lg ccx-action-primary px-4 py-2 text-sm text-white disabled:opacity-50" disabled={working||!target||reason.trim().length<5} onClick={()=>action('submit_report',{reported_id:target,reason,details})}>Submit report</button>
    </div>
    <div className="rounded-xl bg-[#151D2B] border border-[#263248] p-5 space-y-3"><h3 className="font-semibold">Blocked members</h3>{blocked.map(b=><div className="flex flex-wrap justify-between gap-2 text-sm" key={b.blocked_id}><span className="break-all">{b.blocked_id}</span><button disabled={working} className="text-blue-400" onClick={()=>action('unblock_user',{target_user_id:b.blocked_id})}>Unblock</button></div>)}{!blocked.length&&<p className="text-sm text-[#9AA6BC]">No blocked members.</p>}</div>
  </section>;
}
