/** Optional marketplace dashboard section. Uses the SAME approved public listing and user-favorites gateway as Properties.
 * Never query property_private or render exact location, access codes, booking contacts or unapproved listings.
 */
import React,{useEffect,useState} from 'react';
import {MapPin,ArrowRight,Heart} from 'lucide-react';
import {hostingAction} from './hostingApi';
export default function DashboardProperties({onNavigate}){
 const [list,setList]=useState([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  (async()=>{
   try{
    const [fav,browse]=await Promise.all([hostingAction('favorites'),hostingAction('browse',{})]);
    if(!alive)return;
    const saved=new Set(fav.ids||[]);
    const approved=(browse.items||[]).filter(item=>item&&saved.has(item.id));
    setList(approved.slice(0,9));
   }catch(e){if(alive)setError(e.message||'Could not load properties.');}
   finally{if(alive)setBusy(false);}
  })();
  return()=>{alive=false;};
 },[]);
 return <div className="space-y-4">
  <p className="text-sm text-[var(--cc-text-secondary)]">Your saved, publicly approved marketplace properties. Exact addresses are never shown here.</p>
  {busy&&<p role="status" className="text-sm">Loading saved properties…</p>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {!busy&&!error&&!list.length&&<p className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4 text-sm">No saved properties are available yet. Browse Properties to find locations for your work.</p>}
  {list.length>0&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {list.map(p=><button type="button" key={p.id} onClick={()=>onNavigate('hosting')} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-blue)]">
    <div className="flex aspect-[16/7] items-center justify-center bg-[var(--cc-surface-hover)]"><Heart className="text-[var(--cc-blue)]" size={28} aria-hidden="true"/></div>
    <div className="min-w-0 space-y-2 p-3"><strong className="block truncate text-sm">{p.title||'Production property'}</strong><p className="flex items-center gap-1 text-xs text-[var(--cc-text-secondary)]"><MapPin size={14} aria-hidden="true"/><span className="truncate">{[p.city,p.state,p.country].filter(Boolean).join(', ')||'Location available on listing'}</span></p><span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cc-link)]">View in Properties <ArrowRight size={13}/></span></div>
   </button>)}
  </div>}
  <button type="button" className="ccx-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm" onClick={()=>onNavigate('hosting')}>Browse all properties <ArrowRight size={15}/></button>
 </div>;
}
