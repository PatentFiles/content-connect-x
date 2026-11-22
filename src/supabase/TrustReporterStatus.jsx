/** Anonymous private case status and two-way correspondence.
 * Reporter holds both receipt ID and a separately generated private access code.
 * Neither is placed into a URL, logs, browser storage or an email.
 */
import React,{useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {validateTrustStatus,validateTrustReply} from '../../supabase/functions/trust-intake/policy.mjs';
export default function TrustReporterStatus({initialReference='',initialAccessCode=''}) {
 const [reference,setReference]=useState(initialReference);
 const [accessCode,setAccessCode]=useState(initialAccessCode);
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [message,setMessage]=useState(''),[notice,setNotice]=useState('');
 const dedupe=useRef(null);
 const request=async body=>{
  const {data,error:failure}=await supabase.functions.invoke('trust-intake',{body});
  if(failure||data?.error){
   let detail=data?.error||'The request could not be processed.';
   if(failure?.context?.json)try{detail=(await failure.context.json())?.error||detail;}catch{/* no change */}
   throw Error(detail);
  }
  return data;
 };
 const refresh=async()=>{
  const payload={action:'status',reference:reference.trim(),access_code:accessCode.trim()};
  validateTrustStatus(payload);
  const data=await request(payload);
  if(data?.verified!==true||!['pending','reviewing','action_required','resolved'].includes(data.status))
   throw Error('The report and private access code could not be confirmed.');
  setResult({status:data.status,message:data.message||'',messages:Array.isArray(data.messages)?data.messages:[]});
 };
 const check=async event=>{
  event.preventDefault();if(busy)return;
  setBusy(true);setError('');setResult(null);setNotice('');
  try{await refresh();}catch(e){setError(e.message||'Report status is unavailable.');}
  finally{setBusy(false);}
 };
 const send=async event=>{
  event.preventDefault();if(busy||!result)return;
  setBusy(true);setError('');setNotice('');
  try{
   dedupe.current||=crypto.randomUUID();
   const body={action:'reply',reference:reference.trim(),access_code:accessCode.trim(),
    idempotency_key:dedupe.current,message};
   validateTrustReply(body);
   const response=await request(body);
   if(response.sent!==true)throw Error('The reply was not recorded. Please retry.');
   dedupe.current=null;setMessage('');setNotice('Your reply was added to your private request.');
   await refresh();
  }catch(e){setError(e.message||'Unable to send reply.');}
  finally{setBusy(false);}
 };
 return <section className="ccx-trust-card" data-private-trust-status="true">
  <h2>Check an existing request</h2>
  <p>Use the reference and private access code from your original receipt. No account is required. Messages are visible only to someone holding both codes and authorized review staff.</p>
  <form onSubmit={check} className="space-y-3">
   <label className="block">Request reference<input required autoComplete="off" maxLength={36} inputMode="text" value={reference} onChange={e=>{setReference(e.target.value);setResult(null);}} placeholder="Reference from your receipt"/></label>
   <label className="block">Private access code<input required autoComplete="off" maxLength={36} inputMode="text" value={accessCode} onChange={e=>{setAccessCode(e.target.value);setResult(null);}} placeholder="Private code (keep this confidential)"/></label>
   <button className="ccx-trust-primary" disabled={busy} type="submit">{busy?'Checking privately…':'Open my request'}</button>
  </form>
  {error&&<p role="alert" className="ccx-trust-error">{error}</p>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {result&&<div className="mt-5 space-y-4" role="region" aria-label="Private request conversation">
   <div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4">
    <p className="text-sm font-semibold capitalize">Status: {result.status.replaceAll('_',' ')}</p>
    <p className="mt-1 text-sm">{result.message}</p>
   </div>
   <div><h3 className="font-semibold">Request messages</h3>
    {result.messages.length===0&&<p className="text-sm">No follow-up messages yet. You can send additional information below.</p>}
    <div className="space-y-2" aria-live="polite">{result.messages.map(item=><article key={item.id} className="rounded-xl border border-[var(--cc-border)] p-3">
     <p className="text-xs font-semibold">{item.author==='staff'?'Content ConnectX support':'You'} · {new Date(item.created_at).toLocaleString()}</p>
     <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
    </article>)}</div>
   </div>
   <form onSubmit={send} className="space-y-2">
    <label className="block">Send a private follow-up<textarea rows={4} maxLength={4000} required minLength={2} value={message} onChange={e=>{setMessage(e.target.value);dedupe.current=null;}} placeholder="Add information or reply to the support team"/></label>
    <button className="ccx-trust-primary" type="submit" disabled={busy||message.trim().length<2}>{busy?'Sending…':'Send private reply'}</button>
   </form>
   <p className="text-xs">A status update is not confirmation of content removal, a finding of wrongdoing, or a legal disclosure. Keep both private codes to check replies later.</p>
  </div>}
 </section>;
}
