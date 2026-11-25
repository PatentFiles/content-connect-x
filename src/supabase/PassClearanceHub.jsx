/** PASS industry-clearance readiness. Only participant-consented yes/no status is shared. */
import React,{useEffect,useState,useMemo} from 'react';
import {ShieldCheck,RefreshCw,FileLock2,UsersRound,UploadCloud,AlertCircle,History,Search,Calendar} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {integrationAction} from './integrationApi';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm';
const button='ccx-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const ghostBtn='rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50';

function formatDateLabel(dateStr){
  const d=new Date(dateStr);
  const weekday=d.toLocaleDateString(undefined,{weekday:'long'});
  const full=d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  return {weekday,full,time:d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})};
}
function isWeekday(dateStr,weekdayName){
  try{return new Date(dateStr).toLocaleDateString(undefined,{weekday:'long'})===weekdayName;}catch{return false;}
}

export default function PassClearanceHub({isAdmin=false}){
 const [connection,setConnection]=useState(null),[collab,setCollab]=useState('');
 const [clearance,setClearance]=useState(null),[collaborations,setCollaborations]=useState([]);
 const [shared,setShared]=useState(null),[files,setFiles]=useState([]),[file,setFile]=useState(null);
 const [history,setHistory]=useState([]);
 const [dateFilter,setDateFilter]=useState({from:'',to:''});
 const [weekdaySearch,setWeekdaySearch]=useState('');
 const [showHistory,setShowHistory]=useState(true);
 const [reviewItems,setReviewItems]=useState([]),[dates,setDates]=useState({}),[confirm,setConfirm]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setBusy(true);setError('');
  try{
   const [a,b,own,projects]=await Promise.all([
    integrationAction('pass_link_status'),integrationAction('clearance_documents_mine'),
    integrationAction('pass_my_clearance'),integrationAction('pass_my_collaborations')]);
   setConnection(a.item);setFiles(b.items||[]);
   setClearance(own);setCollaborations(projects.items||[]);
   if(isAdmin){const v=await integrationAction('admin_clearance_queue');setReviewItems(v.items||[]);}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{void load();},[isAdmin]);
 const loadHistory=async()=>{
  setBusy(true);setError('');
  try{
   const r=await integrationAction('clearance_history',dateFilter);
   setHistory(r.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{if(showHistory)void loadHistory();},[showHistory,dateFilter]);
 const filteredHistory=useMemo(()=>{
  if(!weekdaySearch.trim())return history;
  const term=weekdaySearch.trim().toLowerCase();
  return history.filter(item=>{
    const {weekday}=formatDateLabel(item.created_at);
    return weekday.toLowerCase()===term;
  });
 },[history,weekdaySearch]);

 const execute=async(action,body,success)=>{
  setBusy(true);setError('');setNotice('');
  try{const r=await integrationAction(action,body);setNotice(success||r.note||'Updated.');await load();return r;}
  catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const collaborationStatus=async()=>{
  setBusy(true);setError('');
  try{setShared(await integrationAction('pass_collaboration_status',{collaboration_id:collab}));}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{
  if(!collab)return;
  const timer=setInterval(()=>{void integrationAction('pass_collaboration_status',{collaboration_id:collab}).then(setShared).catch(()=>{});},20000);
  return()=>clearInterval(timer);
 },[collab]);
 const upload=async(e)=>{
  e.preventDefault();
  if(!file)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(file.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))
    throw Error('Only PDF/JPEG/PNG/WebP under 10 MB is accepted');
   const data=await integrationAction('clearance_upload_token',{mime_type:file.type});
   const {error:storageError}=await supabase.storage.from('ccx-private-clearance')
    .uploadToSignedUrl(data.path,data.token,file,{contentType:file.type,upsert:false});
   if(storageError)throw storageError;
   await integrationAction('clearance_submit',{path:data.path});
   setFile(null);setNotice('Private evidence uploaded for independent professional review.');await load();
   if(showHistory)void loadHistory();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const quickFilters=[
  {label:'Last 30 days',from:new Date(Date.now()-30*86400000).toISOString().slice(0,10),to:''},
  {label:'Last 90 days',from:new Date(Date.now()-90*86400000).toISOString().slice(0,10),to:''},
  {label:'Last 6 months',from:new Date(Date.now()-183*86400000).toISOString().slice(0,10),to:''},
  {label:'Last year',from:new Date(Date.now()-365*86400000).toISOString().slice(0,10),to:''},
  {label:'All time',from:'',to:''}
 ];
 return <div className="space-y-4">
  {clearance?.tested_at&&<section className="ccx-surface space-y-4 rounded-2xl p-5" aria-label="Latest testing record"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--cc-text-secondary)]">Latest testing record</p><h2 className="mt-2 text-2xl font-bold">{new Date(clearance.tested_at).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</h2></div><span className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">{clearance.demo?'Passed · sample result':clearance.status==='current'?'Current':'Review status'}</span></div>{clearance.demo&&<p className="text-xs text-[var(--cc-text-secondary)]">Fictional demonstration only. This is not a medical result or a clearance for a real person.</p>}</section>}
  <section className="ccx-surface space-y-3 p-5">
   <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-[var(--cc-link)]"/>PASS work-clearance connection</h3>
   <p className="text-sm text-[var(--cc-text-secondary)]">PASS is the adult-industry work-clearance standard. It tracks a 14-day yes/no status—not private lab panel results. Partner API access needs written approval and technical onboarding.</p>
   <p className="text-xs text-[var(--cc-text-secondary)]">Check your current clearance directly in the <a className="underline text-[var(--cc-link)]" href="https://app.passcertified.org/" target="_blank" rel="noopener noreferrer">official PASS database</a>. Content ConnectX cannot automatically check PASS clearance until PASS grants access to its documented partner interface.</p>
   <p className="text-sm">Connection: <strong className="capitalize">{(connection?.status||'not linked').replaceAll('_',' ')}</strong></p>
   <div role="status" className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 space-y-1">
    <p className="text-sm">Your work-clearance status: <strong className={clearance?.status==='current'?'text-emerald-800':'text-amber-800'}>{clearance?.status==='current'?'Current':'Not currently confirmed'}</strong></p>
    {clearance?.status==='current'&&<p className="text-xs text-[var(--cc-text-secondary)]">Valid until {new Date(clearance.expires_at).toLocaleDateString()} · {clearance.source==='pass'?'PASS':'Independently reviewed provider'}</p>}
    <p className="text-xs text-[var(--cc-text-secondary)]">This is work availability only, not a clinical test result or a medical diagnosis.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button className={button} disabled={busy} onClick={()=>execute('pass_link',{allow_status_sync:true})}>Consent to future PASS linking</button>
    <button className="ccx-secondary rounded-xl px-4 py-2.5 text-sm" disabled={busy} onClick={()=>execute('pass_disconnect',{},'PASS linking consent withdrawn.')}>Disconnect</button>
   </div>
  </section>
  <section className="ccx-surface space-y-3 p-5">
   <h3 className="flex items-center gap-2 font-semibold"><FileLock2 size={18} className="text-[var(--cc-link)]"/>Private testing-document upload</h3>
   <p className="text-xs text-[var(--cc-text-secondary)]">Optional fallback while PASS linking is unavailable. Your medical document is private and can be viewed only by authorized reviewers; it is never shared with collaborators.</p>
   <form onSubmit={upload} className="flex flex-wrap items-center gap-3">
    <input className="max-w-xs text-xs" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/>
    <button className={button+' inline-flex gap-2 items-center'} disabled={busy||!file}><UploadCloud size={16}/>Submit for review</button>
   </form>
   {files.map(v=><p className="text-xs text-[var(--cc-text-secondary)]" key={v.id}>Submission {new Date(v.created_at).toLocaleDateString()} · <strong>{v.status.replaceAll('_',' ')}</strong></p>)}
  </section>

  <section className="ccx-surface space-y-3 p-5">
   <button type="button" className="flex w-full items-center justify-between" onClick={()=>setShowHistory(v=>!v)}>
    <h3 className="flex items-center gap-2 font-semibold"><History size={18} className="text-[var(--cc-link)]"/>Testing history log</h3>
    <span className="text-xs text-[var(--cc-text-secondary)]">{showHistory?'Hide':'Show'}</span>
   </button>
   {!showHistory&&<p className="text-xs text-[var(--cc-text-secondary)]">A complete, persistent record of every testing document submission and clearance status change. Searchable by date range and weekday.</p>}
   {showHistory&&<div className="space-y-4">
    <p className="text-xs text-[var(--cc-text-secondary)]">Every testing document submission and clearance status change is saved permanently in the backend. Use the filters below to find specific records.</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <label className="text-sm block">From date<input type="date" className={input+' mt-1'} value={dateFilter.from} onChange={e=>setDateFilter(p=>({...p,from:e.target.value}))}/></label>
     <label className="text-sm block">To date<input type="date" className={input+' mt-1'} value={dateFilter.to} onChange={e=>setDateFilter(p=>({...p,to:e.target.value}))}/></label>
     <label className="text-sm block">Search by weekday<input className={input+' mt-1'} placeholder="e.g. Sunday" value={weekdaySearch} onChange={e=>setWeekdaySearch(e.target.value)}/></label>
     <div className="ccx-action-row flex items-end gap-2">
      <button className={button} disabled={busy} onClick={loadHistory}><Search size={14} className="inline mr-1"/>Search</button>
      <button className={ghostBtn} disabled={busy} onClick={()=>{setDateFilter({from:'',to:''});setWeekdaySearch('');}}>Reset</button>
     </div>
    </div>
    <div className="flex flex-wrap gap-2">
     {quickFilters.map(f=><button key={f.label} className={ghostBtn} style={{borderColor:(dateFilter.from===f.from&&dateFilter.to===f.to)?'var(--cc-blue)':'var(--cc-border)'}} onClick={()=>setDateFilter({from:f.from,to:f.to})}><Calendar size={12} className="inline mr-1"/>{f.label}</button>)}
    </div>
    {filteredHistory.length===0&&<div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4 text-center"><p className="text-sm text-[var(--cc-text-secondary)]">{history.length===0?'No testing history records found.':'No records match your weekday search.'}</p></div>}
    {filteredHistory.length>0&&<div className="space-y-2 max-h-[500px] overflow-y-auto">
      {filteredHistory.map(item=>{
        const {full,time}=formatDateLabel(item.created_at);
        const isDoc=item.kind==='document';
        const statusColor=item.status==='verified_offsite'||item.clearance_confirmed===true?'text-emerald-800':
          item.status==='rejected'?'text-red-800':'text-amber-800';
        const statusText=item.demo?(item.status==='current'?'Passed · example':'Historical · expired'):isDoc?(item.status||'').replaceAll('_',' '):(item.clearance_confirmed?'Cleared':'Not cleared');
        return <div key={item.id} className="rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{isDoc?'Document submission':'Clearance event'}</p>
              <p className="text-xs text-[var(--cc-text-secondary)] mt-0.5">{full} at {time}</p>
              {isDoc&&item.review_note&&<p className="text-xs text-[var(--cc-text-secondary)] mt-1 break-words">Note: {item.review_note}</p>}
              {!isDoc&&item.provider_reference&&<p className="text-xs text-[var(--cc-text-secondary)] mt-1">Provider: {item.provider_reference}</p>}
              {!isDoc&&item.expires_at&&<p className="text-xs text-[var(--cc-text-secondary)]">Valid until: {new Date(item.expires_at).toLocaleDateString()}</p>}
            </div>
            <span className={'text-xs font-semibold shrink-0 '+statusColor}>{statusText}</span>
          </div>
        </div>;
      })}
    </div>}
   </div>}
  </section>

  <section className="ccx-surface space-y-3 p-5">
   <h3 className="flex items-center gap-2 font-semibold"><UsersRound size={18} className="text-[var(--cc-link)]"/>Collaboration work-clearance sharing</h3>
   <p className="text-xs text-[var(--cc-text-secondary)]">Each performer must opt in for their clearance status to appear to collaboration partners. New confirmations can be reflected for both partners when they refresh; private results and diagnoses are never shown.</p>
   <label className="text-sm block" htmlFor="ccx-testing-collaboration">Your collaboration
    <select id="ccx-testing-collaboration" className={input+' mt-1'} value={collab}
      onChange={e=>{setCollab(e.target.value);setShared(null);}}>
     <option value="">Select a collaboration</option>
     {collaborations.map(project=><option key={project.id} value={project.id}>{project.title||'Untitled collaboration'} · {project.status}</option>)}
    </select>
   </label>
   {!collaborations.length&&<p className="text-xs text-[var(--cc-text-secondary)]">Your collaborations will appear here once you join or create a production team.</p>}
   <div className="flex flex-wrap gap-2">
    <button className={button} disabled={busy||!collab} onClick={async()=>{const r=await execute('pass_share',{collaboration_id:collab,allow_binary_clearance_share:true},'You opted in to sharing work-clearance status.');if(r)await collaborationStatus();}}>Share my status</button>
    <button className="ccx-secondary rounded-xl px-4 py-2.5 text-sm" disabled={busy||!collab} onClick={async()=>{const r=await execute('pass_revoke',{collaboration_id:collab},'Work-clearance sharing withdrawn.');if(r)await collaborationStatus();}}>Withdraw sharing</button>
    <button className="ccx-secondary inline-flex gap-2 items-center rounded-xl px-4 py-2.5 text-sm" disabled={busy||!collab} onClick={collaborationStatus}><RefreshCw size={16}/>Refresh all status</button>
   </div>
   {shared&&<div className="space-y-2 rounded-xl bg-[var(--cc-surface-subtle)] p-3">
    <p className="text-xs text-[var(--cc-text-secondary)]">{shared.participants_ready?'All opted-in participants have current recorded clearance, but live PASS production-hold status still requires independent verification.':'Some participant clearance is missing, expired or not shared.'}</p>
    {(shared.members||[]).map(m=><div key={m.user_id} className="flex justify-between gap-2 border-b border-[var(--cc-border)] py-1 text-xs">
      <span className="truncate">{m.user_id.slice(0,8)}…</span>
      <strong className={m.clearance==='current'?'text-emerald-800':'text-amber-800'}>{m.clearance.replaceAll('_',' ')}</strong>
    </div>)}
    {shared.production_hold_unknown&&<p className="flex gap-2 items-center text-xs text-amber-800"><AlertCircle size={16}/>PASS production holds are not monitored here. Check the official PASS system directly before arranging a shoot.</p>}
   </div>}
  </section>
  {isAdmin&&<section className="ccx-surface space-y-3 p-5">
   <h3 className="font-semibold">Private provider-document review (administrator only)</h3>
   <p className="text-xs text-amber-800">A PDF does not prove that a performer is cleared. Independently contact/verify the approved lab or PASS partner before recording any manual clearance.</p>
   {reviewItems.map(v=><article key={v.id} className="rounded-xl border border-[var(--cc-border)] p-3 text-xs space-y-2">
    <p>Performer {v.user_id} · {v.status}</p>
    <button className="ccx-secondary rounded-lg px-3 py-2" onClick={async()=>{try{const d=await integrationAction('admin_clearance_document',{id:v.id});const u=new URL(d.url);if(u.protocol==='https:')window.open(u.toString(),'_blank','noopener,noreferrer');}catch(e){setError(e.message);}}}>Open private evidence (90 sec)</button>
    <label className="block">First sample collection date<input className={input+' mt-1'} type="date" value={dates[v.id]||''} onChange={e=>setDates(p=>({...p,[v.id]:e.target.value}))}/></label>
    <label className="flex min-w-0 items-start gap-2"><input type="checkbox" className="mt-1 shrink-0" checked={Boolean(confirm[v.id])} onChange={e=>setConfirm(p=>({...p,[v.id]:e.target.checked}))}/><span className="min-w-0 break-words">I independently verified current clearance with the qualified provider, not merely this uploaded document.</span></label>
    <div className="ccx-action-row flex gap-2">
     <button className={button} disabled={busy||!confirm[v.id]||!dates[v.id]} onClick={()=>execute('admin_clearance_review',{id:v.id,decision:'verified_offsite',independent_provider_confirmation:true,sample_collected_on:dates[v.id]},'Confirmed status for 14 days from sample date.')}>Record verified clearance</button>
     <button className="ccx-secondary rounded-lg px-3 py-2" disabled={busy} onClick={()=>execute('admin_clearance_review',{id:v.id,decision:'rejected'},'Submission rejected.')}>Reject</button>
    </div>
   </article>)}
  </section>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
 </div>;
}
