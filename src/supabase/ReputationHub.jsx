import React, { useEffect, useState } from 'react';
import { Star, ShieldCheck, RefreshCw } from 'lucide-react';
import { productionAction } from './productionApi';
import { supabase } from '@/api/supabaseClient';
const panel='rounded-xl bg-[#151D2B] border border-[#263248] p-5';
const field='w-full border border-[#34445D] bg-[#0F1520] p-2 rounded-lg text-sm';
const button='ccx-action-primary rounded-lg text-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
export default function ReputationHub({isAdmin=false}){
  const [projects,setProjects]=useState([]);
  const [target,setTarget]=useState('');
  const [project,setProject]=useState('');
  const [rating,setRating]=useState(5);
  const [comment,setComment]=useState('');
  const [reviews,setReviews]=useState([]);
  const [moderation,setModeration]=useState([]);
  const [summary,setSummary]=useState(null);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const refresh=async()=>{
    setBusy(true);setError('');
    try{
      const {data,error:e}=await supabase.functions.invoke('member-workflows',{body:{action:'list_collaborations'}});
      if(e||data?.error)throw new Error(data?.error||e?.message||'Unavailable');
      setProjects(data.items||[]);
      if(isAdmin){const r=await productionAction('admin_review_queue');setModeration(r.items||[]);}
      if(target){const r=await productionAction('review_public',{reviewee_id:target});setReviews(r.items||[]);setSummary(r.summary);}
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  useEffect(()=>{refresh();},[]);
  const act=async(action,args,success)=>{
    setBusy(true);setError('');setNotice('');
    try{const r=await productionAction(action,args);setNotice(success);await refresh();return r;}
    catch(e){setError(e.message);return null;}finally{setBusy(false);}
  };
  return <section className="space-y-5">
    <div className="flex items-center justify-between"><div><h2 className="text-2xl font-semibold">Verified collaboration reputation</h2><p className="text-sm text-[#9AA6BC] mt-1">Reviews must come from completed, confirmed productions and are moderated before publication.</p></div><button className={button} onClick={refresh} disabled={busy}><RefreshCw size={16}/></button></div>
    {error&&<p role="alert" className="text-red-200 bg-red-950 p-3 rounded-lg text-sm">{error}</p>}
    {notice&&<p role="status" className="text-emerald-200 bg-emerald-950 p-3 rounded-lg text-sm">{notice}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      <div className={panel+' space-y-3'}><h3 className="font-semibold flex gap-2 items-center"><ShieldCheck size={17}/> Complete a production</h3><p className="text-sm text-[#9AA6BC]">Every participant must confirm completion after DocuSign evidence and current consent are on file.</p>
        {projects.map(x=><div key={x.id} className="border-b border-[#34445D] pb-3"><p className="text-sm font-semibold">{x.title} · {x.status}</p><button className={button+' mt-2'} disabled={busy||x.status==='completed'} onClick={()=>{if(window.confirm('Confirm this production is complete and all obligations are fulfilled?'))act('collaboration_completion_vote',{collaboration_id:x.id,acknowledged:true},'Completion acknowledgment recorded.');}}>Confirm completion</button></div>)}
        {!projects.length&&<p className="text-sm text-[#9AA6BC]">No collaborations yet.</p>}
      </div>
      <form className={panel+' space-y-3'} onSubmit={e=>{e.preventDefault();act('review_create',{collaboration_id:project,reviewee_id:target,rating,comment},'Review submitted for moderation.');}}>
        <h3 className="font-semibold flex gap-2 items-center"><Star size={17}/> Review a verified collaborator</h3>
        <label className="text-sm block">Completed project<select required className={field+' mt-1'} value={project} onChange={e=>setProject(e.target.value)}><option value="">Choose</option>{projects.filter(x=>x.status==='completed').map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label>
        <label className="text-sm block">Collaborator member ID<input className={field+' mt-1'} required value={target} onChange={e=>setTarget(e.target.value)} placeholder="Verified member UUID"/></label>
        <label className="text-sm block">Rating (1–5)<select className={field+' mt-1'} value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="text-sm block">Professional feedback<textarea className={field+' mt-1'} maxLength={1000} rows={3} value={comment} onChange={e=>setComment(e.target.value)}/></label>
        <button disabled={!project||!target||busy} className={button}>Submit review</button>
      </form>
    </div>
    <div className={panel+' space-y-3'}><h3 className="font-semibold">Public verified reviews</h3><div className="flex gap-2"><input className={field} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Member UUID"/><button className={button} disabled={busy||!target} onClick={refresh}>Search</button></div>
      {summary&&<p className="text-sm text-blue-300">{summary.count} verified reviews · {summary.average??'No'} average rating</p>}
      {reviews.map(r=><div key={r.id} className="border-b border-[#34445D] pb-3"><p className="font-semibold">{r.rating}/5</p><p className="text-sm whitespace-pre-wrap">{r.comment}</p></div>)}
    </div>
    {isAdmin&&<div className={panel+' space-y-3'}><h3 className="font-semibold">Review moderation queue ({moderation.length})</h3>{moderation.map(r=><div key={r.id} className="border-b border-[#34445D] pb-3"><p className="text-sm">Rating {r.rating}/5 — {r.comment}</p><div className="flex gap-2 mt-2"><button className={button} disabled={busy} onClick={()=>act('admin_review_decide',{review_id:r.id,status:'published'},'Review published.')}>Approve</button><button className="rounded-lg bg-red-700 px-4 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={()=>act('admin_review_decide',{review_id:r.id,status:'hidden'},'Review hidden.')}>Reject</button></div></div>)}</div>}
  </section>;
}
