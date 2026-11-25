/** One Host ConnectX booking thread shared by Host and CCX.
 * Sender identity, membership, history and write limits are verified by the
 * canonical Host marketplace; browser does not decide visibility.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {MessageCircle,Send,RefreshCw,ArrowLeft,ShieldCheck} from 'lucide-react';
export default function HostBookingMessages({bookingId,action,userId='',onBack=()=>{},title='Venue conversation'}){
 const [messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef(null),end=useRef(null);
 const load=useCallback(async()=>{
  const data=await action('booking_messages',{booking_id:bookingId});
  setMessages(data.items||[]);setError('');setLoading(false);
 },[action,bookingId]);
 useEffect(()=>{
  let live=true;
  void load().catch(e=>{if(live){setLoading(false);setError(e.message||'Cannot load this booking conversation');}});
  const clock=window.setInterval(()=>{
   if(document.visibilityState==='visible')void load().catch(()=>{});
  },12000);
  return()=>{live=false;window.clearInterval(clock);};
 },[load]);
 useEffect(()=>{end.current?.scrollIntoView?.({behavior:'auto',block:'end'});},[messages.length]);
 const send=async e=>{
  e.preventDefault();
  if(sending||!draft.trim()||draft.length>4000)return;
  setSending(true);setError('');setNotice('');
  const key=pending.current||crypto.randomUUID();pending.current=key;
  try{
   const result=await action('booking_message_send',{booking_id:bookingId,content:draft.trim(),client_request_id:key});
   pending.current=null;setDraft('');await load();setNotice(result.note||'Message shared with authorized booking participants on both websites.');
  }catch(e){setError(e.message||'Message was not sent. Retry safely.');}finally{setSending(false);}
 };
 return <section className="space-y-4 rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5" data-host-booking-chat="true">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--cc-link)]"><ShieldCheck size={14}/> Verified booking participants only</p>
    <h2 className="mt-2 flex items-center gap-2 text-xl font-bold"><MessageCircle size={21}/>{title}</h2></div>
   <div className="flex gap-2"><button type="button" className="oh-secondary min-h-10 rounded-lg px-3 text-sm" onClick={()=>void load().catch(e=>setError(e.message))}><RefreshCw size={15}/> Refresh</button>
    <button type="button" className="oh-secondary min-h-10 rounded-lg px-3 text-sm" onClick={onBack}><ArrowLeft size={15}/> Back</button></div>
  </div>
  <p className="text-xs text-[var(--cc-text-secondary)]">Messages are saved to the Host ConnectX booking record. A verified CCX collaboration member can participate only when the booking is linked to their collaboration. No shared login is required.</p>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="text-xs text-[var(--cc-link)]">{notice}</p>}
  <div className="h-[360px] space-y-3 overflow-y-auto rounded-xl bg-[var(--cc-surface-subtle)] p-4" role="log" aria-label="Booking conversation" aria-live="polite">
   {loading?<p className="text-sm text-[var(--cc-text-secondary)]">Loading conversation…</p>:
    messages.length===0?<div className="flex h-full items-center justify-center text-center text-sm text-[var(--cc-text-secondary)]">No booking messages yet. Ask the host about permitted activities, crew size or arrival procedures.</div>:
    messages.map(m=><div key={m.id} className={'flex '+(m.sender_user_id===userId?'justify-end':'justify-start')}>
     <div className={'max-w-[88%] rounded-2xl px-4 py-3 text-sm '+(m.sender_user_id===userId?'bg-[#12698f] text-white':'bg-[var(--cc-surface)] text-[var(--cc-text-primary)]')}>
      <p className={'text-[11px] font-semibold '+(m.sender_user_id===userId?'text-white/90':'text-[var(--cc-link)]')}>{m.sender_label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{m.content}</p>
      <p className={'mt-2 text-[10px] '+(m.sender_user_id===userId?'text-white/75':'text-[var(--cc-text-muted)]')}>{new Date(m.created_at).toLocaleString()}</p>
     </div></div>)}
   <div ref={end}/>
  </div>
  <form onSubmit={send} className="flex flex-col gap-3 sm:flex-row sm:items-end">
   <label className="flex-1 text-xs font-semibold">Message the host or verified production group
    <textarea className="mt-2 min-h-[80px] w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-3 text-sm"
     value={draft} onChange={e=>{setDraft(e.target.value);pending.current=null;}} rows={2} maxLength={4000}
     placeholder="Ask about shooting equipment, allowed uses, access or booking details…"/></label>
   <button type="submit" className="oh-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
    disabled={sending||!draft.trim()}><Send size={17}/>{sending?'Sending…':'Send message'}</button>
  </form>
 </section>;
}
