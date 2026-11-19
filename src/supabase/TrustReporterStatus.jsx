/** Private reference + access-code status lookup. Nothing is stored in local
 * storage or URLs. A case number alone cannot reveal confidential report data.
 */
import React,{useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {validateTrustStatus} from '../../supabase/functions/trust-intake/policy.mjs';
export default function TrustReporterStatus({initialReference='',initialAccessCode=''}) {
 const [reference,setReference]=useState(initialReference);
 const [accessCode,setAccessCode]=useState(initialAccessCode);
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const check=async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('');setResult(null);
  try{
   const payload={action:'status',reference:reference.trim(),access_code:accessCode.trim()};
   validateTrustStatus(payload);
   const {data,error:failure}=await supabase.functions.invoke('trust-intake',{body:payload});
   if(failure||data?.error||data?.verified!==true){
    let message=data?.error||'We could not confirm the report status.';
    if(failure?.context?.json)try{message=(await failure.context.json())?.error||message;}catch{}
    throw Error(message);
   }
   if(!['pending','reviewing','action_required','resolved'].includes(data.status))throw Error('Status is temporarily unavailable.');
   setResult({status:data.status,message:data.message||''});
  }catch(e){setError(e.message||'Report status is unavailable.');}
  finally{setBusy(false);}
 };
 return <section className="ccx-trust-card" data-private-trust-status="true">
  <h2>Check an existing report</h2>
  <p>Use the reference and private access code from your original receipt. No account is required. Your status check does not expose confidential report details or send an email.</p>
  <form onSubmit={check} className="space-y-3">
   <label className="block">Report reference<input required autoComplete="off" maxLength={36} inputMode="text" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference from your receipt"/></label>
   <label className="block">Private access code<input required autoComplete="off" maxLength={36} inputMode="text" value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Private code (keep this confidential)"/></label>
   <button className="ccx-trust-primary" disabled={busy} type="submit">{busy?'Checking privately…':'Check report status'}</button>
  </form>
  {error&&<p role="alert" className="ccx-trust-error">{error}</p>}
  {result&&<div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4" role="status">
    <p className="text-sm font-semibold capitalize">Status: {result.status.replaceAll('_',' ')}</p>
    <p className="mt-1 text-sm">{result.message}</p>
    <p className="mt-2 text-xs">A status update is not confirmation that content was removed, an allegation substantiated, or a legal disclosure made. Contact the published support channel to request an appeal or further information.</p>
   </div>}
 </section>;
}
