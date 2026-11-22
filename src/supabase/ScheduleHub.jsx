import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin, Plane, Trash2, Search } from 'lucide-react';
import { platformAction } from './platformApi';

const panel='rounded-xl bg-[var(--cc-surface-subtle)] border border-[var(--cc-border)] p-5';
const control='rounded-lg bg-[var(--cc-surface-subtle)] text-[var(--cc-text-primary)] border border-[var(--cc-border)] p-2 w-full';
const button='rounded-lg ccx-action-primary text-[var(--cc-text-primary)] font-semibold text-sm px-4 py-2 disabled:opacity-50';

export default function ScheduleHub({paid=false,userId,creatorBookingEnabled=false}){
  const [list,setList]=useState([]);
  const [mine,setMine]=useState([]);
  const [overlaps,setOverlaps]=useState([]);
  const [bookings,setBookings]=useState([]);
  const [hostId,setHostId]=useState('');
  const [bookStart,setBookStart]=useState('');
  const [bookEnd,setBookEnd]=useState('');
  const [bookNotes,setBookNotes]=useState('');
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
      const [results,own,bookingData]=await Promise.all([
        platformAction('availability_list',{city:searchCity}),
        paid?platformAction('availability_my'):Promise.resolve({items:[]}),
        platformAction('creator_bookings_list'),
      ]);
      setList(results.items||[]);
      setMine(own.items||[]);
      setBookings(bookingData.items||[]);
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
  const requestBooking=async(event)=>{
    event.preventDefault();setError('');setInfo('');setBusy(true);
    try{
      await platformAction('creator_bookings_request',{
        host_id:hostId,starts_at:new Date(bookStart).toISOString(),
        ends_at:new Date(bookEnd).toISOString(),notes:bookNotes
      });
      setInfo('Booking requested. The host must confirm your proposed time.');
      setHostId('');setBookStart('');setBookEnd('');setBookNotes('');
      await load(search);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const respondBooking=async(id,status)=>{
    setBusy(true);setError('');setInfo('');
    try{
      await platformAction('creator_bookings_respond',{id,status});
      setInfo('Booking '+status+'.');await load(search);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const cancelBooking=async(id)=>{
    if(!window.confirm('Cancel this booking request?'))return;
    setBusy(true);setError('');
    try{await platformAction('creator_bookings_cancel',{id});await load(search);setInfo('Booking cancelled.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };

  const checkOverlaps=async()=>{
    setError('');setBusy(true);
    try{
      const result=await platformAction('availability_overlaps');
      setOverlaps(result.items||[]);
      setInfo(result.items?.length?'Found '+result.items.length+' travel overlaps.':'No matching travel dates yet.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const exportCalendar=()=>{
    const escape=(v)=>String(v||'').replaceAll('\\','\\\\').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\n','\\n');
    const utc=(date)=>new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const events=mine.map(item=>[
      'BEGIN:VEVENT','UID:'+item.id+'@contentconnectx.com','DTSTAMP:'+utc(new Date()),
      'DTSTART:'+utc(item.starts_at),'DTEND:'+utc(item.ends_at),
      'SUMMARY:'+escape('Content ConnectX: '+item.kind+' in '+item.city),
      'LOCATION:'+escape(item.city+', '+item.country),
      'DESCRIPTION:'+escape(item.note||'Professional availability'),
      'END:VEVENT'
    ].join('\r\n')).join('\r\n');
    const payload='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Content ConnectX//Availability//EN\r\n'+events+'\r\nEND:VCALENDAR\r\n';
    const file=new Blob([payload],{type:'text/calendar;charset=utf-8'});
    const url=URL.createObjectURL(file);
    const anchor=document.createElement('a');anchor.href=url;anchor.download='content-connect-x-availability.ics';
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const short=(value)=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
  return <section className="space-y-5">
    <div><h2 className="text-2xl font-semibold flex gap-2 items-center"><CalendarDays size={24}/> Creator availability</h2><p className="text-sm text-[var(--cc-text-secondary)] mt-1">Find travel overlaps, production windows and studio availability by city. Exact home addresses are never exposed.</p></div>
    {error&&<p className="bg-red-50 rounded-lg p-3 text-red-800 text-sm" role="alert">{error}</p>}
    {info&&<p className="bg-emerald-50 rounded-lg p-3 text-emerald-800 text-sm" role="status">{info}</p>}
    <form className={panel+' flex flex-wrap gap-3 items-end'} onSubmit={e=>{e.preventDefault();load(search);}}>
      <label className="flex-1 min-w-[180px] text-sm">Search by city<input className={control+' mt-1'} value={search} onChange={e=>setSearch(e.target.value)} placeholder="e.g., Los Angeles" maxLength={100}/></label>
      <button className={button} disabled={busy}><Search size={16} className="inline mr-1"/>Search</button>
    </form>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {list.map(item=><article className={panel} key={item.id}>
        <h3 className="font-semibold flex gap-2 items-center"><MapPin size={16} className="text-[var(--cc-text-secondary)]"/>{item.city}, {item.country}</h3>
        <p className="text-sm text-[var(--cc-text-secondary)] capitalize">{item.kind.replaceAll('_',' ')} · {item.region||'Travel schedule'}</p>
        <p className="text-sm mt-3">{short(item.starts_at)}</p><p className="text-sm text-[var(--cc-text-secondary)]">Through {short(item.ends_at)}</p>
        {item.note&&<p className="text-sm mt-3 whitespace-pre-wrap">{item.note}</p>}
        {paid&&creatorBookingEnabled&&['shoot','studio'].includes(item.kind)&&<button className={button+' mt-3'} onClick={()=>{setHostId(item.user_id);setBookStart('');setBookEnd('');}} disabled={busy}>Request shoot booking</button>}
      </article>)}
    </div>
    {!list.length&&<div className={panel}><p className="text-[var(--cc-text-secondary)] text-sm">No matching published availability. Search another city or date.</p></div>}
    {!paid&&<p className="text-[var(--cc-text-secondary)] text-sm">Premium members can list their own shoot dates and see additional availability entries.</p>}
    {paid&&creatorBookingEnabled&&<form className={panel+' space-y-3'} onSubmit={requestBooking}>
      <h3 className="font-semibold">Request a creator shoot slot</h3>
      <p className="text-xs text-[var(--cc-text-secondary)]">Only accepted mutual connections can request times that the host listed for shoots or studios. Requests do not reserve or charge anyone until confirmed.</p>
      <label className="text-sm block">Creator member ID<input className={control+' mt-1'} required value={hostId} onChange={e=>setHostId(e.target.value)} placeholder="Verified host UUID"/></label>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Start<input type="datetime-local" required className={control+' mt-1'} value={bookStart} onChange={e=>setBookStart(e.target.value)}/></label><label className="text-sm">End<input type="datetime-local" required className={control+' mt-1'} value={bookEnd} onChange={e=>setBookEnd(e.target.value)}/></label></div>
      <label className="block text-sm">Message for host<textarea className={control+' mt-1'} maxLength={1000} rows={2} value={bookNotes} onChange={e=>setBookNotes(e.target.value)}/></label>
      <button className={button} disabled={busy||!hostId||!bookStart||!bookEnd}>Send booking request</button>
    </form>}
    <div className={panel+' space-y-3'}><h3 className="font-semibold">Creator booking requests</h3>
      {!bookings.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No private booking requests yet.</p>}
      {bookings.map(item=><div className="border-b border-[var(--cc-border)] pb-3 space-y-2" key={item.id}>
        <p className="text-sm font-semibold">{item.status} · {short(item.starts_at)}</p>
        <p className="text-xs text-[var(--cc-text-secondary)]">Host: {item.host_id} · Requester: {item.requester_id}</p>
        <p className="text-sm">{item.notes}</p>
        <div className="flex flex-wrap gap-2">{item.host_id===userId&&item.status==='requested'&&<><button className={button} disabled={busy} onClick={()=>respondBooking(item.id,'confirmed')}>Confirm</button><button className={button} disabled={busy} onClick={()=>respondBooking(item.id,'declined')}>Decline</button></>}
        {['requested','confirmed'].includes(item.status)&&<button className={button} disabled={busy} onClick={()=>cancelBooking(item.id)}>Cancel</button>}</div>
      </div>)}
    </div>
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
        <div className="flex flex-wrap gap-2"><button disabled={!mine.length||busy} className={button} onClick={exportCalendar}>Export iCalendar (.ics)</button><button disabled={!mine.length||busy} className={button} onClick={checkOverlaps}>Find date overlaps</button></div>
        {!!overlaps.length&&<div className="bg-[var(--cc-surface-subtle)] rounded-lg p-3 space-y-2"><h4 className="font-semibold text-sm">Matching creators and shared windows</h4>{overlaps.map((m,i)=><div key={m.user_id+'-'+i} className="text-xs border-b border-[var(--cc-border)] pb-2"><strong>{m.city}, {m.country}</strong> · {short(m.starts_at)} to {short(m.ends_at)} · {m.overlap_hours} hours · Member: {m.user_id}</div>)}</div>}

        {!mine.length&&<p className="text-sm text-[var(--cc-text-secondary)]">You have no scheduled entries yet.</p>}
        {mine.map(entry=><div key={entry.id} className="flex items-center justify-between gap-2 border-b border-[var(--cc-border)] pb-2">
          <span className="text-sm">{entry.city} · {short(entry.starts_at)} · {entry.kind}</span>
          <button aria-label="Remove availability" title="Remove availability" onClick={()=>remove(entry.id)} disabled={busy} className="text-red-800"><Trash2 size={17}/></button>
        </div>)}
      </div>
    </>}
  </section>;
}
