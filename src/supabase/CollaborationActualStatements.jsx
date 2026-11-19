/** Actual work records are independent participant statements, NOT proof of
 * consent, a new agreement, or an amendment to another member's obligations.
 */
import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';

const control='min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-[var(--cc-text-primary)]';
async function requestActuals(action,collaborationId,values={}){
 const {data,error}=await supabase.functions.invoke('collaboration-actuals',{body:{action,collaboration_id:collaborationId,...values}});
 if(error||data?.error){
  let reason=data?.error||'The completion statement could not be saved. Check before retrying.';
  if(error?.context?.json)try{reason=(await error.context.json())?.error||reason;}catch{}
  throw Error(reason);
 }
 return data;
}
export default function CollaborationActualStatements({collaborationId,detail,userId}){
 const [statements,setStatements]=useState([]);
 const [work,setWork]=useState(''),[deliverables,setDeliverables]=useState(''),[differences,setDifferences]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const submissionKey=useRef(null),inFlight=useRef(false);
 useEffect(()=>{
  let active=true;
  setError('');setNotice('');setStatements([]);setWork('');setDeliverables('');setDifferences('');submissionKey.current=null;
  void requestActuals('list',collaborationId).then(data=>{if(active)setStatements(data.statements||[]);},e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[collaborationId]);
 const finished=Boolean(detail?.plan?.ends_at&&Date.parse(detail.plan.ends_at)<=Date.now());
 const cancelled=['cancelled','closed'].includes(detail?.collaboration?.status);
 const allowed=finished&&!cancelled;
 const change=(fn,value)=>{submissionKey.current=null;fn(value);setNotice('');};
 const submit=async event=>{
  event.preventDefault();
  if(inFlight.current||!allowed)return;
  inFlight.current=true;setBusy(true);setError('');setNotice('');
  try{
   submissionKey.current||=crypto.randomUUID();
   await requestActuals('submit',collaborationId,{idempotency_key:submissionKey.current,
    work_completed:work,deliverables_completed:deliverables,differences_or_concerns:differences});
   const data=await requestActuals('list',collaborationId);
   setStatements(data.statements||[]);
   setWork('');setDeliverables('');setDifferences('');submissionKey.current=null;
   setNotice('Your statement was recorded. Earlier versions and other participants’ statements remain unchanged.');
  }catch(e){setError(e.message);}finally{inFlight.current=false;setBusy(false);}
 };
 const memberNames=new Map((detail?.members||[]).map(m=>[m.user_id,m.profile?.display_name||'Participant']));
 return <section className="space-y-4 rounded-xl border border-[var(--cc-border)] p-4" data-collaboration-actuals="true">
  <header className="space-y-2"><h3 className="font-semibold">Proposed work versus what participants report completing</h3>
   <p className="text-sm text-[var(--cc-text-secondary)]">After the scheduled work, each participant may record their own account of services and deliverables. Statements are not independently verified facts. Differences remain visible and may be disputed; no one can change another participant’s statement, consent, contract, or rights.</p>
  </header>
  <div className="rounded-lg bg-[var(--cc-surface-subtle)] p-3 text-sm">
   <p><strong>Original proposed scope:</strong> {detail?.plan?.scope_of_work||'Not recorded'}</p>
   <p className="mt-1"><strong>Proposed deliverables:</strong> {detail?.plan?.deliverables||'Not recorded'}</p>
   <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">See the preserved plan-version history for agreed changes and the signed-contract workspace for any binding rights.</p>
  </div>
  <div className="space-y-3">
   <h4 className="text-sm font-semibold">Individual completion statements</h4>
   {!statements.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No participant completion statements have been recorded.</p>}
   {statements.map(item=><article key={item.id} className="rounded-xl border border-[var(--cc-border)] p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.actor_id===userId?'Your statement':memberNames.get(item.actor_id)||'Participant statement'} · Revision {item.revision}</strong><span className="text-xs text-[var(--cc-text-secondary)]">{new Date(item.recorded_at).toLocaleString()}</span></div>
    <dl className="mt-2 space-y-2">
     <div><dt className="text-xs text-[var(--cc-text-secondary)]">Work personally reported</dt><dd className="whitespace-pre-wrap break-words">{item.work_completed}</dd></div>
     {item.deliverables_completed&&<div><dt className="text-xs text-[var(--cc-text-secondary)]">Deliverables personally reported</dt><dd className="whitespace-pre-wrap break-words">{item.deliverables_completed}</dd></div>}
     {item.differences_or_concerns&&<div><dt className="text-xs text-[var(--cc-text-secondary)]">Differences or concerns reported</dt><dd className="whitespace-pre-wrap break-words">{item.differences_or_concerns}</dd></div>}
    </dl>
    <p className="mt-2 text-xs text-[var(--cc-text-secondary)]">Captured against proposed plan version {item.plan_version}; this does not amend the plan.</p>
   </article>)}
  </div>
  {allowed?<form onSubmit={submit} className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4">
   <h4 className="font-semibold">Record your own work statement</h4>
   <p className="text-xs text-[var(--cc-text-secondary)]">Submitting a correction adds a new immutable revision. Do not include identification evidence, medical records, or explicit media. This form cannot grant new permissions or obligations.</p>
   <label className="block text-sm">Work you personally completed (required)
    <textarea value={work} onChange={e=>change(setWork,e.target.value)} maxLength={4000} rows={3} minLength={5} required className={control} placeholder="Describe professional work you personally completed."/>
   </label>
   <label className="block text-sm">Deliverables you personally produced (optional)
    <textarea value={deliverables} onChange={e=>change(setDeliverables,e.target.value)} maxLength={4000} rows={2} className={control} placeholder="List delivered files or professional services without sharing private media."/>
   </label>
   <label className="block text-sm">Differences or concerns (optional)
    <textarea value={differences} onChange={e=>change(setDifferences,e.target.value)} maxLength={4000} rows={2} className={control} placeholder="Record any difference from the proposed plan or disagreement."/>
   </label>
   <button type="submit" disabled={busy||work.trim().length<5} className="ccx-primary min-h-11 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{busy?'Saving…':'Record my statement / new revision'}</button>
  </form>:<p className="text-xs text-[var(--cc-text-secondary)]">{cancelled?'Completion statements are unavailable for cancelled or closed projects.':detail?.plan?.ends_at?'Individual work statements become available after the scheduled production end time.':'Set a production end time before recording post-production work.'}</p>}
  <p className="text-xs text-[var(--cc-text-secondary)]">For disputes, abuse, or coercion, use the separate safety reporting process. Participant statements cannot override consent withdrawal or unsigned contract terms.</p>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{notice}</p>}
 </section>;
}
