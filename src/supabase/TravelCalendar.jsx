import React,{useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,MapPin,Plus,Trash2} from 'lucide-react';
import {suiteAction} from './collabSuiteApi';
const style='ccx-secondary min-h-10 rounded-xl px-3 py-2 text-sm';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2.5 text-sm';
const date=s=>String(s||'').slice(0,10);
export default function TravelCalendar({userId,viewerId=userId}){
 const own=userId===viewerId;
 const [items,setItems]=useState([]),[month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [form,setForm]=useState({city:'',region:'',country:'United States',starts_at:'',ends_at:'',note:'',visible_to_members:true});
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{try{const result=await suiteAction('travel_list',{user_id:userId});setItems(result.items||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();},[userId]);
 const days=useMemo(()=>{
  const first=new Date(month.getFullYear(),month.getMonth(),1),total=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  return [...Array(first.getDay()).fill(null),...Array.from({length:total},(_,i)=>i+1)];
 },[month]);
 const move=n=>setMonth(old=>new Date(old.getFullYear(),old.getMonth()+n,1));
 const update=(key,value)=>setForm(old=>({...old,[key]:value}));
 const save=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   if(!form.starts_at||!form.ends_at)throw Error('Select arrival and departure dates');
   await suiteAction('travel_save',{...form,starts_at:form.starts_at+'T00:00:00Z',ends_at:form.ends_at+'T23:59:59Z'});
   setForm({city:'',region:'',country:'United States',starts_at:'',ends_at:'',note:'',visible_to_members:true});
   setEditing(false);setNotice('Travel dates saved.');await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const remove=async id=>{setBusy(true);setError('');try{await suiteAction('travel_delete',{id});await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="ccx-surface space-y-4 p-5" aria-label="Travel calendar" data-travel-calendar="true">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={18}/>Travel calendar</h3>{own&&<button type="button" className={style} onClick={()=>setEditing(v=>!v)}><Plus size={15} className="mr-1 inline"/>Add travel dates</button>}</div>
  <div className="flex items-center justify-between"><button type="button" className={style} onClick={()=>move(-1)} aria-label="Previous month"><ChevronLeft/></button><h4 className="font-medium">{month.toLocaleString(undefined,{month:'long',year:'numeric'})}</h4><button type="button" className={style} onClick={()=>move(1)} aria-label="Next month"><ChevronRight/></button></div>
  <div className="grid grid-cols-7 gap-1 text-center text-xs">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><b key={d} className="p-1">{d}</b>)}
   {days.map((day,index)=>{
    if(!day)return <span key={'pad-'+index}/>;
    const stamp=new Date(Date.UTC(month.getFullYear(),month.getMonth(),day)).toISOString().slice(0,10);
    const traveling=items.some(entry=>date(entry.starts_at)<=stamp&&date(entry.ends_at)>=stamp);
    return <div key={stamp} title={traveling?'Travel scheduled':''} className={'rounded-md border p-2 '+(traveling?'border-[var(--cc-link)] bg-[var(--cc-surface-hover)]':'border-[var(--cc-border)]')}>{day}</div>;
   })}</div>
  {items.length===0&&<p className="text-sm text-[var(--cc-text-secondary)]">No travel dates shared.</p>}
  <div className="space-y-2">{items.map(entry=><div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cc-border)] p-2 text-sm"><div><p className="flex gap-1 font-medium"><MapPin size={16}/>{[entry.city,entry.region,entry.country].filter(Boolean).join(', ')}</p><p className="text-xs text-[var(--cc-text-secondary)]">{date(entry.starts_at)} – {date(entry.ends_at)}{own&&!entry.visible_to_members?' · Private':''}</p></div>{own&&<button type="button" disabled={busy} className={style} onClick={()=>void remove(entry.id)} aria-label="Delete travel date"><Trash2 size={16}/></button>}</div>)}</div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
  {editing&&own&&<div className="space-y-3 border-t border-[var(--cc-border)] pt-4"><div className="grid gap-3 sm:grid-cols-3">
   <label className="text-sm">City<input className={input} value={form.city} maxLength={100} onChange={e=>update('city',e.target.value)}/></label>
   <label className="text-sm">State/region<input className={input} value={form.region} maxLength={100} onChange={e=>update('region',e.target.value)}/></label>
   <label className="text-sm">Country<input className={input} value={form.country} maxLength={100} onChange={e=>update('country',e.target.value)}/></label></div>
   <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Arrival<input className={input} type="date" value={form.starts_at} onChange={e=>update('starts_at',e.target.value)}/></label><label className="text-sm">Departure<input className={input} type="date" min={form.starts_at||undefined} value={form.ends_at} onChange={e=>update('ends_at',e.target.value)}/></label></div>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visible_to_members} onChange={e=>update('visible_to_members',e.target.checked)}/>Show this destination to verified members</label>
   <button type="button" className="ccx-primary rounded-xl px-4 py-2" disabled={busy||!form.city||!form.country||!form.starts_at||!form.ends_at} onClick={()=>void save()}>{busy?'Saving…':'Save travel dates'}</button>
  </div>}
 </section>;
}