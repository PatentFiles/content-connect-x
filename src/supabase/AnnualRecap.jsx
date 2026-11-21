/** Year in Review: private by default, with explicit, separately chosen sharing.
 * All metrics arrive from an authenticated, immutable backend snapshot.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {CalendarDays,Download,Share2,RefreshCw,LockKeyhole,Trophy,EyeOff,Copy} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const button='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const primary='ccx-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const labels=[
 ['collaborations','Collaborations'],
 ['new_friends','New Friends'],
 ['published_posts','Published Posts'],
 ['completed_projects','Completed Projects'],
 ['featured_portfolio_items','Portfolio Highlights'],
 ['shared_media','Approved Media'],
 ['shared_trips','Shared Trips'],
 ['new_representations','Representation']
];
async function invoke(action,data={}){
 const {data:result,error}=await supabase.functions.invoke('annual-recap',{body:{action,...data}});
 if(error||result?.error){
  let message=typeof result?.error==='string'?result.error:null;
  if(!message&&error?.context?.clone)try{
   const body=await error.context.clone().json();
   if(typeof body?.error==='string')message=body.error;
  }catch{/* Keep the safe fallback. */}
  throw Error(message||'Year in Review is temporarily unavailable. Please retry.');
 }
 return result;
}
export default function AnnualRecap(){
 const [available,setAvailable]=useState([]),[selectedYear,setSelectedYear]=useState(null);
 const [report,setReport]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[shareConfirm,setShareConfirm]=useState(false);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const value=await invoke('list');
   const entries=Array.isArray(value?.items)?value.items:[];
   setAvailable(entries);
   setSelectedYear(old=>entries.some(x=>x.year===old)?old:entries[0]?.year||null);
  }catch(e){setError(e.message);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!selectedYear){setReport(null);return;}
  let live=true;setError('');setReport(null);setShareConfirm(false);
  void invoke('view',{year:selectedYear}).then(data=>{
   if(live)setReport(data?.report||null);
  }).catch(e=>{if(live)setError(e.message);});
  return()=>{live=false;};
 },[selectedYear]);
 const updateReport=async()=>{
  if(!selectedYear)return;
  const r=await invoke('view',{year:selectedYear});
  setReport(r?.report||null);
 };
 const file=async()=>{
  if(!report)return;
  setBusy(true);setError('');setNotice('');
  try{
   const data=await invoke('download_pdf',{year:report.year});
   const blob=data instanceof Blob?data:null;
   if(!blob||!blob.size)throw Error('PDF generation did not return a file.');
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='ContentConnectX-'+report.year+'-YearInReview.pdf';
   document.body.appendChild(a);a.click();a.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),60000);
   setNotice('Your private Year in Review PDF is ready. You may upload it to social media if you choose.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const shareFeed=async()=>{
  if(!report||!shareConfirm||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await invoke('share_feed',{year:report.year});
   if(!response?.result?.id)throw Error('Your recap was not confirmed on the feed.');
   await updateReport();
   setShareConfirm(false);
   setNotice(response.result.already_shared?'Your recap was already posted.':'Your recap totals were posted to the verified community. Your private PDF was not shared.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const hideFeed=async()=>{
  if(!report||busy||!window.confirm('Hide your annual recap from the Feed? It will remain private in your account.'))return;
  setBusy(true);setError('');
  try{await invoke('hide_feed',{year:report.year});await updateReport();setNotice('Your recap post has been hidden.');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const copy=async()=>{
  if(!report)return;
  try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(report.share_text);
   setNotice('Your aggregate achievement summary was copied. No private PDF or documents were shared.');
  }catch{setError('Copy is unavailable in this browser. Download the PDF or use your device Share menu.');}
 };
 const shareSocial=()=>{
  if(!report)return;
  const info={title:report.year+' Content Connect X Year in Review',text:report.share_text};
  if(navigator.share){
   void navigator.share(info).then(()=>setNotice('Your device handled the share request.'))
    .catch(err=>{if(err?.name!=='AbortError')setError('Your device could not complete sharing. Use Copy summary instead.');});
  }else void copy();
 };
 const currentYear=new Date().getUTCFullYear(),upcoming=Math.max(2026,currentYear);
 return <section className="mx-auto max-w-5xl space-y-6" data-annual-recap="true" aria-label="Year in Review">
  <header className="ccx-surface relative overflow-hidden rounded-2xl p-6 sm:p-8">
   <div className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full bg-cyan-500/10"/>
   <div className="relative flex flex-wrap items-start justify-between gap-4">
    <div className="space-y-2">
     <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--cc-link)]"><Trophy size={17}/>Your professional story</p>
     <h1 className="text-3xl font-bold sm:text-4xl">Year in Review</h1>
     <p className="max-w-2xl text-sm text-[var(--cc-text-secondary)]">A private, verified snapshot of the people, projects and milestones that shaped your year. Choose when and where to share.</p>
    </div>
    <button type="button" className={button} disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={16}/>Refresh</button>
   </div>
  </header>
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-[var(--cc-border)] p-4 text-sm">{notice}</p>}
  {loading&&<p role="status" className="ccx-surface rounded-xl p-5 text-sm">Loading your annual reports…</p>}
  {!loading&&!available.length&&<section className="ccx-surface space-y-3 rounded-2xl p-6">
   <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={20}/>Your first recap</h2>
   <p className="text-sm text-[var(--cc-text-secondary)]">Reports for {upcoming} become available on January 1, {upcoming+1}, after the reporting year closes. You will receive an account notification when yours is prepared.</p>
   <p className="text-xs text-[var(--cc-text-secondary)]">All six professional roles are included. Only independently verified and active accounts are eligible; no report is automatically posted.</p>
  </section>}
  {!loading&&available.length>0&&<div className="space-y-5">
   <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">Reporting year
    <select className="rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface)] px-4 py-2"
     value={selectedYear||''} onChange={e=>setSelectedYear(Number(e.target.value))}>
     {available.map(item=><option key={item.year} value={item.year}>{item.year}</option>)}
    </select>
   </label>
   {!report?<p role="status" className="ccx-surface rounded-xl p-5">Preparing your private report…</p>:<>
    <section className="ccx-surface overflow-hidden rounded-2xl">
     <div className="bg-slate-900 p-6 text-white sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Content Connect X</p>
      <p className="mt-3 text-6xl font-bold tabular-nums sm:text-7xl">{report.year}</p>
      <h2 className="mt-2 text-2xl font-semibold">Your Year in Review</h2>
      <p className="mt-2 text-sm text-slate-200">{report.displayName} · {report.roleLabel}</p>
     </div>
     <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-6">
      {labels.map(([key,label])=><div className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4" key={key}>
       <strong className="text-3xl font-bold tabular-nums">{report.metrics?.[key]??0}</strong>
       <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{label}</p>
      </div>)}
     </div>
     <div className="space-y-2 border-t border-[var(--cc-border)] p-5">
      <h3 className="font-semibold">Your milestones</h3>
      {report.achievements?.length?<div className="grid gap-2 sm:grid-cols-2">
       {report.achievements.map(item=><div className="rounded-lg bg-[var(--cc-surface-subtle)] p-3" key={item.title}>
        <p className="font-semibold">{item.title}</p><p className="text-xs text-[var(--cc-text-secondary)]">{item.detail}</p>
       </div>)}</div>:<p className="text-sm text-[var(--cc-text-secondary)]">Your first achievements are still ahead. This report preserves your recorded starting point.</p>}
     </div>
    </section>
    <section className="ccx-surface space-y-4 rounded-2xl p-5">
     <div className="flex items-center gap-2"><LockKeyhole size={19}/><h2 className="font-semibold">Download or share — you are in control</h2></div>
     <p className="text-sm text-[var(--cc-text-secondary)]">Your full report is private until you choose to export it. Sharing a summary never publishes your original PDF or any sensitive records.</p>
     <div className="flex flex-wrap gap-3">
      <button type="button" className={primary} disabled={busy} onClick={()=>void file()}><Download size={16}/>Download PDF</button>
      <button type="button" className={button} disabled={busy} onClick={shareSocial}><Share2 size={16}/>Share to social media</button>
      <button type="button" className={button} disabled={busy} onClick={()=>void copy()}><Copy size={16}/>Copy summary</button>
     </div>
     {!report.feedPostId?<div className="space-y-3 border-t border-[var(--cc-border)] pt-4">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={shareConfirm} onChange={e=>setShareConfirm(e.target.checked)} className="mt-1"/>
       I choose to publish the aggregate achievement totals shown above to the verified Connect Feed. No private PDF, messages or documents will be shared.</label>
      <button type="button" className={primary} disabled={busy||!shareConfirm} onClick={()=>void shareFeed()}><Share2 size={16}/>Publish to Connect Feed</button>
     </div>:<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cc-border)] pt-4">
      <p className="text-sm">{report.feedHidden?'Your previously shared recap is hidden.':'Your recap summary is published to the verified Feed.'}</p>
      {!report.feedHidden&&<button type="button" className={button} disabled={busy} onClick={()=>void hideFeed()}><EyeOff size={16}/>Hide Feed post</button>}
     </div>}
    </section>
    <p className="text-xs text-[var(--cc-text-secondary)]">Totals reflect recorded activity in the calendar year (UTC), not estimates. Removed or hidden items are excluded where relevant. A member's role is captured at report generation time.</p>
   </>}
  </div>}
 </section>;
}