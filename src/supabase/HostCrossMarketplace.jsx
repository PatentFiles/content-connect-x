/** Content ConnectX property discovery and booking.
 * Host ConnectX owns every listing, blackout and reservation; this component
 * is a read/write *client* of that canonical inventory, never a local cache.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {CalendarDays,MapPin,ArrowLeft,RefreshCw,ShieldCheck} from 'lucide-react';
import {hostConnectAction} from './hostConnectApi';
import {venueDateToIso,nightsBetween} from './hostingDateRange.mjs';
import HostDialog from './HostDialog';
import MarketplaceExplore from './MarketplaceExplore';
import HostGuestInspection from './HostGuestInspection';
import HostBookingMessages from './HostBookingMessages';
import {supabase} from '@/api/supabaseClient';
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
 const [starts,setStarts]=useState(''),[ends,setEnds]=useState('');
 const [crew,setCrew]=useState(1),[purpose,setPurpose]=useState(''),[quote,setQuote]=useState(null),[modal,setModal]=useState(false),[ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [inspectionBooking,setInspectionBooking]=useState(null),[chatBooking,setChatBooking]=useState(null);
 const [collaborations,setCollaborations]=useState([]),[linkedCollab,setLinkedCollab]=useState('');
 const refresh=useCallback(async()=>{
  const [browse,history]=await Promise.all([hostConnectAction('browse'),
   user?hostConnectAction('my_bookings'):Promise.resolve({items:[]})]);
  setItems(browse.items||[]);setBookings(history.items||[]);
 },[user?.id]);
 useEffect(()=>{let live=true;refresh().catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[refresh]);
 // Host ConnectX is the calendar authority. Keep background-open CCX tabs
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
 const run=async fn=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e.message||'Host ConnectX unavailable');}finally{setBusy(false);}};
 const search=params=>run(async()=>{const r=await hostConnectAction('browse',params);setItems(r.items||[]);});
 const open=id=>run(async()=>{const r=await hostConnectAction('listing',{id});setSelected(r.item);setUnavailable(r.unavailable||[]);setStarts('');setEnds('');setPurpose(r.item?.permitted_uses?.[0]||'');setCrew(1);setQuote(null);setLinkedCollab('');});
 useEffect(()=>{
  if(!user){setCollaborations([]);return;}
  let active=true;
  void supabase.functions.invoke('collaboration-workspace',{body:{action:'list'}})
   .then(({data,error})=>{if(active&&!error)setCollaborations((data?.items||[]).filter(
    c=>c.creator_id===user.id&&c.plan?.property_id));})
   .catch(()=>{if(active)setCollaborations([]);});
  return()=>{active=false;};
 },[user?.id]);
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
   idempotency_key:crypto.randomUUID(),...(linkedCollab?{collaboration_id:linkedCollab}:{})});
  setModal(false);setAck(false);setSelected(null);setQuote(null);setNotice(r.note||'Venue request submitted.');
  await refresh();setView('bookings');
 });
 const cancel=b=>run(async()=>{if(!window.confirm('Cancel this unpaid venue request?'))return;
  await hostConnectAction('booking_cancel',{booking_id:b.id});await refresh();setNotice('Booking request cancelled.');});
 return <div className="space-y-5" data-ccx-host-connect="true">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--cc-link)]">Host ConnectX venues</p>
    <h1 className="mt-1 text-2xl font-bold">Find a production location</h1>
    <p className="text-sm text-[var(--cc-text-secondary)]">Live approved spaces and dates from Host ConnectX. One booking calendar on both websites.</p></div>

  </div>
  <div className="flex flex-wrap gap-2" role="group" aria-label="Property marketplace sections">
   <button className={view==='explore'?primary:secondary} onClick={()=>{setView('explore');setSelected(null);}}>Explore spaces</button>
   <button className={view==='bookings'?primary:secondary} onClick={()=>setView('bookings')}><CalendarDays size={16}/> My venue requests</button>
   <button className={secondary} onClick={()=>void run(refresh)} disabled={busy} aria-label="Refresh Host ConnectX availability"><RefreshCw size={16}/></button>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm">{notice}</p>}
  {view==='explore'&&!selected&&<MarketplaceExplore items={items} busy={busy} onSearch={search}
    onOpen={id=>void open(id)} site="ccx"/>}
  {view==='explore'&&selected&&<div className="grid gap-5 lg:grid-cols-[1fr_345px]">
   <div className="space-y-4"><button className={secondary} onClick={()=>{setSelected(null);setQuote(null);}}><ArrowLeft size={16}/> All spaces</button>
    <section className={panel+' space-y-3'}>
     {selected.cover_url&&<img className="aspect-[16/10] w-full rounded-xl object-cover" src={selected.cover_url} alt={selected.title}/>}
     <h2 className="text-2xl font-semibold">{selected.title}</h2>
     <p className="flex items-center gap-1 text-sm text-[var(--cc-text-secondary)]"><MapPin size={16}/>{[selected.city,selected.state,selected.country].filter(Boolean).join(', ')}</p>
     <p className="whitespace-pre-wrap text-sm">{selected.description}</p>
     {(selected.equipment||[]).length>0&&<div className="space-y-3 border-t border-[var(--cc-border)] pt-4" aria-label="Available studio equipment">
      <h3 className="font-semibold">On-site cameras, lighting and equipment</h3>
      <p className="text-xs text-[var(--cc-text-secondary)]">Host-declared equipment. Add-on prices are estimates; no separate equipment charge can be collected until the approved processor is configured.</p>
      <div className="grid gap-2 sm:grid-cols-2">{selected.equipment.map(e=><article key={e.id}
       className="rounded-xl border border-[var(--cc-border)] p-3">
       <h4 className="text-sm font-semibold">{e.name}</h4>
       <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{e.description||e.category.replaceAll('_',' ')} · {e.quantity} available</p>
       <p className="mt-1 text-xs">{e.included_in_rental?'Included in venue rental':'Optional add-on'}
        {e.add_on_fee_cents>0?' · '+money(e.add_on_fee_cents)+' quoted':''}
        {e.consumable?' · Consumable stock':''}</p>
       {e.equipment_rules&&<p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{e.equipment_rules}</p>}
      </article>)}</div>
     </div>}
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
    <label className="block text-xs">Related Content ConnectX collaboration (optional)
     <select className={input} value={linkedCollab} onChange={e=>setLinkedCollab(e.target.value)}>
      <option value="">Independent venue rental</option>
      {collaborations.filter(c=>c.plan?.property_id===selected.id).map(c=>
       <option key={c.id} value={c.id}>{c.title} — share messages with verified participants</option>)}
     </select>
     <span className="mt-1 block text-[11px] text-[var(--cc-text-secondary)]">Only a collaboration you organize whose saved venue matches this property can be linked. Group members are verified server-side.</span>
    </label>

    {quote&&<div className="space-y-2 border-t border-[var(--cc-border)] pt-3 text-sm">
     <div className="flex justify-between"><span>Rental</span><span>{money(quote.rental_cents)}</span></div>
     <div className="flex justify-between"><span>Cleaning</span><span>{money(quote.cleaning_cents)}</span></div>
     <div className="flex justify-between font-semibold"><span>Total</span><span>{money(quote.total_cents)}</span></div>
     <p className="text-xs text-[var(--cc-text-secondary)]">Quoted damage deposit: {money(quote.deposit_cents)}. No payment collected.</p>
    </div>}
    <button type="button" className={secondary+' w-full'} disabled={busy||nightsBetween(starts,ends)<1} onClick={()=>void calculate()}>Check live dates and price</button>
    <button type="button" className={primary+' w-full'} disabled={!paid||!quote||busy} onClick={()=>{setAck(false);setModal(true);}}>Review venue request</button>
    {!paid&&<p className="text-xs text-[var(--cc-text-secondary)]">Verified Premium membership is required to request Host ConnectX properties.</p>}
    <p className="text-xs text-[var(--cc-text-secondary)]">The quote may change until the transaction reserves the requested period. A pending request does not guarantee a paid booking.</p>
   </section>
  </div>}
  {view==='bookings'&&chatBooking&&<HostBookingMessages bookingId={chatBooking.id}
    title={chatBooking.title||'Host ConnectX booking'} userId={user?.id} action={hostConnectAction}
    onBack={()=>setChatBooking(null)}/>}
  {view==='bookings'&&inspectionBooking&&<HostGuestInspection booking={inspectionBooking} action={hostConnectAction}
    upload={uploadHostGuestEvidence} onClose={()=>setInspectionBooking(null)}/>}
  {view==='bookings'&&!inspectionBooking&&!chatBooking&&<section className={panel+' space-y-3'}>
   <h2 className="text-lg font-semibold">My Host ConnectX requests</h2>
   {!bookings.length?<p className="text-sm text-[var(--cc-text-secondary)]">No requests yet. Both websites share the same live calendar when you reserve.</p>:bookings.map(b=>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cc-border)] py-3" key={b.id}>
     <div><h3 className="font-semibold">{b.title}</h3><p className="text-sm">{localDate(b.starts_at)} – {localDate(b.ends_at)}</p>
      <p className="text-xs text-[var(--cc-text-secondary)]">{b.status} · {money(b.total_cents)} · Agreement: {b.legal_status} · Payment: {b.payment_status}</p></div>
     {b.status==='confirmed'&&b.legal_status==='signed'&&b.payment_status==='captured'&&
      <button className={primary} type="button" onClick={()=>setInspectionBooking(b)}>Report check-in condition</button>}
     <button type="button" className={secondary} onClick={()=>{setChatBooking(b);setInspectionBooking(null);}}>Message the host / production group</button>
     {['requested','accepted'].includes(b.status)&&<button className={secondary} disabled={busy} onClick={()=>void cancel(b)}>Cancel pending request</button>}
    </div>)}
  </section>}
  {modal&&selected&&quote&&<HostDialog title="Review Host ConnectX reservation" onClose={()=>{setModal(false);setAck(false);}} busy={busy}>
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
