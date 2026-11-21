/** Content Connect X property discovery and booking.
 * Host Connect X owns every listing, blackout and reservation; this component
 * is a read/write *client* of that canonical inventory, never a local cache.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {Search,CalendarDays,MapPin,Home,ArrowLeft,RefreshCw,ExternalLink,ShieldCheck} from 'lucide-react';
import {hostConnectAction} from './hostConnectApi';
import {venueDateToIso,nightsBetween} from './hostingDateRange.mjs';
import HostDialog from './HostDialog';
import GeoLocationSelect,{EMPTY_GEO} from './GeoLocationSelect';
import HostGuestInspection from './HostGuestInspection';
import {uploadHostGuestEvidence} from './hostGuestEvidenceStorage';
const panel='ccx-surface rounded-2xl p-5';
const input='mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm text-[var(--cc-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cc-focus)]';
const primary='ccx-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50';
const secondary='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm';
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents||0)/100);
const localDate=value=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—';

export default function HostCrossMarketplace({paid=false,user=null}){
 const [items,setItems]=useState([]),[bookings,setBookings]=useState([]),[view,setView]=useState('explore');
 const [selected,setSelected]=useState(null),[unavailable,setUnavailable]=useState([]);
 const [query,setQuery]=useState(''),[where,setWhere]=useState({...EMPTY_GEO}),[starts,setStarts]=useState(''),[ends,setEnds]=useState('');
 const [crew,setCrew]=useState(1),[purpose,setPurpose]=useState(''),[quote,setQuote]=useState(null),[modal,setModal]=useState(false),[ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [inspectionBooking,setInspectionBooking]=useState(null);
 const refresh=useCallback(async()=>{
  const [browse,history]=await Promise.all([hostConnectAction('browse'),
   user?hostConnectAction('my_bookings'):Promise.resolve({items:[]})]);
  setItems(browse.items||[]);setBookings(history.items||[]);
 },[user?.id]);
 useEffect(()=>{let live=true;refresh().catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[refresh]);
 // Host Connect X is the calendar authority. Keep background-open CCX tabs
 // current without ever duplicating or writing a local property inventory.
 useEffect(()=>{
  let active=true;
  const sync=()=>{
   if(document.visibilityState!=='visible')return;
   void refresh().catch(()=>{});
   if(selected?.id){
    void hostConnectAction('availability',{property_id:selected.id}).then(result=>{
     if(active)setUnavailable(result.unavailable||[]);
    }).catch(()=>{});
   }
  };
  const timer=window.setInterval(sync,30000);
  window.addEventListener('focus',sync);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',sync);};
 },[refresh,selected?.id]);
 const run=async fn=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e.message||'Host Connect X unavailable');}finally{setBusy(false);}};
 const search=()=>run(async()=>{const r=await hostConnectAction('browse',{query,country:where.country,state:where.state,city:where.city});setItems(r.items||[]);});
 const open=id=>run(async()=>{const r=await hostConnectAction('listing',{id});setSelected(r.item);setUnavailable(r.unavailable||[]);setStarts('');setEnds('');setPurpose(r.item?.permitted_uses?.[0]||'');setCrew(1);setQuote(null);});
 const calculate=()=>run(async()=>{
  if(!selected||nightsBetween(starts,ends)<1)throw Error('Choose a valid daily rental period.');
  const r=await hostConnectAction('quote',{property_id:selected.id,starts_at:venueDateToIso(starts,selected.timezone),
   ends_at:venueDateToIso(ends,selected.timezone),requested_use:purpose,crew_size:crew});
  setQuote(r.quote);
 });
 const reserve=()=>run(async()=>{
  if(!ack||!selected||!quote||!paid)return;
  const r=await hostConnectAction('reserve',{property_id:selected.id,starts_at:venueDateToIso(starts,selected.timezone),
   ends_at:venueDateToIso(ends,selected.timezone),requested_use:purpose,crew_size:crew,
   idempotency_key:crypto.randomUUID()});
  setModal(false);setAck(false);setSelected(null);setQuote(null);setNotice(r.note||'Venue request submitted.');
  await refresh();setView('bookings');
 });
 const cancel=b=>run(async()=>{if(!window.confirm('Cancel this unpaid venue request?'))return;
  await hostConnectAction('booking_cancel',{booking_id:b.id});await refresh();setNotice('Booking request cancelled.');});
 return <div className="space-y-5" data-ccx-host-connect="true">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--cc-link)]">Host Connect X venues</p>
    <h1 className="mt-1 text-2xl font-bold">Find a production location</h1>
    <p className="text-sm text-[var(--cc-text-secondary)]">Live approved spaces and dates from Host Connect X. One booking calendar on both websites.</p></div>
   <a className={secondary} href="https://hostconnectx.com" target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Open Host Connect X</a>
  </div>
  <div className="flex flex-wrap gap-2" role="group" aria-label="Property marketplace sections">
   <button className={view==='explore'?primary:secondary} onClick={()=>{setView('explore');setSelected(null);}}>Explore spaces</button>
   <button className={view==='bookings'?primary:secondary} onClick={()=>setView('bookings')}><CalendarDays size={16}/> My venue requests</button>
   <button className={secondary} onClick={()=>void run(refresh)} disabled={busy} aria-label="Refresh Host Connect X availability"><RefreshCw size={16}/></button>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm">{notice}</p>}
  {view==='explore'&&!selected&&<div className="space-y-5">
   <form onSubmit={e=>{e.preventDefault();void search();}} className={panel+' grid gap-3 md:grid-cols-[1fr_1fr_auto]'}>
    <label className="text-sm">Find a location<input className={input} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Studio, house, venue name"/></label>
    <div className="text-sm"><GeoLocationSelect compact allowAny idPrefix="ccx-venue-search" value={where}
      onChange={location=>setWhere(location)}/></div>
    <button className={primary+' self-end'} disabled={busy}><Search size={17}/> Search</button>
   </form>
   {!items.length?<p className={panel+' text-sm text-[var(--cc-text-secondary)]'}>There are no independently approved Host Connect X locations matching this search yet. New listings appear after property verification.</p>:
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
     {items.map(p=><button type="button" key={p.id} className="ccx-surface overflow-hidden rounded-xl text-left" onClick={()=>void open(p.id)}>
      {p.cover_url?<img className="aspect-[4/3] w-full object-cover" src={p.cover_url} alt={p.title}/>:
       <div className="flex aspect-[4/3] items-center justify-center bg-[var(--cc-surface-subtle)]"><Home size={38} className="text-[var(--cc-text-muted)]"/></div>}
      <div className="space-y-2 p-4"><h3 className="text-lg font-semibold">{p.title}</h3>
       <p className="flex items-center gap-1 text-xs text-[var(--cc-text-secondary)]"><MapPin size={13}/>{[p.city,p.state,p.country].filter(Boolean).join(', ')}</p>
       <p className="font-semibold">{money(p.daily_rate_cents)} / day</p>
      </div></button>)}
    </div>}
  </div>}
  {view==='explore'&&selected&&<div className="grid gap-5 lg:grid-cols-[1fr_345px]">
   <div className="space-y-4"><button className={secondary} onClick={()=>{setSelected(null);setQuote(null);}}><ArrowLeft size={16}/> All spaces</button>
    <section className={panel+' space-y-3'}>
     {selected.cover_url&&<img className="aspect-[16/10] w-full rounded-xl object-cover" src={selected.cover_url} alt={selected.title}/>}
     <h2 className="text-2xl font-semibold">{selected.title}</h2>
     <p className="flex items-center gap-1 text-sm text-[var(--cc-text-secondary)]"><MapPin size={16}/>{[selected.city,selected.state,selected.country].filter(Boolean).join(', ')}</p>
     <p className="whitespace-pre-wrap text-sm">{selected.description}</p>
     <p className="flex items-start gap-2 text-xs text-[var(--cc-text-secondary)]"><ShieldCheck size={15}/>The host controls permitted production uses. Exact address and access instructions are restricted until a booking is signed and paid.</p>
     <h3 className="font-semibold">Unavailable dates</h3>
     {!unavailable.length?<p className="text-sm text-[var(--cc-text-secondary)]">No booking or property blocks in the current calendar.</p>:
      <div className="flex flex-wrap gap-2">{unavailable.slice(0,35).map((d,i)=><span className="rounded-lg bg-[var(--cc-surface-subtle)] px-3 py-2 text-xs" key={i}>{localDate(d.starts_at)} – {localDate(d.ends_at)}</span>)}</div>}
    </section>
   </div>
   <section className={panel+' h-fit space-y-3'}>
    <h2 className="text-xl font-semibold">{money(selected.daily_rate_cents)} <span className="text-sm font-normal">/ day</span></h2>
    <p className="text-xs text-[var(--cc-text-secondary)]">3 p.m. local check-in and 3 p.m. checkout ({selected.timezone}).</p>
    <div className="grid grid-cols-2 gap-2">
     <label className="text-xs">Check-in<input className={input} type="date" value={starts} onChange={e=>{setStarts(e.target.value);setQuote(null);}}/></label>
     <label className="text-xs">Checkout<input className={input} type="date" value={ends} onChange={e=>{setEnds(e.target.value);setQuote(null);}}/></label>
    </div>
    <label className="text-xs">Crew size<input className={input} type="number" min={1} max={selected.capacity} value={crew} onChange={e=>{setCrew(Number(e.target.value));setQuote(null);}}/></label>
    <label className="text-xs">Proposed use<select className={input} value={purpose} onChange={e=>{setPurpose(e.target.value);setQuote(null);}}>{selected.permitted_uses.map(u=><option key={u} value={u}>{u.replaceAll('_',' ')}</option>)}</select></label>
    {quote&&<div className="space-y-2 border-t border-[var(--cc-border)] pt-3 text-sm">
     <div className="flex justify-between"><span>Rental</span><span>{money(quote.rental_cents)}</span></div>
     <div className="flex justify-between"><span>Cleaning</span><span>{money(quote.cleaning_cents)}</span></div>
     <div className="flex justify-between font-semibold"><span>Total</span><span>{money(quote.total_cents)}</span></div>
     <p className="text-xs text-[var(--cc-text-secondary)]">Quoted damage deposit: {money(quote.deposit_cents)}. No payment collected.</p>
    </div>}
    <button type="button" className={secondary+' w-full'} disabled={busy||nightsBetween(starts,ends)<1} onClick={()=>void calculate()}>Check live dates and price</button>
    <button type="button" className={primary+' w-full'} disabled={!paid||!quote||busy} onClick={()=>{setAck(false);setModal(true);}}>Review venue request</button>
    {!paid&&<p className="text-xs text-[var(--cc-text-secondary)]">Verified Premium membership is required to request Host Connect X properties.</p>}
    <p className="text-xs text-[var(--cc-text-secondary)]">The quote may change until the transaction reserves the requested period. A pending request does not guarantee a paid booking.</p>
   </section>
  </div>}
  {view==='bookings'&&inspectionBooking&&<HostGuestInspection booking={inspectionBooking} action={hostConnectAction}
    upload={uploadHostGuestEvidence} onClose={()=>setInspectionBooking(null)}/>}
  {view==='bookings'&&!inspectionBooking&&<section className={panel+' space-y-3'}>
   <h2 className="text-lg font-semibold">My Host Connect X requests</h2>
   {!bookings.length?<p className="text-sm text-[var(--cc-text-secondary)]">No requests yet. Both websites share the same live calendar when you reserve.</p>:bookings.map(b=>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cc-border)] py-3" key={b.id}>
     <div><h3 className="font-semibold">{b.title}</h3><p className="text-sm">{localDate(b.starts_at)} – {localDate(b.ends_at)}</p>
      <p className="text-xs text-[var(--cc-text-secondary)]">{b.status} · {money(b.total_cents)} · Agreement: {b.legal_status} · Payment: {b.payment_status}</p></div>
     {b.status==='confirmed'&&b.legal_status==='signed'&&b.payment_status==='captured'&&
      <button className={primary} type="button" onClick={()=>setInspectionBooking(b)}>Report check-in condition</button>}
     {['requested','accepted'].includes(b.status)&&<button className={secondary} disabled={busy} onClick={()=>void cancel(b)}>Cancel pending request</button>}
    </div>)}
  </section>}
  {modal&&selected&&quote&&<HostDialog title="Review Host Connect X reservation" onClose={()=>{setModal(false);setAck(false);}} busy={busy}>
   <div className="space-y-4 text-sm"><h3 className="font-semibold">{selected.title}</h3>
    <p>{starts} to {ends} · {nightsBetween(starts,ends)} days · 3 p.m. property-local check-in</p>
    <p className="font-semibold">Quoted total: {money(quote.total_cents)}</p>
    <p className="leading-6 text-[var(--cc-text-secondary)]">Submitting creates a pending booking request only. Host acceptance, signed rental terms and verified payment are required to confirm. No non-refundable charge or damage deposit has been collected at this stage.</p>
    <label className="flex items-start gap-2 rounded-xl border border-[var(--cc-border)] p-3"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} className="mt-1"/><span>I reviewed the location, dates, rate and booking conditions.</span></label>
    <div className="flex justify-end gap-2"><button className={secondary} onClick={()=>setModal(false)}>Back</button>
     <button className={primary} disabled={!ack||busy} onClick={()=>void reserve()}>Submit venue request</button></div>
   </div>
  </HostDialog>}
 </div>;
}
