import React, { useCallback, useEffect, useState } from 'react';
import { Settings, ShieldAlert, RefreshCw } from 'lucide-react';
import { platformAction } from './platformApi';

const panel='ccx-surface p-5';
// Presentation-only grouping. The database and protected Edge Functions remain
// the source of truth for eligibility, pricing, age gates and rollout policies.
const groups={
  Discovery:['creator_discovery','search','favorites','connections','messages','verified_reviews'],
  'Production & collaboration':['collaborations','contracts','availability','production_manager','creator_booking','roster','representations','creator_groups','event_rsvps'],
  'Testing & safety':['testing','background_screening'],
  'Hosting & locations':['hosting_marketplace','hosting_requests','hosting_turnover','property_bookings'],
  'Community & media':['community_feed','community_publish','media_gallery','product_feedback']
};
const categoryFor=key=>Object.entries(groups).find(([,keys])=>keys.includes(key))?.[0]||'Other';
const button='rounded-lg ccx-action-primary px-4 py-2 text-white font-semibold text-sm disabled:opacity-50';
export default function AdminProductControls({onFeatureChange}){
  const [flags,setFlags]=useState([]);
  const [filter,setFilter]=useState('');
  const [category,setCategory]=useState('all');
  const [queue,setQueue]=useState([]);
  const [settings,setSettings]=useState({age_verification_required:true});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{
      const [features,moderation,settingsResult]=await Promise.allSettled([
        platformAction('admin_list_feature_flags'),platformAction('admin_moderation_queue'),platformAction('admin_get_settings')
      ]);
      if(features.status==='rejected')throw features.reason;
      setFlags(features.value.items||[]);
      if(moderation.status==='fulfilled')setQueue(moderation.value.items||[]);
      else setQueue([]);
      if(settingsResult.status==='fulfilled'){
        const map={};for(const s of settingsResult.value.items||[])map[s.key]=s.value!==false;
        setSettings(map);
      }
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
      onFeatureChange?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const review=async(id,decision)=>{
    setBusy(true);setError('');setNotice('');
    try{await platformAction('admin_moderation_decide',{queue_id:id,decision});setNotice('Moderation review recorded.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const toggleAgeGate=async(enabled)=>{
    setBusy(true);setError('');setNotice('');
    try{
      await platformAction('admin_set_setting',{key:'age_verification_required',value:enabled});
      setSettings(prev=>({...prev,age_verification_required:enabled}));
      setNotice(enabled?'Age verification gate turned ON.':'Age verification gate turned OFF — all pages accessible for testing.');
      onFeatureChange?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const filteredFlags=flags.filter(f=>(category==='all'||categoryFor(f.key)===category)&&
    (f.key+' '+f.description).toLowerCase().includes(filter.trim().toLowerCase()));
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold flex items-center gap-2"><Settings size={22}/> Platform controls</h2><button className={button} onClick={load} disabled={busy} aria-label="Refresh controls"><RefreshCw size={17}/></button></div>
    <p className="text-sm text-[#9AA6BC]">Admin-controlled rollouts inspired by Flagsmith. Server subscription and age permissions are enforced separately; turning on a flag cannot bypass them.</p>
    {error&&<p role="alert" className="bg-red-950 text-red-200 rounded-lg p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="bg-emerald-950 text-emerald-200 rounded-lg p-3 text-sm">{notice}</p>}
    <section className={panel+' space-y-3'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-semibold flex items-center gap-2"><ShieldAlert size={19}/> Age verification gate</h3>
        <p className="text-sm text-[#9AA6BC] mt-1">When enabled, every user must complete age verification before accessing the app. Turn off globally to test the site before launch, then turn it back on before going live.</p></div>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" disabled={busy} checked={settings.age_verification_required}
            onChange={e=>toggleAgeGate(e.target.checked)}/>
          {settings.age_verification_required?'Enabled':'Disabled (testing mode)'}
        </label>
      </div>
      {!settings.age_verification_required&&<p className="rounded-lg bg-amber-950/60 border border-amber-700/50 px-3 py-2 text-sm text-amber-200">Age verification is currently OFF. All pages are accessible without the verification popup. Turn it back on before releasing.</p>}
    </section>
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Feature availability ({flags.filter(f=>f.enabled).length}/{flags.length} enabled)</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-[#C7D3E7]">Filter by area
          <select aria-label="Filter modules by area" className="mt-1 w-full rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="all">All modules</option>
            {[...new Set(flags.map(f=>categoryFor(f.key)))].sort().map(name=><option value={name} key={name}>{name}</option>)}
          </select>
        </label>
        <label className="text-sm text-[#C7D3E7]">Search modules
          <input aria-label="Search modules" placeholder="Find a module…" value={filter} onChange={e=>setFilter(e.target.value)}
           className="mt-1 w-full rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2"/>
        </label>
      </div>
      <p className="text-xs text-[#9AA6BC]">Turn individual pages on or off for Free or Premium members, then optionally stagger release. Age verification, privacy and administration remain accessible regardless of these switches. An enabled feature still needs its real provider and server permissions before sensitive actions work.</p>
      {filteredFlags.map(flag=><div key={flag.key} className={panel+' space-y-3'}>
        <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="mb-1 text-[11px] uppercase tracking-wider text-[#FF91D9]">{categoryFor(flag.key)}</p><strong className="capitalize">{flag.key.replaceAll('_',' ')}</strong><p className="text-sm text-[#9AA6BC]">{flag.description}</p></div><label className="text-sm flex items-center gap-2"><input type="checkbox" disabled={busy} checked={flag.enabled} onChange={e=>update(flag,{enabled:e.target.checked})}/>Enabled</label></div>
        <div className="flex flex-wrap gap-5 items-center text-sm">
          <label className="flex gap-2 items-center"><input type="checkbox" disabled={busy} checked={flag.allowed_tiers.includes('free')} onChange={e=>update(flag,{allowed_tiers:e.target.checked?['free','premium']:['premium']})}/>Free preview</label>
          <label className="flex gap-2 items-center"><input type="checkbox" disabled={busy} checked={flag.allowed_tiers.includes('premium')} onChange={e=>update(flag,{allowed_tiers:e.target.checked?[...new Set([...flag.allowed_tiers,'premium'])]:['free']})}/>Premium</label>
          <label className="flex gap-2 items-center">Rollout <select className="bg-[#0F1520] border border-[#34445D] p-2 rounded-lg" disabled={busy} value={flag.rollout_percent} onChange={e=>update(flag,{rollout_percent:Number(e.target.value)})}>{[0,10,25,50,75,100].map(p=><option key={p} value={p}>{p}%</option>)}</select></label>
        </div>
      </div>)}
      {filteredFlags.length===0&&<p className="text-sm text-[#9AA6BC]">No modules match these filters.</p>}
    </section>
    <section className="space-y-3"><h3 className="text-lg font-semibold flex items-center gap-2"><ShieldAlert size={19}/> Community moderation queue ({queue.length})</h3>
      <p className="text-[#9AA6BC] text-sm">All text posts and comments require human approval. Never mark an account age-verified based on post content or images.</p>
      {queue.map(item=><div className={panel+' space-y-3'} key={item.id}><p className="text-xs text-[#9AA6BC]">{item.content_type} · {new Date(item.created_at).toLocaleString()}</p><p className="text-sm whitespace-pre-wrap break-words">{item.body}</p><div className="flex gap-2"><button className={button} disabled={busy} onClick={()=>review(item.id,'approved')}>Approve</button><button className="bg-red-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={()=>review(item.id,'rejected')}>Reject</button></div></div>)}
      {!queue.length&&<div className={panel}><p className="text-sm text-[#9AA6BC]">Queue empty.</p></div>}
    </section>
  </div>;
}
