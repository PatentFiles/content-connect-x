/** Private, voluntary attendance statement. It is NOT a safety monitoring service. */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';

const actionButton='ccx-secondary min-h-11 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50';
const labels={not_started:'Not checked in',checked_in:'Self-reported arrival',safe:'Marked safe by you',left:'You recorded leaving',concern_recorded:'A concern was privately recorded'};
async function safetyCall(action,collaborationId,contactInformed=false){
 const {data,error}=await supabase.functions.invoke('collaboration-safety',{
  body:{action,collaboration_id:collaborationId,contact_informed:contactInformed}
 });
 if(error||data?.error){
  let message=data?.error||'Check-in is unavailable. No update was confirmed.';
  if(error?.context?.json)try{const body=await error.context.json();message=body?.error||message;}catch{}
  throw Error(message);
 }
 if(!data?.item||data.item.monitored_emergency_response!==false)throw Error('Your check-in could not be confirmed. Please check status before retrying.');
 return data.item;
}
export default function CollaborationSafetyCheckin({collaborationId,onNavigate=(_destination,_context)=>{}}){
 const [item,setItem]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[contactInformed,setContactInformed]=useState(false);
 useEffect(()=>{
  let active=true;setItem(null);setNotice('');setError('');
  void safetyCall('status',collaborationId).then(data=>{if(active){setItem(data);setContactInformed(data.contact_informed_by_member===true);}},e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[collaborationId]);
 const act=async(action)=>{
  if(busy)return;
  setBusy(true);setNotice('');setError('');
  try{
   const next=await safetyCall(action,collaborationId,contactInformed);
   setItem(prev=>({...prev,...next}));
   setNotice(action==='check_in'?'Your voluntary arrival statement was recorded. This does not confirm anyone else’s safety.':action==='mark_safe'?'You marked yourself safe; prior concern events remain in the private history.':action==='leave'?'Your departure statement was recorded. You may independently withdraw consent.':'A private concern marker was recorded. It did not notify emergency services or a staffed response team; use the reporting options below.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const status=item?.status||'not_started';
 return <section data-collaboration-safety="true" aria-labelledby="collab-safety-heading" className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4">
  <div className="space-y-1"><h3 id="collab-safety-heading" className="font-semibold">Voluntary location safety check-in</h3>
   <p className="text-sm text-[var(--cc-text-secondary)]">Record your own arrival, departure or concern. This does not verify your physical location, use GPS tracking, change a contract or compel you to remain.</p></div>
  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Not monitored for emergencies.</strong> A saved check-in or concern does not contact a trusted person, dispatch emergency services, or guarantee staff intervention. If you are in danger, leave when you can safely do so and contact local emergency services.</p>
  {!item&&!error&&<p role="status" className="text-sm">Loading your private check-in…</p>}
  {item&&<>
   <p role="status" className="text-sm">Your status: <strong>{labels[status]||status}</strong></p>
   {status==='not_started'&&<>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={contactInformed} onChange={e=>setContactInformed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/><span>I independently informed a trusted contact about my plans, if I chose to. No contact information is transmitted or stored by this check-in.</span></label>
    <button type="button" disabled={busy||!item.can_check_in} onClick={()=>void act('check_in')} className={actionButton}>I have arrived — check in</button>
    {!item.can_check_in&&<p className="text-xs text-[var(--cc-text-secondary)]">{item.schedule_available?'Arrival check-in becomes available near the scheduled production window.':'Set a production date and time before an arrival check-in.'}</p>}
   </>}
   {['checked_in','concern_recorded'].includes(status)&&<button type="button" disabled={busy} onClick={()=>void act('mark_safe')} className={actionButton}>I am safe — check out</button>}
   {status!=='left'&&<button type="button" disabled={busy} onClick={()=>void act('leave')} className={actionButton}>Leave / record departure</button>}
   {!item.concern_recorded_at&&<button type="button" disabled={busy} onClick={()=>void act('record_concern')} className={actionButton}>Record safety concern</button>}
   {item.concern_recorded_at&&<p className="text-sm">A concern was recorded on {new Date(item.concern_recorded_at).toLocaleString()}. This is a private timestamp, not a submitted safety report or acknowledged emergency request.</p>}
   <div className="flex flex-wrap gap-3 text-sm"><a href="/trust/content-removal" className="inline-flex min-h-11 items-center underline text-[var(--cc-link)]">Safety reporting options</a><button type="button" className="min-h-11 underline text-[var(--cc-link)]" onClick={()=>onNavigate('consent',{collaborationId})}>Review / withdraw consent</button></div>
  </>}
  {notice&&<p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{notice}</p>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error} You can still use the public contact and safety information page.</p>}
 </section>;
}
