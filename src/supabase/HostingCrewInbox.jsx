/** Verified production crew inbox, role-scoped planning details and protected chat. */
import React,{useCallback,useEffect,useState} from 'react';
import {UsersRound,MessageCircle,ShieldCheck,RefreshCw} from 'lucide-react';
import {hostingProduction,formatDate} from './hostingBusinessApi';
const panel='ccx-surface p-4';
const input='w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2.5 text-sm text-[var(--cc-text-primary)]';
const button='rounded-lg ccx-action-primary px-4 py-2 text-xs font-semibold text-[var(--cc-text-primary)] disabled:opacity-50';
const secondary='rounded-lg bg-[var(--cc-surface)] px-4 py-2 text-xs text-[var(--cc-text-primary)] disabled:opacity-50';

export default function HostingCrewInbox(){
 const [invites,setInvites]=useState([]),[selected,setSelected]=useState('');
 const [packet,setPacket]=useState(null),[messages,setMessages]=useState([]);
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{const r=await hostingProduction('my_crew_invites');setInvites(r.items||[]);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const open=async(id)=>{
  setSelected(id);setPacket(null);setMessages([]);setError('');
  try{const data=await hostingProduction('booking_planning_packet',{booking_id:id});setPacket(data);
   await refreshChat(id);
  }catch(e){setError(e.message);}
 };
 const refreshChat=async(id)=>{
  try{const r=await hostingProduction('booking_chat_list',{booking_id:id});setMessages(r.items||[]);}
  catch(e){if(!String(e.message).includes('not yet created'))setError(e.message);}
 };
 useEffect(()=>{
  if(!selected)return;
  const timer=setInterval(()=>{void refreshChat(selected);},10000);
  return()=>clearInterval(timer);
 },[selected]);
 const change=async(id,status)=>{
  setBusy(true);setError('');setNotice('');
  try{
   await hostingProduction('booking_access_respond',{booking_id:id,status});
   setNotice('Crew invitation '+status+'.');await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const send=async(e)=>{
  e.preventDefault();setBusy(true);setError('');
  try{await hostingProduction('booking_chat_send',{booking_id:selected,message:text});
   setText('');await refreshChat(selected);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="space-y-4 text-[var(--cc-text-primary)]">
  <h2 className="flex gap-2 items-center text-xl font-semibold"><UsersRound size={21}/>My production crew invitations</h2>
  <p className="text-xs text-[var(--cc-text-secondary)]">Crew access is explicitly accepted and can be revoked by the host or guest. Private venue details require a signed and funded booking plus explicit entry permission.</p>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  <button className={secondary} disabled={busy} onClick={load}><RefreshCw size={15} className="inline mr-2"/>Refresh invitations</button>
  <div className="space-y-3">{invites.map(invite=><div className={panel} key={invite.booking_id}>
   <p className="font-semibold text-sm capitalize">{invite.role} · {invite.status}</p>
   <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Booking {invite.booking_id} · {formatDate(invite.created_at)}</p>
   <div className="mt-3 flex flex-wrap gap-2">
    {invite.status==='invited'&&<><button className={button} onClick={()=>change(invite.booking_id,'active')}>Accept</button>
      <button className={secondary} onClick={()=>change(invite.booking_id,'declined')}>Decline</button></>}
    {invite.status==='active'&&<button className={button} onClick={()=>open(invite.booking_id)}>View permitted shoot details</button>}
   </div>
  </div>)}
  {!invites.length&&<div className={panel}><p className="text-sm text-[var(--cc-text-secondary)]">No production invitations or accepted assignments yet.</p></div>}
  </div>
  {packet&&<div className={panel+' space-y-3'}>
   <h3 className="flex gap-2 items-center font-semibold"><ShieldCheck size={17}/>Authorized shoot summary</h3>
   <p className="text-sm">{packet.property?.title||'Private location'} · {packet.property?.city||''}</p>
   <p className="text-xs text-[var(--cc-text-secondary)]">{formatDate(packet.starts_at)} – {formatDate(packet.ends_at)} · {packet.requested_use}</p>
   <p className="text-xs text-[var(--cc-text-secondary)]">Agreement: {packet.agreement_status} · Payment: {packet.payment_status} · Insurance: {packet.insurance_status}</p>
   <p className="text-xs whitespace-pre-wrap text-[var(--cc-text-secondary)]">Rules: {packet.property?.rules||'Confirm details with the host'}</p>
   {packet.arrival&&<div className="rounded-lg bg-[var(--cc-surface-subtle)] p-3">
    <p className="font-semibold text-sm">Authorized access</p><p className="text-xs">{packet.arrival.exact_address}</p>
    <p className="mt-2 whitespace-pre-wrap text-xs">{packet.arrival.entry_instructions}</p>
   </div>}
   {!packet.arrival&&<p className="text-xs text-amber-800">Exact entry information is not authorized for your current role.</p>}
   <div className="border-t border-[var(--cc-border)] pt-3 space-y-3">
    <h4 className="flex gap-2 items-center font-semibold"><MessageCircle size={17}/>Booking-specific crew chat</h4>
    <p className="text-xs text-[var(--cc-text-secondary)]">This is a protected conversation, not the full premium member messaging system.</p>
    <div className="max-h-60 overflow-y-auto space-y-2 rounded-lg bg-[var(--cc-surface-subtle)] p-3">
     {messages.map(m=><p className="text-xs break-words" key={m.id}><strong>{m.sender_id?.slice(0,8)}:</strong> {m.body}</p>)}
     {!messages.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No messages yet. A host or guest must create the conversation first.</p>}
    </div>
    <form className="ccx-action-row flex gap-2" onSubmit={send}>
     <input required minLength={1} maxLength={3000} className={input+' flex-1'} value={text} onChange={e=>setText(e.target.value)} placeholder="Coordinate with your production team"/>
     <button className={button} disabled={busy}>Send</button>
    </form>
   </div>
  </div>}
 </section>;
}
