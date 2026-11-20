/** Private collaboration notes and testing deadlines.
 * The notes log is append-only; the scope is never amended without a new
 * member-reviewed agreement and independent informed signatures.
 */
import React,{useEffect,useState} from 'react';
import {FileText,ShieldCheck,Send} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const field='mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2 text-sm';
const primary='ccx-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm disabled:opacity-50';
async function call(action,extra={}){
 const {data,error}=await supabase.functions.invoke('creator-extensions',{body:{action,...extra}});
 if(error||data?.error){let message=data?.error||'Project tools unavailable';if(error?.context?.json)try{message=(await error.context.json()).error||message;}catch{}throw Error(message);}
 return data;
}
export default function CollaborationNotesAndTesting({collaborationId,organizerId,userId}){
 const [notes,setNotes]=useState([]),[text,setText]=useState('');
 const [policy,setPolicy]=useState({required:false,freshness_days:14,verification_deadline:null});
 const [deadline,setDeadline]=useState(''),[status,setStatus]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const canEdit=organizerId===userId;
 const load=async()=>{
  setBusy(true);setError('');
  try{
   const [a,b,c]=await Promise.all([
    call('notes_list',{collaboration_id:collaborationId}),
    call('testing_get',{collaboration_id:collaborationId}),
    call('testing_check',{collaboration_id:collaborationId})
   ]);
   setNotes(a.items||[]);
   setPolicy(b.policy||{required:false,freshness_days:14,verification_deadline:null});
   setDeadline(b.policy?.verification_deadline?new Date(b.policy.verification_deadline).toISOString().slice(0,16):'');
   setStatus(c);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{if(collaborationId&&userId)void load();},[collaborationId,userId]);
 const saveNote=async e=>{
  e.preventDefault();if(busy)return;
  setBusy(true);setNotice('');setError('');
  try{
   const result=await call('notes_add',{collaboration_id:collaborationId,note_text:text});
   setNotes(a=>[...a,result.item]);setText('');
   setNotice('Project note saved in the shared history. It does not edit the contract.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const savePolicy=async e=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const payload={collaboration_id:collaborationId,required:policy.required,
    freshness_days:Number(policy.freshness_days),deadline:deadline?new Date(deadline).toISOString():null};
   await call('testing_save',payload);
   const state=await call('testing_check',{collaboration_id:collaborationId});setStatus(state);
   setNotice('Testing requirement and deadline saved. This is a policy, not a diagnostic result.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <div className="grid gap-4 lg:grid-cols-2" data-project-notes-testing="true">
  <section className="ccx-surface min-w-0 space-y-3 rounded-xl p-4">
   <h3 className="flex items-center gap-2 font-semibold"><FileText size={18}/>Shared project notes</h3>
   <p className="text-xs text-[var(--cc-text-secondary)]">Every confirmed project member can add notes. Entries remain in the project history. AI transcripts and notes may inform a *new proposed scope*, but cannot automatically change an accepted contract.</p>
   <div className="max-h-80 space-y-2 overflow-y-auto" aria-label="Project notes history">
    {notes.map(n=><article key={n.id} className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm">
     <p className="mb-2 text-xs text-[var(--cc-text-secondary)]">{n.author_id===userId?'Your note':'Collaborator note'} · {new Date(n.created_at).toLocaleString()}</p>
     <p className="whitespace-pre-wrap break-words">{n.note_text}</p>
    </article>)}
    {!notes.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No notes have been added.</p>}
   </div>
   <form className="space-y-2" onSubmit={saveNote}>
    <label className="block text-xs">Add a project note<textarea className={field} rows={3} minLength={2} maxLength={5000} required value={text} onChange={e=>setText(e.target.value)} placeholder="Scope discussions, decisions, assigned tasks, or issues requiring follow-up."/></label>
    <button type="submit" className={primary} disabled={busy||text.trim().length<2}><Send size={16}/>Save note</button>
   </form>
  </section>
  <section className="ccx-surface min-w-0 space-y-3 rounded-xl p-4">
   <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/>Testing credential requirements</h3>
   <p className="text-xs text-[var(--cc-text-secondary)]">This status is independently verified work clearance, not personal lab results or a medical diagnosis. Each participant must consent to share an up-to-date yes/no status.</p>
   <div role="status" className="rounded-xl border border-[var(--cc-border)] p-3 text-sm">
    <strong>{status?.required?(status?.ready?'Required clearance confirmed':'Required clearance still outstanding'):'Not required for this collaboration'}</strong>
    {status?.deadline&&<p className="mt-1 text-xs">Deadline: {new Date(status.deadline).toLocaleString()}</p>}
    {status?.deadline_passed&&<p className="mt-1 text-xs text-red-800">The testing deadline has passed and the project is not ready.</p>}
   </div>
   {canEdit?<form className="space-y-3" onSubmit={savePolicy}>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={policy.required===true} onChange={e=>setPolicy(p=>({...p,required:e.target.checked}))}/>
     <span>Require current independently reviewed work-clearance status before the agreement may proceed</span></label>
    <label className="block text-xs">Testing confirmation deadline<input type="datetime-local" className={field} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>
    <label className="block text-xs">Maximum accepted clearance freshness (days)
     <select className={field} value={policy.freshness_days} onChange={e=>setPolicy(p=>({...p,freshness_days:Number(e.target.value)}))}>
      {[7,10,14,21,30,60].map(v=><option value={v} key={v}>{v} days</option>)}
     </select></label>
    <button type="submit" className={primary} disabled={busy}>Save testing requirements</button>
   </form>:<p className="text-xs text-[var(--cc-text-secondary)]">The collaboration organizer manages the testing policy. Each participant independently controls their own medical evidence and clearance-sharing consent.</p>}
   <button type="button" className="ccx-secondary min-h-11 rounded-xl px-3 py-2 text-sm" onClick={()=>void load()} disabled={busy}>Refresh clearance status</button>
  </section>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 lg:col-span-2">{error}</p>}
  {notice&&<p role="status" className="text-sm text-[var(--cc-text-secondary)] lg:col-span-2">{notice}</p>}
 </div>;
}
