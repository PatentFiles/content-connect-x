/** Same Host-owned reservation packet can be accessed from either brand. */
import React,{useCallback,useEffect,useState} from 'react';
import HostDialog from './HostDialog';
import {FileSignature,RefreshCw} from 'lucide-react';
const money=cents=>typeof cents==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100):'—';
const field='mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const stamp=(v,zone)=>v?new Date(v).toLocaleString(undefined,{timeZone:zone||'UTC',dateStyle:'medium',timeStyle:'short'}):'—';
export default function HostRentalAgreement({booking,action,onClose,onUpdated=()=>{},brand='host'}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[name,setName]=useState(''),[reviewed,setReviewed]=useState(false),[link,setLink]=useState(null);
 const button=(brand==='host'?'oh-primary':'ccx-primary')+' inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50';
 const secondary=(brand==='host'?'oh-secondary':'ccx-secondary')+' inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50';
 const run=useCallback(async(kind,args={})=>{
  setBusy(true);setError('');setLink(null);
  try{
   const next=await action(kind,{booking_id:booking.id,...args});
   if(kind==='download'){
    const url=new URL(next.url);
    if(url.protocol!=='https:'||url.hostname!=='szfdoqkfewwpdkapqptp.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/hc-rental-agreements/'))throw Error('Unexpected document URL');
    setLink(url.toString());return;
   }
   setData(next);
   if(kind!=='status')onUpdated();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 },[action,booking.id,onUpdated]);
 // Parent refresh callback may be recreated; initial load only when booking changes.
 useEffect(()=>{void run('status');},[booking.id]);
 const a=data?.agreement,s=a?.snapshot,b=s?.booking,p=s?.property;
 const selfReviewed=a?.role==='host'?a?.host_reviewed:a?.guest_reviewed;
 return <HostDialog title="Rental agreement" subtitle={booking.title||'Host Connect X reservation'} onClose={onClose} busy={busy}>
  <div className="space-y-4 text-sm">
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
   <div className="flex flex-wrap items-center justify-between gap-2"><strong className="flex items-center gap-2"><FileSignature size={18}/> {a?a.state.replaceAll('_',' '):'Awaiting agreement'}</strong><button type="button" className={secondary} disabled={busy} onClick={()=>void run(a&&['sent','sending'].includes(a.state)?'sync':'status')}><RefreshCw size={16}/>Refresh status</button></div>
   {!a&&data&&<><p>After the host accepts a reservation, both parties review the same approved rental terms. Preparing a document does not sign it or collect payment.</p><button type="button" disabled={busy||booking.status!=='accepted'} className={button} onClick={()=>void run('prepare')}>Prepare rental agreement</button></>}
   {a&&s&&<>
    <section className="space-y-2 rounded-xl border border-[var(--cc-border)] p-4">
     <h3 className="font-semibold">{s.legal_entity} — {p.title}</h3>
     <p>{stamp(b.starts_at,p.timezone)} – {stamp(b.ends_at,p.timezone)} ({p.timezone})</p>
     <p>{b.requested_use.replaceAll('_',' ')} · {b.crew_size} occupants</p>
     <p>Rental {money(b.rental_cents)} · Cleaning {money(b.cleaning_cents)} · Quoted total <strong>{money(b.total_cents)}</strong></p>
     <p>Damage deposit estimate: {money(b.damage_deposit_quote_cents)} (not collected)</p>
     <h4 className="pt-2 font-semibold">Property rules</h4><p className="whitespace-pre-wrap break-words">{p.rules||'No additional property rules recorded.'}</p>
    </section>
    <section className="space-y-2"><h3 className="font-semibold">Reviewed rental terms</h3><div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--cc-border)] p-4 whitespace-pre-wrap break-words leading-6">{s.terms}</div>
     <p className="break-all text-xs text-[var(--cc-text-secondary)]">Version {s.terms_id} · Snapshot {a.hash}</p></section>
    <div className="grid gap-2 sm:grid-cols-2"><p className="rounded-xl border border-[var(--cc-border)] p-3">Host review: <strong>{a.host_reviewed?'Recorded':'Pending'}</strong></p><p className="rounded-xl border border-[var(--cc-border)] p-3">Renter review: <strong>{a.guest_reviewed?'Recorded':'Pending'}</strong></p></div>
    {['draft','ready'].includes(a.state)&&!selfReviewed&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void run('acknowledge',{legal_name:name,reviewed,hash:a.hash});}}>
     <label className="block">Your full legal name<input required className={field} minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
     <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I independently reviewed this exact reservation, house rules and rental terms. My confirmed account email will receive the DocuSign envelope. This acknowledgement is not my signature.</label>
     <button className={button} disabled={busy||!reviewed||name.trim().length<2}>Record my review</button>
    </form>}
    {a.state==='ready'&&a.role==='host'&&<button type="button" className={button} disabled={busy} onClick={()=>{if(window.confirm('Send this agreement to both independently confirmed signers through Host Connect X DocuSign?'))void run('send');}}>Send for both signatures</button>}
    {a.state==='ready'&&a.role==='guest'&&<p>The host can now send the agreement through DocuSign.</p>}
    {a.state==='sending'&&<p>Provider send outcome is awaiting reconciliation. Do not send a second agreement.</p>}
    {a.state==='sent'&&<p>Check your confirmed account email for DocuSign. Both parties must sign the envelope before completion is recorded.</p>}
    {a.state==='completed'&&<div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy} onClick={()=>void run('download',{document:'agreement'})}>Get signed agreement</button><button type="button" className={secondary} disabled={busy} onClick={()=>void run('download',{document:'certificate'})}>Get signature certificate</button></div>}
    {a.needs_review&&<p className="rounded-xl border border-amber-400 p-3">Signed evidence was preserved, but the booking changed or expired. Contact support before taking further action.</p>}
    {link&&<a href={link} className={button} target="_blank" rel="noopener noreferrer">Open private PDF (temporary link)</a>}
   </>}
   <p className="rounded-xl border border-[var(--cc-border)] p-3 text-xs text-[var(--cc-text-secondary)]">A signed rental document does not collect funds, release a deposit or confirm check-in. Verified payment remains a separate requirement.</p>
  </div>
 </HostDialog>;
}
