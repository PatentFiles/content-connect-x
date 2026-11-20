import React,{useEffect,useState} from 'react';
import {FileText,Save,Sparkles,RefreshCw} from 'lucide-react';
import GroupVideoCall from './GroupVideoCall';
import {suiteAction} from './collabSuiteApi';
const btn='ccx-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
export default function CollaborationWorkshop({collaborationId,userId,onDraftCreated}){
 const [note,setNote]=useState(''),[version,setVersion]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[draft,setDraft]=useState('');
 const load=async()=>{try{const r=await suiteAction('notes_get',{collaboration_id:collaborationId});setNote(r.item.body||'');setVersion(r.item.version||0);}catch(e){setError(e.message);}};
 useEffect(()=>{setDraft('');setError('');void load();},[collaborationId]);
 const save=async()=>{setBusy(true);setError('');setNotice('');try{const r=await suiteAction('notes_save',{collaboration_id:collaborationId,note,version});setVersion(r.version);setNotice('Shared project notes saved as version '+r.version+'.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const generate=async()=>{setBusy(true);setError('');setNotice('');try{const r=await suiteAction('ai_contract',{collaboration_id:collaborationId});setDraft(r.draft||'');setNotice('AI contract draft saved in the collaboration agreement records. Review and route for individual signatures.');onDraftCreated?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className="space-y-4"><section className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><FileText size={18}/>Shared collaboration notes</h3><button type="button" className={btn} disabled={busy} onClick={()=>void load()}><RefreshCw size={15} className="mr-1 inline"/>Refresh</button></div>
 <p className="text-xs text-[var(--cc-text-secondary)]">Every member can add and edit these notes. Each save creates a new version; conflicting edits require refresh. Notes and transcripts are context for contract drafts, not signatures or consent.</p>
 <textarea className={input} value={note} maxLength={20000} rows={6} onChange={e=>setNote(e.target.value)} placeholder="Discussion notes, assigned roles, equipment, deadlines, questions…"/>
 <div className="flex flex-wrap items-center gap-3"><button type="button" className={btn} disabled={busy} onClick={()=>void save()}><Save size={15} className="mr-1 inline"/>Save shared notes</button><span className="text-xs text-[var(--cc-text-secondary)]">Version {version}</span></div></section>
 <GroupVideoCall key={collaborationId} collaborationId={collaborationId} userId={userId}/>
 <section className="space-y-3 rounded-xl border border-[var(--cc-border)] p-4"><h3 className="flex gap-2 font-semibold"><Sparkles size={18}/>AI contract drafting</h3><p className="text-xs text-[var(--cc-text-secondary)]">Uses the collaboration plan, saved notes and transcripts. The generated agreement records roles, scope, deliverables and unresolved terms separately for party review. It must be approved and signed through the agreement workflow.</p>
 <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm disabled:opacity-60" disabled={busy} onClick={()=>void generate()}>{busy?'Drafting…':'Generate contract from scope, notes and transcript'}</button>
 {draft&&<details open><summary className="cursor-pointer font-semibold">Generated contract draft</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm">{draft}</pre></details>}</section>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
 </div>;
