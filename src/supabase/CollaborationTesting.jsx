import React,{useEffect,useState} from 'react';
import {ShieldCheck,FileCheck2} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {suiteAction} from './collabSuiteApi';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm';
const button='ccx-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-50';
export function TestingCredentials({userId}){
 const [items,setItems]=useState([]),[tested,setTested]=useState(''),[expires,setExpires]=useState(''),[issuer,setIssuer]=useState(''),[file,setFile]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{try{setItems((await suiteAction('testing_list')).items||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();},[userId]);
 const submit=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   if(!file)throw Error('Select your private test documentation');
   if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Select a PDF or image under 10 MB');
   const suffix=file.name.split('.').at(-1).toLowerCase();
   const path=userId+'/testing/'+crypto.randomUUID()+'.'+suffix;
   const {error}=await supabase.storage.from('member-private').upload(path,file,{contentType:file.type,upsert:false});
   if(error)throw error;
   await suiteAction('testing_submit',{tested_at:tested+'T12:00:00Z',expires_at:expires+'T23:59:59Z',issuer,document_path:path});
   setTested('');setExpires('');setIssuer('');setFile(null);setNotice('Credential submitted for private review.');await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-4 p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><FileCheck2 size={20}/>Private testing credentials</h3>
 <p className="text-xs text-[var(--cc-text-secondary)]">These documents stay private. Collaborators see only whether the agreed testing policy is satisfied, never clinical results.</p>
 <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Test date<input className={input} type="date" value={tested} onChange={e=>setTested(e.target.value)}/></label>
 <label className="text-sm">Credential expiration<input className={input} type="date" min={tested||undefined} value={expires} onChange={e=>setExpires(e.target.value)}/></label>
 <label className="text-sm">Issuing laboratory<input className={input} value={issuer} maxLength={120} onChange={e=>setIssuer(e.target.value)}/></label></div>
 <label className="block text-sm">Private test documentation<input className={input+' mt-1'} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
 <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy||!file||!tested||!expires} onClick={()=>void submit()}>{busy?'Submitting…':'Submit for verification'}</button>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
 <div className="space-y-2">{items.map(x=><p className="border-t border-[var(--cc-border)] pt-2 text-sm" key={x.id}>{x.issuer||'Testing credential'} · {String(x.tested_at).slice(0,10)}–{String(x.expires_at).slice(0,10)} · <b>{x.status}</b></p>)}</div>
 </section>;
}
export function CollaborationTesting({collaborationId,organizer=false}){
 const [policy,setPolicy]=useState({requires_testing:false,tested_within_days:30,deadline_at:''}),[status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{try{const result=await suiteAction('testing_policy_get',{collaboration_id:collaborationId});setPolicy({...result.policy,deadline_at:result.policy.deadline_at?String(result.policy.deadline_at).slice(0,16):''});setStatus(result.status);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();},[collaborationId]);
 const save=async()=>{setBusy(true);setError('');try{await suiteAction('testing_policy_save',{collaboration_id:collaborationId,...policy,deadline_at:policy.deadline_at?new Date(policy.deadline_at).toISOString():null});setNotice('Testing rules saved.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="rounded-xl border border-[var(--cc-border)] p-4 space-y-3"><h3 className="flex gap-2 font-semibold"><ShieldCheck size={18}/>Collaboration testing policy</h3>
 {organizer&&<><label className="flex gap-2 text-sm"><input type="checkbox" checked={policy.requires_testing} onChange={e=>setPolicy(p=>({...p,requires_testing:e.target.checked}))}/>Require current verified testing credentials from creator participants</label>
 <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Test must be within days<input type="number" min={1} max={365} className={input} value={policy.tested_within_days} onChange={e=>setPolicy(p=>({...p,tested_within_days:Number(e.target.value)}))}/></label>
 <label className="text-sm">Testing deadline<input type="datetime-local" className={input} value={policy.deadline_at} onChange={e=>setPolicy(p=>({...p,deadline_at:e.target.value}))}/></label></div>
 <button type="button" className={button} disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save testing policy'}</button></>}
 {status&&<div className="text-sm"><b>{status.required?(status.ready?'Testing satisfied':'Testing needs attention'):'Testing not required by this plan'}</b>{status.deadline_at&&<p className="text-xs">Deadline: {new Date(status.deadline_at).toLocaleString()}</p>}{status.participants?.map(p=><p key={p.user_id} className="text-xs">Creator {p.user_id.slice(0,8)}: {p.satisfied?'Verified and current':'Credential required'}</p>)}</div>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>;
}
export function TestingReviewQueue(){
 const [items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{try{setItems((await suiteAction('testing_admin_queue')).items||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();},[]);
 const viewDocument=async id=>{
  setBusy(true);setError('');
  try{
   const result=await suiteAction('testing_admin_document',{id});
   const safe=new URL(result.url);
   if(safe.protocol!=='https:')throw Error('Private document URL invalid');
   window.open(safe.toString(),'_blank','noopener,noreferrer');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const review=async(id,status)=>{setBusy(true);setError('');try{await suiteAction('testing_admin_review',{id,status});setNotice('Credential review saved.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="ccx-surface space-y-3 p-5"><h3 className="font-semibold">Pending credential reviews</h3>
 <p className="text-xs text-[var(--cc-text-secondary)]">Confirm evidence privately before marking verified; these dates are not clinical results.</p>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {items.map(x=><div className="space-y-2 border-b border-[var(--cc-border)] py-3" key={x.id}><p className="text-sm">Member {x.user_id.slice(0,8)} · {x.issuer} · {String(x.tested_at).slice(0,10)} to {String(x.expires_at).slice(0,10)}</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>void viewDocument(x.id)} className={button}>Review private document</button><button type="button" disabled={busy} onClick={()=>void review(x.id,'verified')} className={button}>Verify</button><button type="button" disabled={busy} onClick={()=>void review(x.id,'rejected')} className={button}>Reject</button></div></div>)}
 {!items.length&&<p className="text-sm">No pending credentials.</p>}
 </section>;
}