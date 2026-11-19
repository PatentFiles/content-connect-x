/** MFA-protected, independently assigned identity evidence review.
 * Staff cannot approve an account here. All decisions remain non-admitting.
 */
import React,{useEffect,useState} from 'react';
import {identityAction} from './identityApi';

const button='ccx-secondary min-h-11 rounded-xl px-4 py-2 text-sm disabled:opacity-50';
const dispositions=[
 ['fresh_capture_required','Request fresh document or camera capture'],
 ['insufficient_evidence','Close without an identity finding'],
 ['specialist_followup','Refer for qualified specialist follow-up']
];
const descriptions={
 queued:'Awaiting a qualified reviewer',
 claimed:'Claimed for private review',
 closed:'Review case closed — this does not approve identity'
};
export default function IdentityEvidenceAdmin(){
 const [sessions,setSessions]=useState([]),[reviewerId,setReviewerId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState(null),[reason,setReason]=useState(''),[disposition,setDisposition]=useState('fresh_capture_required'),[link,setLink]=useState(null);
 const load=async(selectedId=null)=>{
  setBusy(true);setError('');
  try{
   const result=await identityAction('admin_list');
   const items=result.sessions||[];
   setSessions(items);setReviewerId(result.reviewer_id||'');
   setSelected(previous=>{
    const id=selectedId||previous?.id;
    return id?items.find(row=>row.id===id)||null:null;
   });
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!link)return;const timer=window.setTimeout(()=>setLink(null),115000);return()=>window.clearTimeout(timer);},[link]);
 const act=async operation=>{
  if(!selected)return;
  setBusy(true);setError('');setNotice('');setLink(null);
  try{
   await identityAction('admin_case',{session_id:selected.id,operation,disposition:operation==='close'?disposition:null});
   setNotice(operation==='claim'?'Case claimed. Evidence access now requires a recorded reason.':operation==='release'?'Case returned to the review queue.':'Case closed with a non-admitting disposition.');
   const result=await identityAction('admin_list');
   setSessions(result.sessions||[]);setReviewerId(result.reviewer_id||'');
   setSelected((result.sessions||[]).find(row=>row.id===selected.id)||null);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const open=async kind=>{
  if(!selected)return;
  setBusy(true);setError('');setLink(null);
  try{
   const result=await identityAction('admin_document',{session_id:selected.id,kind,reason});
   const url=new URL(result.url);
   if(url.protocol!=='https:'||url.origin!=='https://yxuqbygykpfbioslljlf.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/ccx-identity-evidence/'))throw Error('Untrusted document link.');
   setLink({url:url.href,kind});
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const claimed=selected?.case_status==='claimed'&&selected?.assigned_reviewer_id===reviewerId;
 const reviewable=claimed&&!selected?.purged_at;
 return <section className="ccx-surface space-y-4 rounded-xl p-5" data-identity-review-queue="true">
  <h2 className="text-xl font-semibold">Qualified identity review</h2>
  <p className="text-sm leading-6">Administrators must use two-factor authentication and claim a case before seeing its private evidence. A reviewer cannot access their own evidence or another reviewer’s case. Viewing an ID does not approve anyone, change their age, or bypass a document check.</p>
  <p className="text-xs text-[var(--cc-text-secondary)]">If access is denied, complete an MFA challenge and refresh this queue. This is an internal review tool, not a promise of immediate staffed response.</p>
  <button type="button" disabled={busy} onClick={()=>void load()} className={button}>Refresh case queue</button>
  <div className="max-h-80 space-y-2 overflow-y-auto" aria-label="Identity review cases">
   {sessions.map(item=><button type="button" key={item.id} onClick={()=>{setSelected(item);setLink(null);setReason('');setNotice('');}} className={'block min-h-11 w-full rounded-xl border p-3 text-left text-sm '+(selected?.id===item.id?'border-[var(--cc-link)]':'border-[var(--cc-border)]')}>
    <strong>{descriptions[item.case_status]||'Restricted review'}</strong><span> · {String(item.verification_status||'unknown').replaceAll('_',' ')}</span>
    <span className="block break-all text-xs text-[var(--cc-text-secondary)]">Case {item.id}</span>
    <span className="block text-xs text-[var(--cc-text-secondary)]">{new Date(item.opened_at).toLocaleString()}{item.purged_at?' · Evidence deleted':''}</span>
   </button>)}
   {!sessions.length&&!busy&&<p className="text-sm">No qualified review cases returned.</p>}
  </div>
  {selected&&<div className="space-y-3 rounded-xl border p-4">
   <p className="break-all text-sm">Case {selected.id}</p>
   <p className="text-sm">Case state: <strong>{descriptions[selected.case_status]||selected.case_status}</strong></p>
   {selected.legal_hold&&<p className="text-sm">Retention hold present. Evidence retention is handled separately.</p>}
   {selected.case_status==='queued'&&<button className={button} type="button" disabled={busy} onClick={()=>void act('claim')}>Claim review case</button>}
   {claimed&&<button className={button} type="button" disabled={busy} onClick={()=>void act('release')}>Release case to queue</button>}
   {reviewable&&<>
    <label className="block text-sm font-medium">Purpose of evidence access
     <textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} className="mt-2 block min-h-24 w-full rounded-lg border bg-white p-3 text-slate-900" placeholder="Explain the specific review task. Do not enter ID numbers, names or birth dates."/>
    </label>
    <div className="flex flex-wrap gap-2">{[['front','Front of ID',selected.has_front],['back','Back of ID',selected.has_back],['selfie','Selfie',selected.has_selfie]].map(([kind,label,available])=><button type="button" key={kind} disabled={busy||!available||reason.trim().length<10} onClick={()=>void open(kind)} className={button}>Open {label}</button>)}</div>
    {link&&<a href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block min-h-11 rounded-lg border p-3 text-sm underline">View {link.kind} via temporary private link</a>}
   </>}
   {claimed&&<div className="space-y-3 rounded-xl border p-3">
    <p className="text-sm font-medium">Record a non-admitting outcome</p>
    <label className="block text-sm">Disposition
     <select value={disposition} onChange={e=>setDisposition(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-white p-2 text-slate-900">
      {dispositions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
     </select>
    </label>
    <p className="text-xs">This closes only the review case. It cannot approve identity or grant membership. A verified identity must come from a separately validated check.</p>
    <button className={button} type="button" disabled={busy} onClick={()=>void act('close')}>Close review without approval</button>
   </div>}
   {selected.case_status==='closed'&&<p className="text-sm">Disposition: {dispositions.find(([code])=>code===selected.disposition)?.[1]||'Not available'}. No approval was granted by this review.</p>}
  </div>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-slate-50 p-3 text-sm">{notice}</p>}
 </section>;
}
