/** Voluntary professional-interest suggestions, not inferred sensitive identity. */
import React,{useEffect,useState} from 'react';
import {Sparkles} from 'lucide-react';
import {creatorAi} from './creatorAiApi';
const tags=[
 ['behind_the_scenes','Behind the scenes'],['travel','Travel shoots'],
 ['photography','Photography'],['videography','Videography'],['editing','Video editing'],['studio','Studios'],
 ['outdoor','Outdoor shoots'],['cosplay','Cosplay'],['fashion','Fashion'],['boudoir','Boudoir'],
 ['fetish','Fetish concepts'],['bdsm','BDSM production'],['kink','Kink-friendly production'],
 ['fitness','Fitness'],['lifestyle','Lifestyle'],['podcast','Podcast'],['music','Music'],
 ['night_shoot','Night shoots'],['day_shoot','Day shoots'],['livestream','Livestream']
];
const btn='ccx-secondary min-h-11 rounded-xl px-3 py-2 text-sm disabled:opacity-50';
export default function CreatorAIRecommendations({userId}){
 const [open,setOpen]=useState(false),[opt,setOpt]=useState(false),[chosen,setChosen]=useState([]),[items,setItems]=useState([]);
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;
  void creatorAi('match_preferences').then(result=>{if(active){setOpt(result.item?.opt_in===true);setChosen(result.item?.shared_interests||[]);}},()=>{});
  return()=>{active=false;};
 },[userId]);
 const act=async mode=>{
  setBusy(true);setError('');setNotice('');
  try{
   if(mode==='save'){
    await creatorAi('match_preferences',{save:true,opt_in:opt,interests:chosen});
    setItems([]);setReason('');setNotice(opt?'Your opt-in interests were saved. You can request suggestions now.':'AI matchmaking was disabled and your shared interests cleared.');
   }else{
    const result=await creatorAi('matches');setItems(result.items||[]);setReason(result.note||'');setNotice('Suggestions are based only on interests both members explicitly shared.');
   }
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-3 rounded-xl p-4" data-ai-recommendations="true">
  <button type="button" className={btn+' flex items-center gap-2'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <Sparkles size={17}/>AI-assisted professional suggestions {open?'−':'+'}
  </button>
  {open&&<>
   <p className="text-xs text-[var(--cc-text-secondary)]">Optional. Your exact selected interests are only used for recommendations with other opted-in members. No inference from profile likes, private groups, orientation, ethnicity or medical data. They are never used for advertising or assumed consent.</p>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={opt} onChange={e=>setOpt(e.target.checked)}/>
    I choose to share these professional creative interests for recommendations.
   </label>
   {opt&&<fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <legend className="mb-2 text-xs font-semibold">Selected professional interests</legend>
    {tags.map(([value,label])=><label key={value} className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--cc-border)] px-2 py-2 text-xs">
     <input type="checkbox" checked={chosen.includes(value)} onChange={e=>setChosen(prev=>e.target.checked?[...prev,value]:prev.filter(x=>x!==value))}/>{label}
    </label>)}
   </fieldset>}
   <div className="flex flex-wrap gap-2">
    <button type="button" className={btn} disabled={busy} onClick={()=>void act('save')}>Save recommendation settings</button>
    <button type="button" className="ccx-primary min-h-11 rounded-xl px-4 py-2 text-sm" disabled={busy||!opt||!chosen.length} onClick={()=>void act('generate')}>Suggest collaborators</button>
   </div>
   {items.map(item=><article className="rounded-xl border border-[var(--cc-border)] p-3 text-sm" key={item.user_id}>
    <strong>{item.display_name||'Verified professional'}</strong>
    <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{String(item.role_type||'professional').replaceAll('_',' ')} · {[item.city,item.country].filter(Boolean).join(', ')}</p>
    <p className="mt-1 text-xs">Shared interests: {item.shared_interests.map(tag=>tags.find(([id])=>id===tag)?.[1]||tag).join(', ')}</p>
   </article>)}
   {reason&&<p className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-xs">{reason}</p>}
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
   {notice&&<p role="status" className="text-xs text-[var(--cc-text-secondary)]">{notice}</p>}
  </>}
 </section>;
}
