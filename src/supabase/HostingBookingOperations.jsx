/**
 * Booking contract, payment, damage, cancellation and rescheduling overview.
 * Visible to booking participants only. All actions are independently verified.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {FileSignature,CreditCard,ShieldCheck,RefreshCw,CalendarClock,Banknote,Download} from 'lucide-react';
import {hostingBusiness,hostingAgreement,hostingCheckout,formatUSD,formatDate,uploadDamageEvidence} from './hostingBusinessApi';
import HostingProductionPacket from './HostingProductionPacket';

const panel='ccx-surface p-4';
const input='w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2.5 text-sm text-[var(--cc-text-primary)]';
const button='rounded-lg ccx-solid-action px-4 py-2.5 text-sm font-semibold text-[var(--cc-text-primary)] disabled:opacity-50';
const secondary='rounded-lg bg-[var(--cc-surface)] px-4 py-2.5 text-sm text-[var(--cc-text-primary)] disabled:opacity-50';
const statuses={signed:'Signed',pending_signature:'Awaiting signatures',captured:'Captured by processor',not_started:'Not paid',
  pending:'Pending',accepted:'Accepted',requested:'Requested',voided:'Voided',completed:'Completed'};

export default function HostingBookingOperations({bookingId,userId,onChanged=()=>{}}){
 const [view,setView]=useState(null);
 const [agreement,setAgreement]=useState(null);
 const [setup,setSetup]=useState(null);
 const [quote,setQuote]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [start,setStart]=useState('');
 const [end,setEnd]=useState('');
 const [damageAmount,setDamageAmount]=useState('');
 const [damageDetails,setDamageDetails]=useState('');
 const [damageFile,setDamageFile]=useState(null);
 const [refundReason,setRefundReason]=useState('');
 const booking=view?.booking;
 const isHost=booking?.owner_id===userId,isGuest=booking?.requester_id===userId;

 const refresh=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const [overview,status,readiness]=await Promise.all([
    hostingBusiness('booking_overview',{booking_id:bookingId}),
    hostingAgreement('status',{booking_id:bookingId}),
    hostingBusiness('provider_readiness')
   ]);
   setView(overview);setAgreement(status);setSetup(readiness);
   onChanged?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 },[bookingId]);
 useEffect(()=>{refresh();},[refresh]);

 const perform=async(fn,action,details,message)=>{
  setBusy(true);setError('');setSuccess('');
  try{const result=await fn(action,details);setSuccess(message||result.note||'Action saved.');await refresh();return result;}
  catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const cancellation=async()=>{
  setBusy(true);setError('');try{setQuote(await hostingBusiness('cancel_quote',{booking_id:bookingId}));}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const cancel=async()=>{
  if(!window.confirm('Cancel this booking? Any financial refund remains subject to processor confirmation.'))return;
  await perform(hostingBusiness,'cancel_booking',{booking_id:bookingId},'Booking cancelled. Eligible refunds are queued for review, not yet paid.');
 };
 const reschedule=async(e)=>{
  e.preventDefault();
  await perform(hostingBusiness,'reschedule_propose',{
   booking_id:bookingId,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()
  },'New dates proposed. The other participant must accept before the reservation changes.');
 };
 const send=async()=>{
  if(!window.confirm('Send the independently approved location agreement to both verified signers via DocuSign?'))return;
  await perform(hostingAgreement,'send',{booking_id:bookingId},'DocuSign signing invitations sent. The completed certificate is required.');
 };
 const checkout=async()=>{
  setBusy(true);setError('');setSuccess('');
  try{
   const result=await hostingCheckout('create_checkout',{booking_id:bookingId});
   const link=new URL(result.checkout_url);
   if(link.protocol!=='https:'||link.hostname!=='api.ccbill.com')throw new Error('Invalid merchant checkout destination');
   window.open(link.toString(),'_blank','noopener,noreferrer');
   setSuccess('CCBill payment form opened. Payment is not complete until the verified processor confirms it.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const evidence=async()=>{
  setError('');
  try{
   const result=await hostingAgreement('download',{booking_id:bookingId});
   for(const link of [result.signed_pdf,result.certificate]){
    const u=new URL(link);if(u.protocol==='https:')window.open(u.toString(),'_blank','noopener,noreferrer');
   }
  }catch(e){setError(e.message);}
 };
 const damage=async(e)=>{
  e.preventDefault();
  const cents=Math.round(Number(damageAmount)*100);
  const result=await perform(hostingBusiness,'damage_claim',{
    booking_id:bookingId,claimed_cents:cents,description:damageDetails
  },'Damage claim submitted. No funds were collected.');
  if(result?.item?.id&&damageFile){
   try{await uploadDamageEvidence({claimId:result.item.id,file:damageFile});setSuccess('Claim and private evidence submitted.');}
   catch(e){setError(e.message);}
  }
  if(result){setDamageAmount('');setDamageDetails('');setDamageFile(null);}
 };
 const refund=async(e)=>{
  e.preventDefault();await perform(hostingBusiness,'refund_request',{booking_id:bookingId,reason:refundReason},
   'Refund requested. The payment provider must confirm any actual refund.');
 };
 if(!booking)return <div className={panel}>{busy?'Loading booking…':<p className="text-sm text-red-800">{error||'Booking not available'}</p>}</div>;
 const terms=view.terms||{};
 return <section className="space-y-4 text-[var(--cc-text-primary)]">
  <div className="flex justify-between gap-2"><div><h3 className="text-lg font-semibold">Booking operations</h3>
    <p className="text-xs text-[var(--cc-text-secondary)]">{formatDate(booking.starts_at)} — {formatDate(booking.ends_at)}</p></div>
    <button className={secondary} onClick={refresh} disabled={busy}><RefreshCw size={15}/></button></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {success&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <div className={panel}><p className="text-xs text-[var(--cc-text-secondary)]">Reservation</p><strong className="text-sm capitalize">{statuses[booking.status]||booking.status}</strong></div>
    <div className={panel}><p className="text-xs text-[var(--cc-text-secondary)]">DocuSign</p><strong className="text-sm capitalize">{statuses[booking.legal_status]||booking.legal_status}</strong></div>
    <div className={panel}><p className="text-xs text-[var(--cc-text-secondary)]">Payment</p><strong className="text-sm capitalize">{statuses[booking.payment_status]||booking.payment_status}</strong></div>
    <div className={panel}><p className="text-xs text-[var(--cc-text-secondary)]">Operations</p><strong className="text-sm capitalize">{booking.operational_status}</strong></div>
  </div>
  <div className={panel}>
    <h4 className="font-semibold">Financial and cancellation terms</h4>
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
      <p className="text-[var(--cc-text-secondary)]">Rental estimate <strong className="block text-[var(--cc-text-primary)]">{formatUSD(terms.rental_cents)}</strong></p>
      <p className="text-[var(--cc-text-secondary)]">Agreed deposit ceiling <strong className="block text-[var(--cc-text-primary)]">{formatUSD(terms.deposit_cents)}</strong></p>
      <p className="text-[var(--cc-text-secondary)]">Cancellation schedule <strong className="block text-[var(--cc-text-primary)] capitalize">{terms.cancellation_policy||'—'}</strong></p>
      <p className="text-[var(--cc-text-secondary)]">Deposits held <strong className="block text-[var(--cc-text-primary)]">{view.deposit?.status==='authorized'?'Processor-authorized':'Not authorized'}</strong></p>
    </div>
    <p className="mt-3 text-xs text-amber-800">A quoted deposit is not a charge or hold. Platform fees and refunds require an approved processor and clear booking terms.</p>
  </div>
  <div className={panel+' space-y-3'}>
    <h4 className="flex items-center gap-2 font-semibold"><FileSignature size={17}/> DocuSign rental agreement</h4>
    <p className="text-sm text-[var(--cc-text-secondary)]">{agreement?.item?.status||'Not prepared'} · Completed legal signatures are confirmed by the provider, not by a browser checkbox.</p>
    <div className="flex flex-wrap gap-2">
      {isHost&&booking.status==='accepted'&&!['signed','voided'].includes(booking.legal_status)&&
        <button disabled={busy||!setup?.docusign?.configured} className={button} onClick={send}>Send approved rental agreement</button>}
      {agreement?.item?.status==='completed'&&<button disabled={busy} className={secondary} onClick={evidence}><Download size={16} className="inline mr-2"/>Signed PDF and certificate</button>}
    </div>
    {!setup?.docusign?.configured&&<p className="text-xs text-amber-800">DocuSign authorization, approved templates and verified legal signer names must be configured first.</p>}
  </div>
  <div className={panel+' space-y-3'}>
    <h4 className="font-semibold flex items-center gap-2"><CreditCard size={17}/> Charges and refunds</h4>
    <p className="text-sm text-[var(--cc-text-secondary)]">Processor: {view.charge?.provider||'Not connected'} · Rental: {view.charge?.status||'not started'} · Deposit: {view.deposit?.status||'not authorized'}</p>
    {isGuest&&booking.status==='accepted'&&booking.legal_status==='signed'&&!['captured','partially_refunded'].includes(booking.payment_status)&&
      <button disabled={busy||!setup?.merchant?.configured} className={button} onClick={checkout}>Open approved CCBill checkout</button>}
    {!setup?.merchant?.configured&&<p className="text-xs text-amber-800">No approved booking merchant is connected, so checkout and payouts are unavailable.</p>}
    {view.refunds?.map(r=><p className="text-xs text-[var(--cc-text-secondary)]" key={r.id}>Refund {formatUSD(r.amount_cents)} · {r.status}</p>)}
    {isGuest&&['captured','partially_refunded'].includes(booking.payment_status)&&
      <form onSubmit={refund} className="flex flex-wrap gap-2"><input required minLength={4} className={input+' flex-1'} value={refundReason} onChange={e=>setRefundReason(e.target.value)} placeholder="Refund request reason"/><button disabled={busy} className={secondary}>Request refund review</button></form>}
  </div>
  {['requested','accepted'].includes(booking.status)&&<div className={panel+' space-y-3'}>
    <h4 className="font-semibold flex items-center gap-2"><CalendarClock size={17}/> Cancel or reschedule</h4>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} className={secondary} onClick={cancellation}>Calculate cancellation quote</button>
      <button disabled={busy} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm text-white" onClick={cancel}>Cancel booking</button>
    </div>
    {quote?.quote&&<p className="rounded-lg bg-[var(--cc-surface)] p-3 text-sm">Proposed refund: <strong>{formatUSD(quote.quote.refundableCents)}</strong> · Nonrefundable: {formatUSD(quote.quote.forfeitedCents)}. Any actual refund needs processor confirmation.</p>}
    {booking.status==='accepted'&&booking.legal_status!=='signed'&&!['captured','partially_refunded'].includes(booking.payment_status)&&
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={reschedule}>
        <label className="text-xs">Proposed start<input className={input+' mt-1'} type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label className="text-xs">Proposed end<input className={input+' mt-1'} type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <button disabled={busy} className={button+' self-end'}>Propose dates</button>
      </form>}
    {view.reschedules?.map(p=><div key={p.id} className="rounded-lg border border-[var(--cc-border)] p-3">
      <p className="text-xs text-[var(--cc-text-secondary)]">{formatDate(p.proposed_start)} → {formatDate(p.proposed_end)} · {p.status}</p>
      {p.status==='pending'&&p.requested_by!==userId&&<div className="mt-2 flex gap-2">{['accepted','declined'].map(decision=>
        <button key={decision} disabled={busy} className={secondary} onClick={()=>perform(hostingBusiness,'reschedule_decide',{id:p.id,decision},'Reschedule '+decision)}>{decision}</button>)}</div>}
    </div>)}
  </div>}
  <div className={panel+' space-y-3'}>
    <h4 className="font-semibold flex items-center gap-2"><ShieldCheck size={17}/> Damage claims and condition reports</h4>
    {view.claims?.map(claim=><div key={claim.id} className="rounded-lg bg-[var(--cc-surface-subtle)] p-3 text-sm">
      <p>Claim {formatUSD(claim.claimed_cents)} · <strong className="capitalize">{claim.status}</strong></p>
      <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--cc-text-secondary)]">{claim.description}</p>
      {isGuest&&claim.status==='submitted'&&<button disabled={busy} className={secondary+' mt-2'} onClick={()=>perform(hostingBusiness,'damage_dispute',{claim_id:claim.id},'Claim disputed. Administrator review required.')}>Dispute this claim</button>}
    </div>)}
    {isHost&&Date.now()>=new Date(booking.ends_at).getTime()&&Date.now()-new Date(booking.ends_at).getTime()<=72*3600000&&
      <form className="space-y-2" onSubmit={damage}>
        <label className="text-xs block">Damage amount (USD, within agreed deposit)<input className={input+' mt-1'} type="number" required min={0.01} step={0.01} value={damageAmount} onChange={e=>setDamageAmount(e.target.value)}/></label>
        <label className="text-xs block">Detailed claim<textarea className={input+' mt-1'} required minLength={10} rows={3} value={damageDetails} onChange={e=>setDamageDetails(e.target.value)}/></label>
        <label className="text-xs block">Private evidence (optional)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block mt-1" onChange={e=>setDamageFile(e.target.files?.[0]||null)}/></label>
        <button disabled={busy} className={button}>Submit damage claim for review</button>
      </form>}
  </div>
  {isHost&&<div className={panel+' space-y-3'}>
    <h4 className="font-semibold flex items-center gap-2"><Banknote size={17}/> Host payout readiness</h4>
    <p className="text-xs text-[var(--cc-text-secondary)]">Settlement is held until payment, agreements, account verification and all open disputes are resolved.</p>
    <button className={secondary} disabled={busy} onClick={async()=>{
      try{const r=await hostingBusiness('payout_preview',{booking_id:bookingId});
        setSuccess((r.eligible?.eligible?'Potentially eligible':'Blocked: '+r.eligible?.reasons.join(', '))+' · Preview only: '+formatUSD(r.quote?.hostPayoutCents));
      }catch(e){setError(e.message);}
    }}>Check payout eligibility</button>
  </div>}
  <HostingProductionPacket bookingId={bookingId} userId={userId}/>
 </section>;
}
