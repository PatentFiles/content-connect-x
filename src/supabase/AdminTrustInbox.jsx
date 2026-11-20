/** Restricted support, affiliate, safety and legal-request inbox.
 * All requests share one audited case queue. Membership in "admin" alone is
 * insufficient to read private payloads; the RPCs additionally require AAL2.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Inbox,RefreshCw,ShieldCheck,Send,LockKeyhole} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const field='mt-1 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const btn='ccx-secondary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const label=k=>String(k||'').replaceAll('_',' ');
const isID=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(value);
const fmt=date=>date?new Date(date).toLocaleString():'Unspecified';
async function call(name,args){
 const {data,error}=await supabase.rpc(name,args);
 if(error)throw Error(error.message||'Restricted support service unavailable');
 return data;
}
export default function AdminTrustInbox({initialCaseId='',onNavigate=(destination)=>{void destination;}}){
 const [cases,setCases]=useState([]),[viewer,setViewer]=useState(null),[selected,setSelected]=useState(null),[thread,setThread]=useState([]);
 const [filter,setFilter]=useState('open'),[status,setStatus]=useState('reviewing'),[note,setNote]=useState(''),[reply,setReply]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const generation=useRef(0),replyToken=useRef(null),activeId=useRef(''),openedInitial=useRef('');
 const load=useCallback(async()=>{
  const n=++generation.current;setError('');
  try{
   const result=await call('ccx_trust_triage',{p_action:'list'});
   if(n!==generation.current)return;
   setCases(result.items||[]);setViewer(result.reviewer_id||null);
  }catch(e){if(n===generation.current){setError(e.message);setCases([]);}}
 },[]);
 const open=useCallback(async id=>{
  if(!isID(id))return;
  setBusy(true);setError('');
  try{
   const [caseData,threadData]=await Promise.all([
    call('ccx_trust_review',{p_action:'read',p_id:id}),
    call('ccx_trust_staff_thread',{p_id:id})
   ]);
   activeId.current=id;setSelected(caseData);setThread(threadData.items||[]);
   setStatus(caseData.status==='resolved'?'resolved':caseData.status==='action_required'?'action_required':'reviewing');
   setNote('');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 },[]);
 useEffect(()=>{
  void load();
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);
  const onFocus=()=>void load();
  window.addEventListener('focus',onFocus);
  // Member notification inserts already drive the header bell; reuse those
  // events to refresh the inbox without subscribing to confidential case tables.
  const channel=supabase.channel('admin-trust-inbox').on('postgres_changes',
   {event:'INSERT',schema:'public',table:'member_notifications'},()=>void load()).subscribe();
  return()=>{generation.current++;clearInterval(interval);window.removeEventListener('focus',onFocus);void supabase.removeChannel(channel);};
 },[load]);
 useEffect(()=>{if(isID(initialCaseId)&&openedInitial.current!==initialCaseId){openedInitial.current=initialCaseId;void open(initialCaseId);}},[initialCaseId,open]);
 const claim=async(action)=>{
  if(!selected)return;
  setBusy(true);setError('');setNotice('');
  try{
   await call('ccx_trust_triage',{p_action:action,p_id:selected.id});
   await Promise.all([load(),open(selected.id)]);
   setNotice(action==='claim'?'This request is assigned to you.':'Request released to the support queue.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const update=async event=>{
  event.preventDefault();if(!selected)return;
  setBusy(true);setError('');setNotice('');
  try{
   await call('ccx_trust_review',{p_action:'update',p_id:selected.id,p_status:status,p_note:note});
   await Promise.all([load(),open(selected.id)]);
   setNotice('Case status and internal review note recorded.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const send=async event=>{
  event.preventDefault();if(!selected||!reply.trim())return;
  setBusy(true);setError('');setNotice('');
  try{
   replyToken.current||=crypto.randomUUID();
   const result=await call('ccx_trust_staff_reply',{p_id:selected.id,p_message:reply,p_idempotency:replyToken.current});
   if(!result?.sent)throw Error('The reply was not saved. Please retry.');
   setReply('');replyToken.current=null;
   const messages=await call('ccx_trust_staff_thread',{p_id:selected.id});
   setThread(messages.items||[]);
   setNotice('Your response is saved. The reporter can read it securely using their receipt reference and access code.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const visible=cases.filter(item=>{
  if(filter==='open')return item.status!=='resolved';
  if(filter==='mine')return item.assigned_reviewer_id===viewer&&item.status!=='resolved';
  if(filter==='urgent')return item.status!=='resolved'&&(item.priority==='critical'||item.priority==='high'||item.overdue);
  if(filter==='unassigned')return item.status!=='resolved'&&!item.assigned_reviewer_id;
  if(filter==='resolved')return item.status==='resolved';
  return true;
 });
 const unresolved=cases.filter(x=>x.status!=='resolved').length;
 const mine=cases.filter(x=>x.assigned_reviewer_id===viewer&&x.status!=='resolved').length;
 const pending=cases.filter(x=>x.status!=='resolved'&&(x.priority==='critical'||x.priority==='high'||x.overdue)).length;
 return <section className="space-y-4" data-admin-trust-inbox="true" aria-label="Administrator support and safety request inbox">
  <div className="flex flex-wrap items-center justify-between gap-3"><div>
   <h2 className="flex items-center gap-2 text-lg font-semibold"><Inbox size={20}/>Support, affiliates and safety requests</h2>
   <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Confidential requests from every footer contact form are routed here for all administrators. Access and replies are audited.</p>
  </div><button type="button" className={btn} disabled={busy} onClick={()=>void load()}><RefreshCw size={16} className="mr-1 inline"/>Refresh inbox</button></div>
  <div className="grid gap-2 sm:grid-cols-3" aria-label="Request counts">
   <div className="rounded-xl border border-[var(--cc-border)] p-3"><p className="text-xs text-[var(--cc-text-secondary)]">Unresolved in queue</p><p className="text-xl font-semibold">{unresolved}</p></div>
   <div className="rounded-xl border border-[var(--cc-border)] p-3"><p className="text-xs text-[var(--cc-text-secondary)]">Assigned to me</p><p className="text-xl font-semibold">{mine}</p></div>
   <div className="rounded-xl border border-[var(--cc-border)] p-3"><p className="text-xs text-[var(--cc-text-secondary)]">Urgent or overdue</p><p className="text-xl font-semibold">{pending}</p></div>
  </div>
  {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
   <p>{error}</p>
   {(/two.factor|aal2|admin|authorization|permission/i.test(error))&&<p className="mt-2">Sign in as an active administrator with two-factor authentication to access confidential cases. <button type="button" className="underline" onClick={()=>onNavigate?.('settings')}>Open account security settings</button></p>}
  </div>}
  {notice&&<p role="status" className="rounded-xl border border-[var(--cc-border)] p-3 text-sm">{notice}</p>}
  <div className="flex flex-wrap gap-2" role="group" aria-label="Filter support requests">
   {[['open','Open'],['urgent','Urgent'],['unassigned','Unassigned'],['mine','Mine'],['resolved','Resolved'],['all','All']].map(([key,title])=>
   <button key={key} type="button" aria-pressed={filter===key} className={filter===key?'ccx-primary rounded-xl px-3 py-2 text-sm':btn} onClick={()=>setFilter(key)}>{title}</button>)}
  </div>
  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)]">
   <section className="ccx-surface max-h-[680px] space-y-2 overflow-y-auto rounded-xl p-3" aria-label="Case queue">
    {!visible.length&&<p className="p-3 text-sm text-[var(--cc-text-secondary)]">No requests match this filter.</p>}
    {visible.map(item=><button type="button" key={item.id} disabled={busy}
      className={'block w-full rounded-xl border p-3 text-left text-sm '+(selected?.id===item.id?'border-[var(--cc-link)] bg-[var(--cc-surface-hover)]':'border-[var(--cc-border)]')}
      onClick={()=>void open(item.id)}>
     <span className="flex flex-wrap items-center gap-2"><strong className="capitalize">{label(item.kind)}</strong><span className="text-xs capitalize">· {item.priority}</span></span>
     <span className="mt-1 block text-xs capitalize">{label(item.status)}{item.overdue?' · Overdue':''}</span>
     <span className="mt-1 block text-xs text-[var(--cc-text-secondary)]">Received {fmt(item.created_at)}</span>
     {item.due_at&&<span className="mt-1 block text-xs text-[var(--cc-text-secondary)]">Triage target {fmt(item.due_at)}</span>}
     <span className="mt-1 block text-xs">{item.assigned_reviewer_id?'Assigned to staff':'Unassigned'}</span>
    </button>)}
   </section>
   <section className="ccx-surface min-w-0 space-y-4 rounded-xl p-4" aria-label="Selected support request">
    {!selected&&<p className="text-sm text-[var(--cc-text-secondary)]">Select a request to view details, claim ownership, send a private reply, and record an outcome.</p>}
    {selected&&<><header className="flex flex-wrap justify-between gap-2"><div>
     <h3 className="font-semibold capitalize">{label(selected.kind)} · {label(selected.priority)}</h3>
     <p className="text-xs text-[var(--cc-text-secondary)]">Request {selected.id} · {fmt(selected.created_at)}</p>
    </div><span className="text-xs capitalize">{label(selected.status)}</span></header>
    <div className="flex flex-wrap gap-2">
     {selected.assigned_reviewer_id===viewer?<button type="button" className={btn} disabled={busy||selected.status==='resolved'} onClick={()=>void claim('release')}>Release assignment</button>
     :selected.assigned_reviewer_id?<p className="text-xs">Claimed by another administrator.</p>
     :<button type="button" className={btn} disabled={busy||selected.status==='resolved'} onClick={()=>void claim('claim')}><LockKeyhole size={15} className="mr-1 inline"/>Claim request</button>}
    </div>
    <div className="space-y-3 rounded-xl bg-[var(--cc-surface-subtle)] p-3"><h4 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16}/>Submitted request</h4>
     {Object.entries(selected.payload||{}).filter(([,value])=>value!==''&&value!==false&&value!==null).map(([field,value])=><div key={field}>
      <p className="text-xs font-semibold capitalize">{label(field)}</p><p className="whitespace-pre-wrap break-words text-sm">{String(value)}</p>
     </div>)}
    </div>
    <div className="space-y-2"><h4 className="font-semibold">Private conversation</h4>
     {!thread.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No follow-ups yet.</p>}
     <div className="max-h-72 space-y-2 overflow-y-auto" aria-live="polite">{thread.map(item=><article className="rounded-xl border border-[var(--cc-border)] p-3" key={item.id}>
      <p className="text-xs font-semibold">{item.author==='staff'?'Support team':'Reporter'} · {fmt(item.created_at)}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.body}</p>
     </article>)}</div>
     <form onSubmit={send} className="space-y-2">
      <label className="block text-sm">Reply to reporter<textarea className={field} required minLength={2} maxLength={4000} rows={3} value={reply} disabled={busy||selected.assigned_reviewer_id!==viewer} onChange={e=>{setReply(e.target.value);replyToken.current=null;}} placeholder="Your message is available in the reporter's secure request portal."/></label>
      <button type="submit" className={btn} disabled={busy||selected.assigned_reviewer_id!==viewer||reply.trim().length<2}><Send size={15} className="mr-1 inline"/>Save and send reply</button>
      <p className="text-xs text-[var(--cc-text-secondary)]">A reporter retrieves replies with their private receipt code; this action does not send an email.</p>
     </form>
    </div>
    <form className="space-y-3 border-t border-[var(--cc-border)] pt-4" onSubmit={update}>
     <h4 className="font-semibold">Record case outcome</h4>
     <label className="block text-sm">Status<select className={field} value={status} onChange={e=>setStatus(e.target.value)} disabled={selected.assigned_reviewer_id!==viewer}>
      <option value="reviewing">Reviewing</option><option value="action_required">Action required</option><option value="resolved">Resolved</option>
     </select></label>
     <label className="block text-sm">Internal action or review note<textarea className={field} rows={3} required minLength={10} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} disabled={selected.assigned_reviewer_id!==viewer}/></label>
     <button type="submit" className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy||selected.assigned_reviewer_id!==viewer||note.trim().length<10}>Save case outcome</button>
     <p className="text-xs text-[var(--cc-text-secondary)]">Internal notes are not shown to reporters. Only staff actions and actually completed responses may be recorded as resolved.</p>
    </form>
    </>}
   </section>
  </div>
 </section>;
}
