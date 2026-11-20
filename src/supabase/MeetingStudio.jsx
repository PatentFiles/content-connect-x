import React,{useEffect,useState} from 'react';
import {Users,RefreshCw,Send,FileText,ShieldCheck,FileAudio} from 'lucide-react';
import LiveMeeting from './LiveMeeting';
import {meetingAction} from './meetingSuiteApi';
const btn='ccx-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const friendly={collaboration:'Collaboration',conversation:'Private conversation',group:'Community group'};

export default function MeetingStudio({scope,scopeId,userId,onNavigate,inline=false}){
 const [members,setMembers]=useState([]),[notes,setNotes]=useState(''),[version,setVersion]=useState(0),[recordings,setRecordings]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [myConsent,setMyConsent]=useState(false),[ready,setReady]=useState(false);
 const api=(action,data={})=>meetingAction(action,scope,scopeId,data);
 const refresh=async()=>{
  setError('');
  try{
   const [info,noteItems,recs]=await Promise.all([
    api('details'),api('notes_get'),api('recordings_list')
   ]);
   setMembers(info.participants||[]);
   setMyConsent(Boolean((info.participants||[]).find(p=>p.user_id===userId)?.recording_approved));
   setReady(info.recording_ready===true);
   setNotes(noteItems.item?.body||'');setVersion(noteItems.item?.version||0);
   setRecordings(recs.items||[]);
  }catch(e){setError(e.message||'Unable to open meeting');}
 };
 const reloadRecordings=async()=>{
  try{setRecordings((await api('recordings_list')).items||[]);}catch(e){setError(e.message);}
 };
 useEffect(()=>{setMembers([]);setNotes('');setVersion(0);void refresh();},[scope,scopeId]);
 const updateConsent=async approved=>{
  setBusy(true);setError('');setNotice('');
  try{
   await api('consent_set',{approved});
   await refresh();
   setNotice(approved?'Your meeting recording permission is recorded. You can withdraw permission at any time.':'Your meeting recording permission was withdrawn.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const invite=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   const result=await api('invite');
   setNotice(result.invited+' participant(s) notified in their Content Connect X notifications.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const save=async()=>{
  setBusy(true);setError('');setNotice('');
  try{
   const result=await api('notes_save',{body:notes,version});
   setVersion(result.version);setNotice('Meeting notes saved as version '+result.version+'. Everyone in this meeting can read and update them.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const transcribe=async item=>{
  setBusy(true);setError('');
  try{
   await api('transcribe',{recording_id:item.id});
   await reloadRecordings();setNotice('Recording transcript saved for this meeting.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 if(!['collaboration','conversation','group'].includes(scope)||!scopeId)
  return <p role="alert" className="ccx-surface p-5 text-sm">Choose a collaboration, conversation, or group to start a meeting.</p>;
 return <section data-meeting-studio="true" className={inline?'space-y-5':'mx-auto max-w-6xl space-y-5'}>
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="flex items-center gap-2 text-xl font-bold"><Users size={19}/>{friendly[scope]} video conference</h2>
    <p className="text-xs text-[var(--cc-text-secondary)]">Invite your existing participants, take shared notes, record with permission, and retrieve transcripts.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    {!inline&&onNavigate&&<button type="button" className={btn} onClick={()=>onNavigate(scope==='collaboration'?'collaborations':scope==='conversation'?'messages':'groups')}>Back</button>}
    <button type="button" className={btn} disabled={busy} onClick={()=>void refresh()}><RefreshCw size={15} className="mr-1 inline"/>Refresh</button>
    <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy||!members.length} onClick={()=>void invite()}><Send size={15} className="mr-1 inline"/>Invite all participants</button>
   </div>
  </header>
  {error&&<p role="alert" className="rounded-xl border border-red-300 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="text-sm text-[var(--cc-text-secondary)]">{notice}</p>}
  <div className="ccx-surface space-y-3 rounded-xl p-4">
   <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/>Participants and recording permission</h3>
   <div className="flex flex-wrap gap-2">{members.map(p=><span key={p.user_id}
    className="rounded-full border border-[var(--cc-border)] px-3 py-1 text-xs">
    {p.display_name}{p.recording_approved?' · Recording approved':' · Recording not approved'}</span>)}</div>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={myConsent} onChange={e=>void updateConsent(e.target.checked)} disabled={busy}/>
    I agree to this meeting being recorded and transcribed. I can withdraw permission at any time.
   </label>
   <p className="text-xs text-[var(--cc-text-secondary)]">{ready?'All listed meeting participants have approved recording.':'Recording will require approval from every current participant.'} Collaboration meetings additionally require the collaboration-specific recording consent.</p>
  </div>
  <LiveMeeting key={scope+scopeId} scope={scope} scopeId={scopeId} userId={userId} onNewRecordings={()=>void reloadRecordings()}/>
  <section className="ccx-surface space-y-3 rounded-xl p-4" aria-label="Shared meeting notes">
   <h3 className="flex items-center gap-2 font-semibold"><FileText size={18}/>Shared meeting notes</h3>
   <p className="text-xs text-[var(--cc-text-secondary)]">All approved participants can write notes. Saves are versioned and conflicting changes must be reviewed, rather than overwriting another person's work.</p>
   <textarea className={input} maxLength={20000} rows={7} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Record meeting decisions, roles, dates, deliverables and any unresolved questions…"/>
   <div className="flex flex-wrap items-center gap-3"><button type="button" className={btn} disabled={busy} onClick={()=>void save()}>Save notes</button><span className="text-xs text-[var(--cc-text-secondary)]">Version {version}</span></div>
  </section>
  <section className="ccx-surface space-y-3 rounded-xl p-4" aria-label="Meeting clips and transcripts">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold"><FileAudio size={18} className="mr-2 inline"/>Recordings and transcripts</h3><button type="button" className={btn} onClick={()=>void reloadRecordings()}>Refresh</button></div>
   {!recordings.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No meeting recordings yet.</p>}
   <div className="max-h-96 space-y-2 overflow-y-auto">{recordings.map(r=><article key={r.id} className="rounded-xl border border-[var(--cc-border)] p-3">
    <div className="flex flex-wrap items-center gap-3 text-sm"><span>{r.content_type} · {new Date(r.created_at).toLocaleString()}</span>{r.url&&<a href={r.url} target="_blank" rel="noreferrer" className="underline">Open private recording</a>}
     {r.content_type.startsWith('audio/')&&!r.transcript&&<button className={btn} type="button" disabled={busy} onClick={()=>void transcribe(r)}>Transcribe</button>}</div>
    {r.transcript&&<details className="mt-2"><summary className="cursor-pointer text-sm font-semibold">Text transcript</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.transcript}</p></details>}
   </article>)}</div>
  </section>
 </section>;
}
