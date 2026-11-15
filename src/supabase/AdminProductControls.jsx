import React, { useCallback, useEffect, useState } from 'react';
import { Settings, ShieldAlert, RefreshCw } from 'lucide-react';
import { platformAction } from './platformApi';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-5';
const button='rounded-lg bg-[#4F8CFF] px-4 py-2 text-white font-semibold text-sm disabled:opacity-50';
export default function AdminProductControls(){
  const [flags,setFlags]=useState([]);
  const [queue,setQueue]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{
      const [a,b]=await Promise.all([
        platformAction('admin_list_feature_flags'),platformAction('admin_moderation_queue')
      ]);
      setFlags(a.items||[]);setQueue(b.items||[]);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  const update=async(flag,change)=>{
    setBusy(true);setError('');setNotice('');
    try{
      const result=await platformAction('admin_set_feature_flag',{
        key:flag.key,enabled:change.enabled??flag.enabled,
        allowed_tiers:change.allowed_tiers??flag.allowed_tiers,
        rollout_percent:change.rollout_percent??flag.rollout_percent
      });
      setFlags(prev=>prev.map(v=>v.key===flag.key?{...v,...result.item}:v));
      setNotice('Feature configuration updated.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const review=async(id,decision)=>{
    setBusy(true);setError('');setNotice('');
    try{await platformAction('admin_moderation_decide',{queue_id:id,decision});setNotice('Moderation review recorded.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold flex items-center gap-2"><Settings size={22}/> Platform controls</h2><button className={button} onClick={load} disabled={busy} aria-label="Refresh controls"><RefreshCw size={17}/></button></div>
    <p className="text-sm text-[#9AA6BC]">Admin-controlled rollouts inspired by Flagsmith. Server subscription and age permissions are enforced separately; turning on a flag cannot bypass them.</p>
    {error&&<p role="alert" className="bg-red-950 text-red-200 rounded-lg p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="bg-emerald-950 text-emerald-200 rounded-lg p-3 text-sm">{notice}</p>}
    <section className="space-y-3"><h3 className="text-lg font-semibold">Feature availability</h3>
      {flags.map(flag=><div key={flag.key} className={panel+' space-y-3'}>
        <div className="flex flex-wrap justify-between gap-2"><div><strong>{flag.key.replaceAll('_',' ')}</strong><p className="text-sm text-[#9AA6BC]">{flag.description}</p></div><label className="text-sm flex items-center gap-2"><input type="checkbox" disabled={busy} checked={flag.enabled} onChange={e=>update(flag,{enabled:e.target.checked})}/>Enabled</label></div>
        <div className="flex flex-wrap gap-5 items-center text-sm">
          <label className="flex gap-2 items-center"><input type="checkbox" disabled={busy} checked={flag.allowed_tiers.includes('free')} onChange={e=>update(flag,{allowed_tiers:e.target.checked?['free','premium']:['premium']})}/>Free preview</label>
          <label className="flex gap-2 items-center"><input type="checkbox" disabled={busy} checked={flag.allowed_tiers.includes('premium')} onChange={e=>update(flag,{allowed_tiers:e.target.checked?[...new Set([...flag.allowed_tiers,'premium'])]:['free']})}/>Premium</label>
          <label className="flex gap-2 items-center">Rollout <select className="bg-[#0F1520] border border-[#34445D] p-2 rounded-lg" disabled={busy} value={flag.rollout_percent} onChange={e=>update(flag,{rollout_percent:Number(e.target.value)})}>{[0,10,25,50,75,100].map(p=><option key={p} value={p}>{p}%</option>)}</select></label>
        </div>
      </div>)}
    </section>
    <section className="space-y-3"><h3 className="text-lg font-semibold flex items-center gap-2"><ShieldAlert size={19}/> Community moderation queue ({queue.length})</h3>
      <p className="text-[#9AA6BC] text-sm">All text posts and comments require human approval. Never mark an account age-verified based on post content or images.</p>
      {queue.map(item=><div className={panel+' space-y-3'} key={item.id}><p className="text-xs text-[#9AA6BC]">{item.content_type} · {new Date(item.created_at).toLocaleString()}</p><p className="text-sm whitespace-pre-wrap break-words">{item.body}</p><div className="flex gap-2"><button className={button} disabled={busy} onClick={()=>review(item.id,'approved')}>Approve</button><button className="bg-red-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={()=>review(item.id,'rejected')}>Reject</button></div></div>)}
      {!queue.length&&<div className={panel}><p className="text-sm text-[#9AA6BC]">Queue empty.</p></div>}
    </section>
  </div>;
}
