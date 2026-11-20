/** A single authenticated view for the whole professional collaboration lifecycle.
 * Contracts, consent and historical plan revisions are server-owned records.
 * "Delete" hides an item for this member; it never erases signed evidence.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {CalendarDays,FileText,MapPin,Plus,RefreshCw,ShieldCheck,Users,Archive,RotateCcw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import MemberPicker from './MemberPicker';
import CollaborationCreationWizard from './CollaborationCreationWizard';
import CollaborationSafetyCheckin from './CollaborationSafetyCheckin';
import CollaborationNotesAndTesting from './CollaborationNotesAndTesting';
import CollaborationActualStatements from './CollaborationActualStatements';
import ProductionReadinessChecklist from './ProductionReadinessChecklist';
import {localDateTimeToUtc} from './productionWizardPolicy.mjs';
const panel='ccx-surface min-w-0 rounded-2xl p-5';
const input='mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-[var(--cc-text-primary)]';
const primary='ccx-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60';
const secondary='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm';
const roles=[['creator','Creator / performer'],['videographer','Videographer'],['photographer','Photographer'],['video_editor','Video editor'],['studio','Studio'],['agent','Agent']];
const date=value=>value?new Date(value).toLocaleString():'Not scheduled';
const detailsText=object=>Array.isArray(object)?object.join(', '):String(object||'Not yet specified');
async function call(fn,action,extra={}){
 const {data,error}=await supabase.functions.invoke(fn,{body:{action,...extra}});
 if(error||data?.error){
  let message=data?.error||error?.message||'Request could not be completed.';
  try{message=(await error?.context?.json())?.error||message;}catch{}
  throw Error(message);
 }
 return data;
}
export default function CollaborationHub({user,onNavigate=(destination,context)=>{void destination;void context;},initialTargetId=''}) {
 const [items,setItems]=useState([]),[hidden,setHidden]=useState([]),[invitations,setInvitations]=useState([]);
 const [filter,setFilter]=useState('current'),[editing,setEditing]=useState(false),[selected,setSelected]=useState(''),[detail,setDetail]=useState(null);
 const [properties,setProperties]=useState([]),[target,setTarget]=useState(initialTargetId),[role,setRole]=useState('creator');
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[requiresClearance,setRequiresClearance]=useState(false);
 const [plan,setPlan]=useState({starts_at:'',ends_at:'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',city:'',venue_label:'',property_id:'',scope_of_work:'',activities:'',deliverables:'',usage_rights:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [inviteRole,setInviteRole]=useState('creator'),[inviteTarget,setInviteTarget]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const [response,incoming,available]=await Promise.all([
    call('collaboration-workspace','list'),
    call('member-workflows','list_invitations'),
    call('collaboration-workspace','properties').catch(()=>({items:[]}))
   ]);
   setItems(response.items||[]);setHidden(response.hidden||[]);setInvitations(incoming.items||[]);setProperties(available.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const run=async fn=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const open=async id=>run(async()=>{
  const response=await call('collaboration-workspace','detail',{collaboration_id:id});
  setSelected(id);setDetail(response);setInviteTarget('');
 });
 const create=async event=>{event.preventDefault();await run(async()=>{
  const startUtc=localDateTimeToUtc(plan.starts_at,plan.timezone),endUtc=localDateTimeToUtc(plan.ends_at,plan.timezone);
  if(Boolean(startUtc)!==Boolean(endUtc)||startUtc&&endUtc&&endUtc<=startUtc)throw Error('Both times are required and the end must be after the start.');
  if(target){
   const check=await call('collaboration-workspace','eligibility',{target_user_id:target});
   if(!check.eligible)throw Error(check.reason||'An accepted friendship or a two-way conversation is required.');
  }
  // The draft is always persisted first. Each later stage is independently saved.
  const created=await call('member-workflows','create_collaboration',{title,description,requires_work_clearance:requiresClearance});
  const id=created.item?.id;if(!id)throw Error('The collaboration was not created.');
  setEditing(false);
  await load();
  try{
   await call('collaboration-workspace','save_plan',{collaboration_id:id,...plan,
    starts_at:startUtc,
    ends_at:endUtc,
    activities:plan.activities.split(',').map(x=>x.trim()).filter(Boolean)});
   if(target)await call('member-workflows','invite_collaborator',{collaboration_id:id,invitee_id:target,proposed_role:role});
   setNotice(target?'Collaboration saved and invitation sent. Acceptance and consent are still required.':'Collaboration saved. Add collaborators and send invitations when ready.');
   setTitle('');setDescription('');setTarget('');await load();
   const result=await call('collaboration-workspace','detail',{collaboration_id:id});setSelected(id);setDetail(result);
  }catch(e){setError('Your collaboration draft was saved, but its setup needs attention: '+e.message);}
 });};
 const invite=async()=>run(async()=>{
  const check=await call('collaboration-workspace','eligibility',{target_user_id:inviteTarget});
  if(!check.eligible)throw Error(check.reason||'Cannot invite this member.');
  await call('member-workflows','invite_collaborator',{collaboration_id:selected,invitee_id:inviteTarget,proposed_role:inviteRole});
  setNotice('Invitation sent. The recipient can accept or decline.');setInviteTarget('');await load();await openDetails(selected);
 });
 const openDetails=async id=>{const data=await call('collaboration-workspace','detail',{collaboration_id:id});setDetail(data);};
 const respond=async(id,status)=>run(async()=>{
  await call('member-workflows','respond_invitation',{invitation_id:id,status});
  setNotice(status==='accepted'?'Collaboration invitation accepted. You can now review its complete plan.':'Invitation declined.');
  await load();
 });
 const toggleArchive=async(id,isHidden)=>run(async()=>{
  if(!window.confirm(isHidden?'Restore this collaboration to your dashboard?':'Remove this collaboration from your dashboard? Signed contracts, consents and audit history will remain accessible in Archived.'))return;
  await call('collaboration-workspace',isHidden?'unhide':'hide',{collaboration_id:id});
  setNotice(isHidden?'Collaboration restored.':'Collaboration moved to your private archive.');if(selected===id){setDetail(null);setSelected('');}
  await load();
 });
 const draftAgreement=async()=>run(async()=>{
  if(!detail?.plan)throw Error('Save a production plan first.');
  const p=detail.plan;
  const contract={scope:p.scope_of_work,activities:p.agreed_activities,starts_at:p.starts_at,ends_at:p.ends_at,timezone:p.timezone,city:p.city,venue_label:p.venue_label,property_id:p.property_id,deliverables:p.deliverables,usage_rights:p.usage_rights,plan_version:p.version,
    consent_note:'Each participant must separately agree to activities, filming and distribution. This is only a draft, not a signature.'};
  await call('member-workflows','create_contract',{collaboration_id:selected,title:detail.collaboration.title+' — Production agreement',content:contract});
  setNotice('Agreement draft created. Formal signatures and individual consent are still required.');
  await openDetails(selected);
 });
 const visible=items.filter(item=>filter==='archived'?hidden.includes(item.id):!hidden.includes(item.id)&&(filter==='completed'?item.status==='completed':filter==='current'?item.status!=='completed':true));
 const planFields=[['scope_of_work','Production scope','textarea'],['activities','Proposed activities (comma separated)','textarea'],['deliverables','Deliverables and deadlines','textarea'],['usage_rights','Usage / publishing rights','textarea']];
 return <div className="space-y-5" data-collaboration-hub="true">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Collaborations</h1><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Plan, invite, agree, film and revisit your complete production history.</p></div>
   <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>void load()} aria-label="Refresh collaborations" className={secondary} disabled={busy}><RefreshCw size={16}/></button><button type="button" className={primary} onClick={()=>{setEditing(v=>!v);setDetail(null);setSelected('');}}><Plus size={18}/>Create collaboration</button></div>
  </header>
  {error&&<div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div>}{notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {invitations.filter(x=>x.status==='pending').length>0&&<section className={panel+' space-y-3'}><h2 className="font-semibold">Invitations awaiting your response</h2>{invitations.filter(x=>x.status==='pending').map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cc-border)] p-3"><div><p className="font-medium">{item.title||'New collaboration invitation'}</p><p className="text-xs text-[var(--cc-text-secondary)]">Proposed role: {item.proposed_role||'Collaborator'} · {date(item.starts_at||item.created_at)}</p><p className="text-xs text-[var(--cc-text-secondary)]">{item.city||''} {item.scope_of_work||''}</p></div><div className="flex gap-2"><button type="button" className={primary} disabled={busy} onClick={()=>void respond(item.id,'accepted')}>Accept</button><button type="button" className={secondary} disabled={busy} onClick={()=>void respond(item.id,'declined')}>Decline</button></div></div>)}</section>}
  {editing&&<CollaborationCreationWizard user={user} title={title} setTitle={setTitle} description={description} setDescription={setDescription}
      plan={plan} setPlan={setPlan} target={target} setTarget={setTarget} role={role} setRole={setRole} properties={properties}
      requiresClearance={requiresClearance} setRequiresClearance={setRequiresClearance} onCreate={create} onCancel={()=>setEditing(false)} busy={busy}/>}
  <div className="flex flex-wrap gap-2" role="group" aria-label="Collaboration history filters">{[['current','Current'],['completed','Completed'],['all','All'],['archived','Archived']].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} className={filter===id?primary:secondary} onClick={()=>{setFilter(id);setSelected('');setDetail(null);}}>{label}</button>)}</div>
  {!busy&&!visible.length&&<p className={panel+' text-sm text-[var(--cc-text-secondary)]'}>{filter==='archived'?'No archived collaborations.':'No collaborations here yet. Select Create collaboration to organize your next production.'}</p>}
  <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item=><article key={item.id} className={panel+' flex min-w-0 flex-col justify-between gap-4'}><div className="space-y-2"><span className="inline-block rounded-full bg-[var(--cc-surface-hover)] px-3 py-1 text-xs font-semibold capitalize">{item.status||'Draft'}</span><h2 className="break-words text-lg font-semibold">{item.title}</h2><p className="line-clamp-3 text-sm text-[var(--cc-text-secondary)]">{item.description||'Private production plan'}</p><p className="flex items-center gap-2 text-xs"><CalendarDays size={15}/>{date(item.plan?.starts_at||item.created_at)}</p>{item.plan?.city&&<p className="flex items-center gap-2 text-xs"><MapPin size={15}/>{item.plan.city}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={busy} onClick={()=>void open(item.id)}><FileText size={16}/>View complete record</button><button type="button" className={secondary} disabled={busy} onClick={()=>void toggleArchive(item.id,hidden.includes(item.id))}>{hidden.includes(item.id)?<RotateCcw size={16}/>:<Archive size={16}/>} {hidden.includes(item.id)?'Restore':'Delete / archive'}</button></div></article>)}</div>
  {detail&&selected&&<section className={panel+' space-y-5'} aria-label="Complete collaboration record"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{detail.collaboration.title}</h2><p className="text-xs text-[var(--cc-text-secondary)]">Private record · {detail.collaboration.status} · created {date(detail.collaboration.created_at)}</p></div><button type="button" onClick={()=>{setSelected('');setDetail(null);}} className={secondary}>Close</button></div>
   <ProductionReadinessChecklist detail={detail}/>
   <CollaborationSafetyCheckin key={selected} collaborationId={selected} onNavigate={onNavigate}/>
   <CollaborationNotesAndTesting collaborationId={selected} organizerId={detail.collaboration.creator_id} userId={user.id}/>
   <CollaborationActualStatements key={'actuals-'+selected} collaborationId={selected} detail={detail} userId={user.id}/>
   <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-[var(--cc-surface-subtle)] p-4"><h3 className="mb-2 font-semibold"><CalendarDays size={17} className="mr-2 inline"/>Production details</h3><dl className="space-y-2 text-sm">{[['Start',date(detail.plan?.starts_at)],['End',date(detail.plan?.ends_at)],['Time zone',detail.plan?.timezone],['City',detail.plan?.city],['Venue',detail.plan?.venue_label],['Property reference',detail.plan?.property_id?'Selected; confirm separate booking':'None'],['Scope',detail.plan?.scope_of_work],['Activities',detailsText(detail.plan?.agreed_activities)],['Deliverables',detail.plan?.deliverables],['Usage and publication',detail.plan?.usage_rights]].map(([label,value])=><div key={label}><dt className="text-xs text-[var(--cc-text-secondary)]">{label}</dt><dd className="break-words whitespace-pre-wrap">{value||'Not specified'}</dd></div>)}</dl></div>
   <div className="rounded-xl bg-[var(--cc-surface-subtle)] p-4"><h3 className="mb-2 font-semibold"><Users size={17} className="mr-2 inline"/>Participants and consent</h3><div className="space-y-3">{detail.members.map(m=>{const consent=detail.consents.find(c=>c.user_id===m.user_id);return <div key={m.user_id} className="rounded-xl border border-[var(--cc-border)] p-3"><p className="font-semibold">{m.profile?.display_name||'Member'} <span className="text-xs font-normal capitalize">({m.membership_role})</span></p><p className="text-xs text-[var(--cc-text-secondary)]">{consent?(consent.revoked_at?'Consent withdrawn':'Participation: '+(consent.participation_consent?'Agreed':'Not agreed')+', recording: '+(consent.recording_consent?'Agreed':'Not agreed')+', publishing: '+(consent.distribution_consent?'Agreed':'Not agreed')):'No consent recorded'}</p></div>})}</div></div></div>
   <div className="rounded-xl border border-[var(--cc-border)] p-4"><h3 className="mb-3 font-semibold"><FileText size={17} className="mr-2 inline"/>Agreements and signatures</h3>{detail.contracts.length?detail.contracts.map(c=><div className="mb-3 space-y-2 border-b border-[var(--cc-border)] pb-3" key={c.id}><p className="font-semibold">{c.title} <span className="text-xs font-normal capitalize">· {c.status}</span></p><p className="text-xs">Signed at: {date(c.locked_at)} · Recorded signatures: {c.signatures.length}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-xs">{JSON.stringify(c.content,null,2)}</pre></div>):<p className="text-sm text-[var(--cc-text-secondary)]">No agreement drafts or signatures yet.</p>}
    {detail.collaboration.creator_id===user.id&&!['completed','cancelled','archived'].includes(detail.collaboration.status)&&<button type="button" className={secondary} disabled={busy} onClick={()=>void draftAgreement()}>Draft agreement from plan</button>}
    <p className="mt-2 text-xs text-[var(--cc-text-secondary)]">A saved draft is not a signed contract. Individual informed consent remains separate and may be withdrawn.</p></div>
   <div className="rounded-xl border border-[var(--cc-border)] p-4"><h3 className="font-semibold">Version history</h3>{detail.history.length?detail.history.map(h=><details key={h.version} className="mt-2 rounded-xl border border-[var(--cc-border)] p-3 text-sm"><summary className="cursor-pointer font-medium">Plan version {h.version} · {date(h.recorded_at)}</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-xs">{JSON.stringify(h.snapshot,null,2)}</pre></details>):<p className="mt-2 text-sm">No plan versions yet.</p>}</div>
   {detail.collaboration.creator_id===user.id&&!['completed','cancelled','archived'].includes(detail.collaboration.status)&&<div className="rounded-xl border border-[var(--cc-border)] p-4"><h3 className="font-semibold">Invite a collaborator</h3><p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Invitations require an accepted friendship or two-way messages. Five declines in seven days pause invitations for 30 days.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><MemberPicker label="Find verified professional" excludeIds={[user.id,...detail.members.map(m=>m.user_id)]} value={inviteTarget} onChange={(id,person)=>{setInviteTarget(id);if(person?.role_type)setInviteRole(person.role_type);}}/><label className="block text-sm">Professional role<select className={input} value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>{roles.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div><button type="button" className={primary+' mt-3'} disabled={busy||!inviteTarget} onClick={()=>void invite()}>Send collaboration invitation</button></div>}
   <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={()=>onNavigate('contracts',{collaborationId:selected})}>Open agreement workspace</button><button type="button" className={secondary} onClick={()=>onNavigate('consent',{collaborationId:selected})}><ShieldCheck size={16}/>Review / withdraw consent</button></div>
  </section>}
 </div>;
}
