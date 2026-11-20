/** Private-by-default travel/availability calendar.
 * Shows only member-authorized city/date information, never hotel or GPS data.
 */
import React,{useEffect,useState} from 'react';
import {CalendarDays,Plus,Trash2} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const field='mt-1 min-h-11 w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2 text-sm';
async function call(action,extra={}){
 const {data,error}=await supabase.functions.invoke('creator-extensions',{body:{action,...extra}});
 if(error||data?.error){let msg=data?.error||'Travel calendar unavailable';if(error?.context?.json)try{msg=(await error.context.json()).error||msg;}catch{}throw Error(msg);}
 return data;
}
const initial={entry_type:'travel',city:'',state:'',country:'United States',starts_on:'',ends_on:'',visibility:'only_me',note:''};
export default function ProfileTravelCalendar({userId,currentUserId=userId}){
 const own=userId===currentUserId;
 const [entries,setEntries]=useState([]),[form,setForm]=useState(initial),[editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setBusy(true);setError('');
  try{const response=await call('travel_list',{user_id:userId});setEntries(response.items||[]);}catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{if(userId&&currentUserId)void load();},[userId,currentUserId]);
 const save=async e=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await call('travel_save',{item:form});setForm(initial);setEditing(false);setNotice('Travel calendar updated. Only the chosen audience can see it.');
   const response=await call('travel_list',{user_id:userId});setEntries(response.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const remove=async id=>{
  if(!window.confirm('Remove this calendar entry?'))return;
  setBusy(true);setError('');
  try{await call('travel_remove',{id});setEntries(prev=>prev.filter(e=>e.id!==id));}catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-3 rounded-xl p-4 sm:p-5" data-profile-travel="true">
  <header className="flex items-start justify-between gap-3">
   <div><h3 className="flex items-center gap-2 font-semibold"><CalendarDays size={18}/>Travel and availability calendar</h3>
    <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">City-level dates only; specific venues and hotel locations stay private.</p></div>
   {own&&<button type="button" className="ccx-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs" onClick={()=>setEditing(v=>!v)}><Plus size={16}/>{editing?'Cancel':'Add dates'}</button>}
  </header>
  {own&&editing&&<form onSubmit={save} className="space-y-3 rounded-xl border border-[var(--cc-border)] p-3">
   <div className="grid gap-2 sm:grid-cols-2">
    <label className="text-xs">Calendar entry type<select className={field} value={form.entry_type} onChange={e=>setForm(v=>({...v,entry_type:e.target.value}))}><option value="travel">Traveling to</option><option value="available">Available in</option><option value="unavailable">Unavailable in</option></select></label>
    <label className="text-xs">Who can see this<select className={field} value={form.visibility} onChange={e=>setForm(v=>({...v,visibility:e.target.value}))}><option value="only_me">Only me</option><option value="friends">Accepted friends</option><option value="verified">Verified community</option></select></label>
    <label className="text-xs">City<input className={field} value={form.city} required maxLength={120} onChange={e=>setForm(v=>({...v,city:e.target.value}))}/></label>
    <label className="text-xs">Country<input className={field} value={form.country} required maxLength={100} onChange={e=>setForm(v=>({...v,country:e.target.value}))}/></label>
    <label className="text-xs">Start date<input type="date" className={field} value={form.starts_on} required onChange={e=>setForm(v=>({...v,starts_on:e.target.value}))}/></label>
    <label className="text-xs">End date<input type="date" className={field} value={form.ends_on} min={form.starts_on||undefined} required onChange={e=>setForm(v=>({...v,ends_on:e.target.value}))}/></label>
   </div>
   <p className="text-xs text-[var(--cc-text-secondary)]">Do not include exact addresses, accommodations or private contact information.</p>
   <button className="ccx-primary min-h-11 rounded-xl px-4 py-2 text-sm" type="submit" disabled={busy||!form.city.trim()||!form.starts_on||!form.ends_on}>Save calendar dates</button>
  </form>}
  {entries.map(entry=><article key={entry.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--cc-border)] px-3 py-3 text-sm">
   <div><strong className="capitalize">{entry.entry_type.replaceAll('_',' ')}</strong><span> · {entry.city}, {entry.country}</span>
    <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{entry.starts_on} – {entry.ends_on}{own?' · '+entry.visibility.replaceAll('_',' '):''}</p></div>
   {own&&<button type="button" aria-label="Remove travel entry" className="ccx-secondary grid min-h-10 min-w-10 place-items-center rounded-lg" disabled={busy} onClick={()=>void remove(entry.id)}><Trash2 size={16}/></button>}
  </article>)}
  {!entries.length&&!busy&&<p className="text-sm text-[var(--cc-text-secondary)]">No shared travel or availability dates.</p>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
  {notice&&<p role="status" className="text-xs text-[var(--cc-text-secondary)]">{notice}</p>}
 </section>;
}
