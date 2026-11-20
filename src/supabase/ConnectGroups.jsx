/** Community Groups. Membership is private; public search shows only site-reviewed
 * groups, while invite-only groups are discoverable only to their invitees.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {Plus,RefreshCw,Search,ShieldCheck,Lock,Globe,ArrowLeft} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import MemberPicker from './MemberPicker';
import ConnectFeed from './ConnectFeed';
const surface='ccx-surface min-w-0 rounded-xl p-4 sm:p-5';
const primary='ccx-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const secondary='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm text-[var(--cc-text-primary)]';
async function request(action,extra={}){
 const {data,error}=await supabase.functions.invoke('connect-groups',{body:{action,...extra}});
 if(error||data?.error){
  let message=data?.error||'Group request could not be completed.';
  if(error?.context?.json)try{message=(await error.context.json())?.error||message;}catch{}
  throw Error(message);
 }
 return data;
}
const statuses={
 active:'Member',requested:'Application pending',invited:'Invitation awaiting your response',
 pending_platform:'Awaiting platform review',rejected:'Not approved for public discovery',
 removed:'Membership removed',left:'Left group'
};
export default function ConnectGroups({userId,paid=false,isAdmin=false,onNavigate}){
 const [discover,setDiscover]=useState([]),[mine,setMine]=useState([]),[query,setQuery]=useState('');
 const [selectedId,setSelectedId]=useState(null),[detail,setDetail]=useState(null),[requests,setRequests]=useState([]),[members,setMembers]=useState([]);
 const [moderation,setModeration]=useState([]),[form,setForm]=useState(false),[name,setName]=useState(''),[description,setDescription]=useState(''),[rules,setRules]=useState(''),[visibility,setVisibility]=useState('public'),[agree,setAgree]=useState(false);
 const [target,setTarget]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const update=useCallback(async(search='')=>{
  setLoading(true);setError('');
  try{
   const [d,m]=await Promise.all([request('discover',{query:search}),request('mine')]);
   setDiscover(d.items||[]);setMine(m.items||[]);
  }catch(e){setError(e.message);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void update();},[update,userId]);
 const open=async(id)=>{
  setBusy(true);setError('');setNotice('');
  try{
   const response=await request('detail',{group_id:id});
   setSelectedId(id);setDetail(response.group);setTarget('');
   await loadAdmin(id,response.group);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const loadAdmin=async(id,g)=>{
  if(!['owner','admin'].includes(g?.member_role)||g?.member_status!=='active'){setRequests([]);setMembers([]);return;}
  const [pending,people]=await Promise.all([request('requests',{group_id:id}),request('members',{group_id:id})]);
  setRequests(pending.items||[]);setMembers(people.items||[]);
 };
 const run=async(action,extra={},msg='Group updated.')=>{
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request(action,extra);
   setNotice(result.note||msg);
   if(action==='create'){
    setName('');setDescription('');setRules('');setAgree(false);setForm(false);
   }
   await update(query);
   if(selectedId){
    const response=await request('detail',{group_id:selectedId}).catch(()=>null);
    if(response?.group){setDetail(response.group);await loadAdmin(selectedId,response.group);}
    else {setSelectedId(null);setDetail(null);setRequests([]);setMembers([]);}
   }
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const moderate=async(id,decision)=>run('moderate',{group_id:id,decision},'Platform review recorded.');
 const adminQueue=async()=>{
  setBusy(true);setError('');
  try{const r=await request('admin_queue');setModeration(r.items||[]);}catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const selected=detail;
 return <section className="mx-auto max-w-7xl space-y-5" data-connect-groups="true">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><h1 className="text-2xl font-bold">Connect Groups</h1><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Professional and interest-based communities for verified adults. Group membership is private and is never used for advertising targeting.</p></div>
   <div className="flex flex-wrap gap-2">
    <button className={secondary} type="button" disabled={loading||busy} onClick={()=>void update(query)}><RefreshCw size={16}/>Refresh</button>
    {paid&&<button className={primary} type="button" onClick={()=>setForm(v=>!v)}><Plus size={17}/>Create group</button>}
   </div>
  </header>
  <div role="note" className={surface+' text-sm leading-6'}>
   Groups may discuss identities, consensual adult interests, fetish communities and professional topics. Titles, previews and uploaded material must follow platform rules. Public groups need site approval; private groups are invitation-only. Posts and comments are moderated before publication.
  </div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm">{notice}</p>}
  {form&&paid&&<form className={surface+' space-y-3'} onSubmit={e=>{e.preventDefault();if(agree)void run('create',{name,description,rules,visibility},'Group submitted.');}}>
   <h2 className="font-semibold">Create a community group</h2>
   <label className="block text-sm">Name<input className={input+' mt-1'} value={name} minLength={3} maxLength={100} required onChange={e=>setName(e.target.value)} placeholder="A clear non-explicit group title"/></label>
   <label className="block text-sm">Description<textarea className={input+' mt-1'} rows={3} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} required placeholder="Explain the community's purpose in professional, non-explicit language"/></label>
   <label className="block text-sm">Group rules<textarea className={input+' mt-1'} rows={3} maxLength={1500} value={rules} onChange={e=>setRules(e.target.value)} placeholder="Consent, privacy, respectful behavior, content and moderation rules"/></label>
   <label className="block text-sm">Privacy
    <select className={input+' mt-1'} value={visibility} onChange={e=>setVisibility(e.target.value)}>
     <option value="public">Public — searchable after platform approval; members apply</option>
     <option value="private">Private — hidden from search; invitation only</option>
    </select>
   </label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>I will uphold age verification, consent, content rights, privacy and group moderation requirements.</span></label>
   <button type="submit" className={primary} disabled={busy||!agree||name.trim().length<3}>Create group</button>
  </form>}
  {!paid&&<p className="text-xs text-[var(--cc-text-secondary)]">Verified Free members may discover public groups, apply, accept invitations, read group posts, react and comment. Premium is required to create groups and publish posts.</p>}
  {isAdmin&&<section className={surface+' space-y-3'} aria-label="Platform group moderation">
   <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Platform review — public groups</h2><button type="button" className={secondary} disabled={busy} onClick={()=>void adminQueue()}>Load pending groups (MFA required)</button></div>
   {moderation.map(g=><article key={g.id} className="rounded-xl border p-3 text-sm">
    <strong>{g.name}</strong><p className="mt-1 whitespace-pre-wrap">{g.description}</p><p className="mt-1 text-xs">Rules: {g.rules||'None provided'}</p>
    <div className="mt-3 flex gap-2"><button className={primary} disabled={busy} onClick={()=>void moderate(g.id,'approve')}>Approve public discovery</button><button className={secondary} disabled={busy} onClick={()=>void moderate(g.id,'reject')}>Reject</button></div>
   </article>)}
  </section>}
  {!selected&&<>
   <section className={surface+' space-y-3'}><h2 className="font-semibold">My groups and invitations</h2>
    {!mine.length&&!loading&&<p className="text-sm text-[var(--cc-text-secondary)]">You have not joined any groups or received invitations yet.</p>}
    <div className="grid gap-2 sm:grid-cols-2">{mine.map(g=><div key={g.id} className="rounded-xl border border-[var(--cc-border)] p-3 text-sm">
     <button className="block w-full text-left" onClick={()=>void open(g.id)} type="button"><strong>{g.name}</strong><span className="mt-1 block text-xs">{g.visibility==='private'?'Private · Invitation only':'Public'} · {statuses[g.membership_status]||statuses[g.state]||g.state}</span></button>
     {g.membership_status==='invited'&&<div className="mt-3 flex gap-2"><button className={primary} onClick={()=>void run('accept',{group_id:g.id},'Invitation accepted.')} disabled={busy}>Accept invite</button><button className={secondary} onClick={()=>void run('decline',{group_id:g.id},'Invitation declined.')} disabled={busy}>Decline</button></div>}
    </div>)}</div>
   </section>
   <section className={surface+' space-y-3'}>
    <h2 className="font-semibold">Discover public groups</h2>
    <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void update(query);}}>
     <label className="flex-1 text-sm">Search by group name or description<input className={input+' mt-1'} value={query} maxLength={60} onChange={e=>setQuery(e.target.value)} placeholder="Search public groups"/></label>
     <button type="submit" className={primary+' self-end'} disabled={loading}><Search size={17}/>Search</button>
    </form>
    <div className="grid gap-3 sm:grid-cols-2">{discover.map(g=><button key={g.id} type="button" onClick={()=>void open(g.id)} className="min-h-24 rounded-xl border border-[var(--cc-border)] p-4 text-left text-sm">
     <span className="flex items-center gap-2 font-semibold"><Globe size={16}/>{g.name}</span>
     <span className="mt-2 block line-clamp-3 break-words text-[var(--cc-text-secondary)]">{g.description||'No description provided.'}</span>
    </button>)}</div>
    {!discover.length&&!loading&&<p className="text-sm text-[var(--cc-text-secondary)]">No approved public groups match your search.</p>}
   </section>
  </>}
  {selected&&<section className="space-y-4" aria-label="Selected group">
   <button className={secondary} onClick={()=>{setSelectedId(null);setDetail(null);setRequests([]);setMembers([]);}}><ArrowLeft size={16}/>Back to groups</button>
   <div className={surface+' space-y-3'}>
    <div className="flex items-center gap-2"><span>{selected.visibility==='private'?<Lock size={18}/>:<Globe size={18}/>}</span><h2 className="text-xl font-bold">{selected.name}</h2></div>
    <p className="text-sm whitespace-pre-wrap break-words">{selected.description}</p>
    <p className="text-xs text-[var(--cc-text-secondary)]">Rules: {selected.rules||'Please follow the platform community policy.'}</p>
    <p className="text-xs text-[var(--cc-text-secondary)]">{selected.visibility==='private'?'Private — never publicly listed':'Public — platform-reviewed'} · {selected.members} approved members · {statuses[selected.member_status]||selected.state}</p>
    {selected.state==='pending_platform'&&<p className="text-xs">This public group awaits platform review. New members cannot apply or view posts until approval.</p>}
    {selected.visibility==='public'&&selected.state==='active'&&!['active','requested','invited'].includes(selected.member_status)&&<button className={primary} disabled={busy} onClick={()=>void run('apply',{group_id:selected.id},'Your application was sent to the group administrators.')}>Apply to join group</button>}
    {selected.member_status==='requested'&&<button className={secondary} disabled={busy} onClick={()=>void run('decline',{group_id:selected.id},'Application withdrawn.')}>Withdraw application</button>}
    {selected.member_status==='invited'&&<div className="flex gap-2"><button className={primary} disabled={busy} onClick={()=>void run('accept',{group_id:selected.id},'Invitation accepted.')}>Accept invitation</button><button className={secondary} disabled={busy} onClick={()=>void run('decline',{group_id:selected.id},'Invitation declined.')}>Decline</button></div>}
    {selected.member_status==='active'&&selected.member_role!=='owner'&&<button className={secondary} disabled={busy} onClick={()=>{if(window.confirm('Leave this group? Your previous posts may remain in its moderated history.'))void run('leave',{group_id:selected.id},'You left the group.');}}>Leave group</button>}
   </div>
   {selected.member_status==='active'&&<button type="button" className={primary} onClick={()=>onNavigate?.('meeting',{scope:'group',scopeId:selected.id})}>Start group video conference</button>}
   {selected.member_status==='active'&&['owner','admin'].includes(selected.member_role)&&<div className={surface+' space-y-4'} aria-label="Group administration">
    <header className="flex items-center gap-2"><ShieldCheck size={18}/><h3 className="font-semibold">Group administration</h3></header>
    <p className="text-xs">Invite a verified member; membership is voluntary. Group administrators cannot force someone into a group or access private identity details.</p>
    <div className="flex flex-wrap items-end gap-2"><div className="min-w-48 flex-1"><MemberPicker label="Invite verified member" value={target} excludeIds={[userId]} onChange={id=>setTarget(id)}/></div><button className={primary} disabled={!target||busy} onClick={()=>void run('invite',{group_id:selected.id,target_user_id:target},'Invitation sent.')}>Send invite</button></div>
    <div><h4 className="font-semibold text-sm">Membership applications ({requests.length})</h4>
     {requests.map(m=><div key={m.user_id} className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span>{m.display_name||'Verified member'}</span><div className="flex gap-2"><button className={primary} disabled={busy} onClick={()=>void run('approve',{group_id:selected.id,target_user_id:m.user_id},'Application approved.')}>Approve</button><button className={secondary} disabled={busy} onClick={()=>void run('deny',{group_id:selected.id,target_user_id:m.user_id},'Application denied.')}>Deny</button></div></div>)}
     {!requests.length&&<p className="mt-2 text-xs">No pending membership requests.</p>}
    </div>
    <div><h4 className="font-semibold text-sm">Active members and invitations</h4>
     {members.map(m=><div key={m.user_id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><span>{m.display_name||'Member'} · {m.role} · {m.status}</span>
      <div className="flex flex-wrap gap-2">
       {selected.member_role==='owner'&&m.status==='active'&&m.role==='member'&&<button className={secondary} disabled={busy} onClick={()=>void run('promote',{group_id:selected.id,target_user_id:m.user_id},'Administrator promoted.')}>Make admin</button>}
       {selected.member_role==='owner'&&m.status==='active'&&m.role==='admin'&&<button className={secondary} disabled={busy} onClick={()=>void run('demote',{group_id:selected.id,target_user_id:m.user_id},'Administrator removed.')}>Remove admin role</button>}
       {m.role!=='owner'&&(selected.member_role==='owner'||m.role!=='admin')&&<button className={secondary} disabled={busy} onClick={()=>{if(window.confirm('Remove this member from the group?'))void run('remove',{group_id:selected.id,target_user_id:m.user_id},'Member removed.');}}>Remove member</button>}
      </div>
     </div>)}
    </div>
   </div>}
   {selected.member_status==='active'&&selected.state==='active'&&<ConnectFeed key={selected.id} groupId={selected.id} userId={userId} paid={paid}/>}
   {selected.member_status!=='active'&&<p className={surface+' text-sm'}>Group posts are available only after your membership is approved or your invitation is accepted.</p>}
  </section>}
 </section>;
}