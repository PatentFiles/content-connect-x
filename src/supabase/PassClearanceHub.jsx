/** PASS industry-clearance readiness. Only participant-consented yes/no status is shared. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,RefreshCw,FileLock2,UsersRound,UploadCloud,AlertCircle} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {integrationAction} from './integrationApi';
const input='w-full rounded-xl border border-[#34465C] bg-[#0B1423] px-3 py-2.5 text-sm';
export default function PassClearanceHub({isAdmin=false}){
 const [connection,setConnection]=useState(null),[collab,setCollab]=useState('');
 const [clearance,setClearance]=useState(null),[collaborations,setCollaborations]=useState([]);
 const [shared,setShared]=useState(null),[files,setFiles]=useState([]),[file,setFile]=useState(null);
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
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <div className="space-y-4">
  <section className="ccx-surface space-y-3 p-5">
   <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-[#FF8ADE]"/>PASS work-clearance connection</h3>
   <p className="text-sm text-[#B4C4D9]">PASS is the adult-industry work-clearance standard. It tracks a 14-day yes/no status—not private lab panel results. Partner API access needs written approval and technical onboarding.</p>
   <p className="text-xs text-[#B4C4D9]">Check your current clearance directly in the <a className="underline text-[#FF8ADE]" href="https://app.passcertified.org/" target="_blank" rel="noopener noreferrer">official PASS database</a>. Content Connect X cannot automatically check PASS clearance until PASS grants access to its documented partner interface.</p>
   <p className="text-sm">Connection: <strong className="capitalize">{(connection?.status||'not linked').replaceAll('_',' ')}</strong></p>
   <div role="status" className="rounded-xl border border-[#334058] bg-[#101B2D] p-3 space-y-1">
    <p className="text-sm">Your work-clearance status: <strong className={clearance?.status==='current'?'text-emerald-300':'text-amber-200'}>{clearance?.status==='current'?'Current':'Not currently confirmed'}</strong></p>
    {clearance?.status==='current'&&<p className="text-xs text-[#B4C4D9]">Valid until {new Date(clearance.expires_at).toLocaleDateString()} · {clearance.source==='pass'?'PASS':'Independently reviewed provider'}</p>}
    <p className="text-xs text-[#9FAFC9]">This is work availability only, not a clinical test result or a medical diagnosis.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button className="ccx-primary rounded-xl px-4 py-2.5 text-sm" disabled={busy} onClick={()=>execute('pass_link',{allow_status_sync:true})}>Request PASS account linking</button>
    <button className="ccx-secondary rounded-xl px-4 py-2.5 text-sm" disabled={busy} onClick={()=>execute('pass_disconnect',{},'PASS linking consent withdrawn.')}>Disconnect</button>
   </div>
  </section>
  <section className="ccx-surface space-y-3 p-5">
   <h3 className="flex items-center gap-2 font-semibold"><FileLock2 size={18} className="text-[#FF8ADE]"/>Private testing-document upload</h3>
   <p className="text-xs text-[#AABAD2]">Optional fallback while PASS linking is unavailable. Your medical document is private and can be viewed only by authorized reviewers; it is never shared with collaborators.</p>
   <form onSubmit={upload} className="flex flex-wrap items-center gap-3">
    <input className="max-w-xs text-xs" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/>
    <button className="ccx-primary inline-flex gap-2 items-center rounded-xl px-4 py-2.5 text-sm" disabled={busy||!file}><UploadCloud size={16}/>Submit for review</button>
   </form>
   {files.map(v=><p className="text-xs text-[#C0CEE4]" key={v.id}>Submission {new Date(v.created_at).toLocaleDateString()} · <strong>{v.status.replaceAll('_',' ')}</strong></p>)}
  </section>
  <section className="ccx-surface space-y-3 p-5">
   <h3 className="flex items-center gap-2 font-semibold"><UsersRound size={18} className="text-[#FF8ADE]"/>Collaboration work-clearance sharing</h3>
   <p className="text-xs text-[#AABAD2]">Each performer must opt in for their clearance status to appear to collaboration partners. New confirmations can be reflected for both partners when they refresh; private results and diagnoses are never shown.</p>
   <label className="text-sm block" htmlFor="ccx-testing-collaboration">Your collaboration
    <select id="ccx-testing-collaboration" className={input+' mt-1'} value={collab}
      onChange={e=>{setCollab(e.target.value);setShared(null);}}>
     <option value="">Select a collaboration</option>
     {collaborations.map(project=><option key={project.id} value={project.id}>{project.title||'Untitled collaboration'} · {project.status}</option>)}
    </select>
   </label>
   {!collaborations.length&&<p className="text-xs text-[#AABAD2]">Your collaborations will appear here once you join or create a production team.</p>
   <div className="flex flex-wrap gap-2">
    <button className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy||!collab} onClick={async()=>{const r=await execute('pass_share',{collaboration_id:collab,allow_binary_clearance_share:true},'You opted in to sharing work-clearance status.');if(r)await collaborationStatus();}}>Share my status</button>
    <button className="ccx-secondary rounded-xl px-4 py-2 text-sm" disabled={busy||!collab} onClick={async()=>{const r=await execute('pass_revoke',{collaboration_id:collab},'Work-clearance sharing withdrawn.');if(r)await collaborationStatus();}}>Withdraw sharing</button>
    <button className="ccx-secondary inline-flex gap-2 items-center rounded-xl px-4 py-2 text-sm" disabled={busy||!collab} onClick={collaborationStatus}><RefreshCw size={16}/>Refresh all status</button>
   </div>
   {shared&&<div className="space-y-2 rounded-xl bg-[#101B2F] p-3">
    <p className="text-xs text-[#B5C5DC]">{shared.ready?'All opted-in members currently cleared.':'Production clearance is incomplete or hidden.'}</p>
    {(shared.members||[]).map(m=><div key={m.user_id} className="flex justify-between gap-2 border-b border-[#35435F] py-1 text-xs">
      <span className="truncate">{m.user_id.slice(0,8)}…</span>
      <strong className={m.clearance==='current'?'text-emerald-300':'text-amber-200'}>{m.clearance.replaceAll('_',' ')}</strong>
    </div>)}
    {shared.production_hold_unknown&&<p className="flex gap-2 items-center text-xs text-amber-200"><AlertCircle size={16}/>PASS production holds are not monitored until official partner access is active.</p>}
   </div>}
  </section>
  {isAdmin&&<section className="ccx-surface space-y-3 p-5">
   <h3 className="font-semibold">Private provider-document review (MFA required)</h3>
   <p className="text-xs text-amber-200">A PDF does not prove that a performer is cleared. Independently contact/verify the approved lab or PASS partner before recording any manual clearance.</p>
   {reviewItems.map(v=><article key={v.id} className="rounded-xl border border-[#32445E] p-3 text-xs space-y-2">
    <p>Performer {v.user_id} · {v.status}</p>
    <button className="ccx-secondary rounded-lg px-3 py-2" onClick={async()=>{try{const d=await integrationAction('admin_clearance_document',{id:v.id});const u=new URL(d.url);if(u.protocol==='https:')window.open(u.toString(),'_blank','noopener,noreferrer');}catch(e){setError(e.message);}}}>Open private evidence (90 sec)</button>
    <label className="block">First sample collection date<input className={input+' mt-1'} type="date" value={dates[v.id]||''} onChange={e=>setDates(p=>({...p,[v.id]:e.target.value}))}/></label>
    <label className="flex gap-2 items-start"><input type="checkbox" checked={Boolean(confirm[v.id])} onChange={e=>setConfirm(p=>({...p,[v.id]:e.target.checked}))}/>I independently verified current clearance with the qualified provider, not merely this uploaded document.</label>
    <div className="flex gap-2">
     <button className="ccx-primary rounded-lg px-3 py-2" disabled={busy||!confirm[v.id]||!dates[v.id]} onClick={()=>execute('admin_clearance_review',{id:v.id,decision:'verified_offsite',independent_provider_confirmation:true,sample_collected_on:dates[v.id]},'Confirmed status for 14 days from sample date.')}>Record verified clearance</button>
     <button className="ccx-secondary rounded-lg px-3 py-2" disabled={busy} onClick={()=>execute('admin_clearance_review',{id:v.id,decision:'rejected'},'Submission rejected.')}>Reject</button>
    </div>
   </article>)}
  </section>}
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
 </div>;
}
