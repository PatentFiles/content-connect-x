import React,{useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,MapPin,Plus,Trash2,Pencil,X} from 'lucide-react';
import {suiteAction} from './collabSuiteApi';
import {supabase} from '@/api/supabaseClient';

const button='ccx-secondary min-h-10 rounded-xl px-3 py-2 text-sm disabled:opacity-50';
const input='mt-1 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2.5 text-sm';
const iso=v=>String(v||'').slice(0,10);
const destination=e=>[e.city,e.region,e.country].filter(Boolean).join(', ');
const blank=()=>({id:null,city:'',region:'',country:'United States',starts_at:'',ends_at:'',note:'',visible_to_members:true});
const overlaps=(aStart,aEnd,bStart,bEnd)=>aStart<=bEnd&&bStart<=aEnd;
const pretty=v=>{const [y,m,d]=iso(v).split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)&&Number.isFinite(d)?new Date(y,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';};

export default function TravelCalendar({userId,viewerId=userId}){
 const own=userId===viewerId;
 const [items,setItems]=useState([]),[month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [form,setForm]=useState(blank),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false);
 const [blocks,setBlocks]=useState([]),[blockStart,setBlockStart]=useState(''),[blockEnd,setBlockEnd]=useState(''),[showBlockForm,setShowBlockForm]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setError('');
  try{
   // The server paginates for stability, but never imposes a user trip-count limit.
   let result=[],offset=0,more=true;
   while(more){
    const page=await suiteAction('travel_list',{user_id:userId,offset});
    result=result.concat(page.items||[]);
    if(offset===0&&!own)setBlocks(page.blocks||[]);
    more=page.has_more===true;
    offset=page.next_offset||offset+(page.items||[]).length;
    if(more&&(!page.items?.length||result.length>20000))throw Error('Too many records to display at once. Refresh your calendar.');
   }
   setItems(result);
   if(own){
    const {data:blocked,error:blockError}=await supabase.from('ccx_calendar_blocks').select('id,starts_on,ends_on').eq('user_id',userId).order('starts_on',{ascending:true}).limit(300);
    if(blockError)throw blockError;
    setBlocks(blocked||[]);
   }
  }catch(e){setError(e.message||'Unable to load travel calendar');}
 };
 useEffect(()=>{void load();},[userId]);
 const days=useMemo(()=>{
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  return [...Array(first.getDay()).fill(null),...Array.from({length:count},(_,i)=>i+1)];
 },[month]);
 const editTrip=item=>{
  setForm({id:item.id,city:item.city,region:item.region,country:item.country,starts_at:iso(item.starts_at),ends_at:iso(item.ends_at),note:item.note||'',visible_to_members:item.visible_to_members!==false});
  const d=new Date(item.starts_at);setMonth(new Date(d.getUTCFullYear(),d.getUTCMonth(),1));
  setEditing(true);setError('');setNotice('');
 };
 const update=(key,value)=>setForm(old=>({...old,[key]:value}));
 const conflict=items.find(e=>e.id!==form.id&&form.starts_at&&form.ends_at&&overlaps(form.starts_at,form.ends_at,iso(e.starts_at),iso(e.ends_at)));
 const save=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(form.starts_at)||!/^\d{4}-\d{2}-\d{2}$/.test(form.ends_at)||form.ends_at<form.starts_at)
    throw Error('Select a valid arrival date and an equal or later departure date.');
   if(conflict)throw Error('These dates conflict with your trip to '+destination(conflict)+' ('+pretty(conflict.starts_at)+' – '+pretty(conflict.ends_at)+'). Change the dates or edit the existing trip.');
   await suiteAction('travel_save',{...form,id:form.id||undefined,
    starts_at:form.starts_at+'T00:00:00Z',ends_at:form.ends_at+'T23:59:59Z'});
   setForm(blank());setEditing(false);setNotice('Travel dates saved.');await load();
  }catch(e){setError(e.message||'Unable to save travel dates');}finally{setBusy(false);}
 };
 const saveBlock=async()=>{
  if(!own||busy)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(blockStart)||!/^\d{4}-\d{2}-\d{2}$/.test(blockEnd)||blockStart>blockEnd){
   setError('Choose a valid start and end date.');return;
  }
  const startMs=Date.parse(blockStart+'T00:00:00Z'),endMs=Date.parse(blockEnd+'T00:00:00Z');
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs-startMs>365*86400000){
   setError('You can block up to 366 days at a time.');return;
  }
  setBusy(true);setError('');setNotice('');
  try{
   const {error:failure}=await supabase.from('ccx_calendar_blocks').insert({user_id:userId,starts_on:blockStart,ends_on:blockEnd});
   if(failure)throw failure;
   setBlockStart('');setBlockEnd('');setShowBlockForm(false);setNotice('Unavailable dates saved.');await load();
  }catch(e){setError(e.message||'Could not block dates');}finally{setBusy(false);}
 };
 const removeBlock=async id=>{
  if(!own||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {error:failure}=await supabase.from('ccx_calendar_blocks').delete().eq('id',id).eq('user_id',userId);
   if(failure)throw failure;
   setNotice('Blocked dates removed.');await load();
  }catch(e){setError(e.message||'Unable to remove blocked dates');}finally{setBusy(false);}
 };
 const remove=async id=>{
  setBusy(true);setError('');setNotice('');
  try{await suiteAction('travel_delete',{id});setNotice('Travel dates deleted.');await load();}
  catch(e){setError(e.message||'Could not delete the trip');}finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-4 p-5" aria-label="Travel calendar" data-travel-calendar="true">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={19}/>Travel calendar</h3>
    <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Where {own?'you are':'this member is'} traveling and when. Travel dates cannot overlap, even in different cities.</p>
   </div>
   <div className="flex flex-wrap gap-2">{own&&<button type="button" className={button} onClick={()=>setShowBlockForm(v=>!v)}>{showBlockForm?'Close availability':'Block dates'}</button>}
   {own&&<button type="button" className={button} onClick={()=>{if(editing){setEditing(false);setForm(blank());}else{setEditing(true);setForm(blank());}setError('');}}>
    {editing?<X size={16} className="mr-1 inline"/>:<Plus size={16} className="mr-1 inline"/>}{editing?'Close':'Add a trip'}
   </button>}</div>
  </div>
  {showBlockForm&&own&&<section className="grid gap-3 rounded-xl border border-[var(--cc-border)] p-4 sm:grid-cols-2" aria-label="Block unavailable dates">
    <label className="text-sm">Unavailable from<input type="date" className={input} value={blockStart} onChange={e=>setBlockStart(e.target.value)}/></label>
    <label className="text-sm">Unavailable through<input type="date" min={blockStart||undefined} className={input} value={blockEnd} onChange={e=>setBlockEnd(e.target.value)}/></label>
    <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm sm:col-span-2" disabled={busy||!blockStart||!blockEnd||blockEnd<blockStart} onClick={()=>void saveBlock()}>Save blocked dates</button>
   </section>}
  <div className="flex items-center justify-between">
   <button type="button" className={button} aria-label="Previous month" onClick={()=>setMonth(v=>new Date(v.getFullYear(),v.getMonth()-1,1))}><ChevronLeft/></button>
   <h4 className="font-semibold">{month.toLocaleString(undefined,{month:'long',year:'numeric'})}</h4>
   <button type="button" className={button} aria-label="Next month" onClick={()=>setMonth(v=>new Date(v.getFullYear(),v.getMonth()+1,1))}><ChevronRight/></button>
  </div>
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
  <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs">
   {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><b key={day} className="py-1">{day}</b>)}
   {days.map((day,i)=>{
    if(!day)return <span key={'pad-'+i}/>;
    const date=new Date(Date.UTC(month.getFullYear(),month.getMonth(),day)).toISOString().slice(0,10);
    const trip=items.find(e=>iso(e.starts_at)<=date&&iso(e.ends_at)>=date);
    const blocked=blocks.some(b=>b.starts_on<=date&&b.ends_on>=date);
    return <div key={date} title={blocked?'Unavailable: '+date:trip?destination(trip)+' · '+pretty(trip.starts_at)+' – '+pretty(trip.ends_at):date}
      className={'min-h-12 rounded-lg border p-1 text-left sm:min-h-16 '+(blocked?'border-red-400 bg-red-100 text-red-900':trip?'border-[var(--cc-link)] bg-[var(--cc-surface-hover)]':'border-[var(--cc-border)]')}>
      <span className="block text-center font-medium">{day}</span>
      {blocked&&<span className="mt-1 block truncate text-center text-[9px] font-semibold sm:text-[11px]">Blocked</span>}
      {trip&&!blocked&&<span className="mt-1 block truncate rounded-sm px-1 text-center text-[9px] font-semibold text-[var(--cc-link)] sm:text-[11px]">{trip.city}</span>}
     </div>;
   })}
  </div>
  <aside className="space-y-2 rounded-xl border border-[var(--cc-border)] p-3" aria-label="Travel destinations and dates"><h4 className="font-semibold">Travel plans</h4>
   {items.map(t=><div key={t.id} className="space-y-2 rounded-lg border border-[var(--cc-border)] p-3 text-xs">
    <p className="flex items-center gap-1 font-semibold"><MapPin size={14}/>{destination(t)}</p>
    <p className="mt-1 text-[var(--cc-text-secondary)]">{pretty(t.starts_at)} – {pretty(t.ends_at)}</p>
    {own&&<div className="flex flex-wrap gap-2">
     <button type="button" className={button} disabled={busy} onClick={()=>editTrip(t)} aria-label={'Edit trip to '+t.city}><Pencil size={14}/>Edit</button>
     <button type="button" className={button} disabled={busy} onClick={()=>void remove(t.id)} aria-label={'Delete trip to '+t.city}><Trash2 size={14}/>Remove</button>
    </div>}
   </div>)}
   {own&&blocks.map(b=><div key={b.id} className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800"><span>Unavailable<br/>{pretty(b.starts_on)} – {pretty(b.ends_on)}</span><button type="button" disabled={busy} onClick={()=>void removeBlock(b.id)} aria-label={'Remove blocked dates '+b.starts_on}><Trash2 size={14}/></button></div>)}
  </aside>
  </div>
  {error&&<p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="text-sm text-[var(--cc-text-secondary)]">{notice}</p>}
  {editing&&own&&<div className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4">
   <h4 className="font-semibold">{form.id?'Edit trip':'Add travel destination'}</h4>
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="text-sm">City<input className={input} maxLength={100} value={form.city} onChange={e=>update('city',e.target.value)}/></label>
    <label className="text-sm">State/region<input className={input} maxLength={100} value={form.region} onChange={e=>update('region',e.target.value)}/></label>
    <label className="text-sm">Country<input className={input} maxLength={100} value={form.country} onChange={e=>update('country',e.target.value)}/></label>
   </div>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Arriving<input className={input} type="date" value={form.starts_at} onChange={e=>update('starts_at',e.target.value)}/></label>
    <label className="text-sm">Leaving<input className={input} type="date" min={form.starts_at||undefined} value={form.ends_at} onChange={e=>update('ends_at',e.target.value)}/></label>
   </div>
   {conflict&&<p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">Conflicts with {destination(conflict)} ({pretty(conflict.starts_at)} – {pretty(conflict.ends_at)}). Only one travel location is allowed on any date.</p>}
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.visible_to_members} onChange={e=>update('visible_to_members',e.target.checked)}/>Show this trip to other verified members</label>
   <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy||Boolean(conflict)||!form.city.trim()||!form.country.trim()||!form.starts_at||!form.ends_at||form.ends_at<form.starts_at} onClick={()=>void save()}>{busy?'Saving…':form.id?'Update trip':'Save trip'}</button>
  </div>}
 </section>;
}
