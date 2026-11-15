import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin, Plane, Trash2, Search } from 'lucide-react';
import { platformAction } from './platformApi';

const panel='rounded-xl bg-[#151D2B] border border-[#263248] p-5';
const control='rounded-lg bg-[#0F1520] text-white border border-[#34445D] p-2 w-full';
const button='rounded-lg bg-[#4F8CFF] text-white font-semibold text-sm px-4 py-2 disabled:opacity-50';

export default function ScheduleHub({paid=false}){
  const [list,setList]=useState([]);
  const [mine,setMine]=useState([]);
  const [city,setCity]=useState('');
  const [search,setSearch]=useState('');
  const [type,setType]=useState('travel');
  const [visibility,setVisibility]=useState('verified');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [country,setCountry]=useState('');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');

  const load=useCallback(async(searchCity='')=>{
    setError('');setBusy(true);
    try{
      const [results,own]=await Promise.all([
        platformAction('availability_list',{city:searchCity}),
        paid?platformAction('availability_my'):Promise.resolve({items:[]}),
      ]);
      setList(results.items||[]);
      setMine(own.items||[]);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  },[paid]);
  useEffect(()=>{load('');},[load]);

  const submit=async(event)=>{
    event.preventDefault();setError('');setInfo('');setBusy(true);
    try{
      await platformAction('availability_create',{
        kind:type, city, country, note, visibility,
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',
        starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()
      });
      setInfo('Availability added. Other eligible members can now find your dates.');
      setStart('');setEnd('');setNote('');
      await load(search);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const remove=async(id)=>{
    setBusy(true);setError('');
    try{await platformAction('availability_delete',{id});await load(search);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const short=(value)=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  return <section className="space-y-5">
    <div><h2 className="text-2xl font-semibold flex gap-2 items-center"><CalendarDays size={24}/> Creator availability</h2><p className="text-sm text-[#9AA6BC] mt-1">Find travel overlaps, production windows and studio availability by city. Exact home addresses are never exposed.</p></div>
    {error&&<p className="bg-red-950 rounded-lg p-3 text-red-200 text-sm" role="alert">{error}</p>}
    {info&&<p className="bg-emerald-950 rounded-lg p-3 text-emerald-200 text-sm" role="status">{info}</p>}
    <form className={panel+' flex flex-wrap gap-3 items-end'} onSubmit={e=>{e.preventDefault();load(search);}}>
      <label className="flex-1 min-w-[180px] text-sm">Search by city<input className={control+' mt-1'} value={search} onChange={e=>setSearch(e.target.value)} placeholder="e.g., Los Angeles" maxLength={100}/></label>
      <button className={button} disabled={busy}><Search size={16} className="inline mr-1"/>Search</button>
    </form>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {list.map(item=><article className={panel} key={item.id}>
        <h3 className="font-semibold flex gap-2 items-center"><MapPin size={16} className="text-blue-400"/>{item.city}, {item.country}</h3>
        <p className="text-sm text-[#9AA6BC] capitalize">{item.kind.replaceAll('_',' ')} · {item.region||'Travel schedule'}</p>
        <p className="text-sm mt-3">{short(item.starts_at)}</p><p className="text-sm text-[#9AA6BC]">Through {short(item.ends_at)}</p>
        {item.note&&<p className="text-sm mt-3 whitespace-pre-wrap">{item.note}</p>}
      </article>)}
    </div>
    {!list.length&&<div className={panel}><p className="text-[#9AA6BC] text-sm">No matching published availability. Search another city or date.</p></div>}
    {!paid&&<p className="text-[#9AA6BC] text-sm">Premium members can list their own shoot dates and see additional availability entries.</p>}
    {paid&&<>
      <form className={panel+' space-y-4'} onSubmit={submit}>
        <h3 className="font-semibold flex gap-2 items-center"><Plane size={18}/> Publish availability</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">City<input required minLength={2} className={control+' mt-1'} value={city} onChange={e=>setCity(e.target.value)}/></label>
          <label className="text-sm">Country<input required minLength={2} className={control+' mt-1'} value={country} onChange={e=>setCountry(e.target.value)}/></label>
          <label className="text-sm">Start (your time zone)<input required type="datetime-local" className={control+' mt-1'} value={start} onChange={e=>setStart(e.target.value)}/></label>
          <label className="text-sm">End (your time zone)<input required type="datetime-local" className={control+' mt-1'} value={end} onChange={e=>setEnd(e.target.value)}/></label>
          <label className="text-sm">Type<select className={control+' mt-1'} value={type} onChange={e=>setType(e.target.value)}>{['travel','shoot','studio','unavailable'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="text-sm">Visibility<select className={control+' mt-1'} value={visibility} onChange={e=>setVisibility(e.target.value)}>{['verified','connections','private'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
        </div>
        <label className="text-sm block">Note (no private addresses)<textarea className={control+' mt-1'} maxLength={500} rows={2} value={note} onChange={e=>setNote(e.target.value)}/></label>
        <button className={button} disabled={busy}>Add dates</button>
      </form>
      <div className={panel+' space-y-3'}>
        <h3 className="font-semibold">Manage your listings</h3>
        {!mine.length&&<p className="text-sm text-[#9AA6BC]">You have no scheduled entries yet.</p>}
        {mine.map(entry=><div key={entry.id} className="flex items-center justify-between gap-2 border-b border-[#263248] pb-2">
          <span className="text-sm">{entry.city} · {short(entry.starts_at)} · {entry.kind}</span>
          <button aria-label="Remove availability" title="Remove availability" onClick={()=>remove(entry.id)} disabled={busy} className="text-red-300"><Trash2 size={17}/></button>
        </div>)}
      </div>
    </>}
  </section>;
}
