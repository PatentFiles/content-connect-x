import React, { useCallback, useEffect, useState } from 'react';
import { ThumbsUp, Lightbulb, RefreshCw } from 'lucide-react';
import { platformAction } from './platformApi';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-5';
const control='w-full rounded-lg bg-[#0F1520] border border-[#34445D] text-white p-2';
const button='rounded-lg bg-[#4F8CFF] px-4 py-2 text-white text-sm font-semibold disabled:opacity-50';
const stageLabels={submitted:'New',under_review:'Under review',planned:'Planned',in_progress:'In progress',shipped:'Shipped',declined:'Not planned'};
const stages=Object.keys(stageLabels);

export default function FeedbackHub({admin=false}){
  const [items,setItems]=useState([]);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{const r=await platformAction('feedback_list');setItems((r.items||[]).sort((a,b)=>b.votes-a.votes));}
    catch(e){setError(e.message);}finally{setBusy(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  const create=async(event)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{await platformAction('feedback_create',{title,description});setTitle('');setDescription('');setNotice('Feature request published.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const vote=async(id)=>{
    setError('');
    try{await platformAction('feedback_toggle_vote',{feedback_id:id});await load();}
    catch(e){setError(e.message);}
  };
  const change=async(id,status)=>{
    setError('');setBusy(true);
    try{await platformAction('admin_feedback_status',{id,status});await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="space-y-5">
    <div className="flex justify-between items-start gap-3"><div><h2 className="text-2xl font-semibold">Feature requests</h2><p className="text-[#9AA6BC] text-sm mt-1">Suggest and vote on what Content Connect X builds next.</p></div><button className={button} onClick={load} disabled={busy} aria-label="Refresh requests"><RefreshCw size={17}/></button></div>
    {error&&<p role="alert" className="rounded-lg bg-red-950 text-red-200 p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-emerald-950 text-emerald-200 p-3 text-sm">{notice}</p>}
    <form className={panel+' space-y-3'} onSubmit={create}>
      <h3 className="font-semibold flex items-center gap-2"><Lightbulb size={19}/> Suggest an improvement</h3>
      <label className="text-sm block">Feature title<input className={control+' mt-1'} required minLength={5} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label className="text-sm block">What problem should it solve?<textarea rows={3} className={control+' mt-1'} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <button className={button} disabled={busy}>Submit request</button>
    </form>
    <div className="space-y-3">{items.map(item=><article key={item.id} className={panel+' flex gap-3'}>
      <button className={'min-w-[60px] rounded-lg px-3 py-2 h-fit text-sm flex flex-col items-center gap-1 '+(item.voted?'bg-blue-900 text-blue-200':'bg-[#0F1520] text-[#9AA6BC]')} aria-label={item.voted?'Remove vote':'Vote for feature'} onClick={()=>vote(item.id)}>
        <ThumbsUp size={16}/>{item.votes}
      </button>
      <div className="flex-1 min-w-0"><div className="flex justify-between flex-wrap gap-2"><h3 className="font-semibold break-words">{item.title}</h3><span className="text-xs bg-[#24344D] px-2 py-1 rounded-full">{stageLabels[item.status]||item.status}</span></div>
        {item.description&&<p className="text-sm text-[#9AA6BC] mt-2 whitespace-pre-wrap break-words">{item.description}</p>}
        {admin&&<label className="block mt-3 text-sm">Update status<select value={item.status} onChange={e=>change(item.id,e.target.value)} className={control+' mt-1'} disabled={busy}>{stages.map(stage=><option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></label>}
      </div>
    </article>)}
    {!items.length&&<div className={panel}><p className="text-sm text-[#9AA6BC]">No feature requests yet. Be the first.</p></div>}
    </div>
  </div>;
}
