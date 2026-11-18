/**
 * Unified production workspace. React UI talks only to production-manager
 * Edge Functions, which authorize every resource and action independently.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { UsersRound, CalendarDays, ShieldAlert, Settings2, RefreshCw, MessageSquare } from 'lucide-react';
import { productionAction } from './productionApi';

const panel='ccx-surface p-5';
const control='w-full rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2 text-sm text-white';
const button='rounded-lg ccx-action-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const secondary='rounded-lg bg-[#273449] px-3 py-2 text-sm text-white disabled:opacity-50';
/** @type {Array<[string, string, import('react').ElementType]>} */
const tabs=[['teams','Production Teams',UsersRound],['events','Shoot Events',CalendarDays],['cases','Disputes & Safety',ShieldAlert],['preferences','Notifications',Settings2]];

export default function ProductionManager({user,paid=false,isAdmin=false}){
  const [tab,setTab]=useState(paid?'teams':'cases');
  const [items,setItems]=useState([]);
  const [teamMembers,setTeamMembers]=useState([]);
  const [availableTeams,setAvailableTeams]=useState([]);
  const [team,setTeam]=useState('');
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [city,setCity]=useState('');
  const [capacity,setCapacity]=useState(10);
  const [target,setTarget]=useState('');
  const [eventTarget,setEventTarget]=useState('');
  const [eventVisibility,setEventVisibility]=useState('invite');
  const [category,setCategory]=useState('consent');
  const [caseId,setCaseId]=useState('');
  const [caseNote,setCaseNote]=useState('');
  const [caseHistory,setCaseHistory]=useState([]);
  const [prefs,setPrefs]=useState({email_digest:false,booking_reminders:true,message_alerts:true});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=useCallback(async(section=tab)=>{
    setBusy(true);setError('');
    try {
      const action={teams:'teams_list',events:'events_list',cases:'my_cases',preferences:'notification_preferences'}[section];
      const result=await productionAction(action);
      if(section==='preferences')setPrefs(result.item||{email_digest:false,booking_reminders:true,message_alerts:true});
      else setItems(result.items||[]);
      if(section==='events'){
        const teams=await productionAction('teams_list');
        setAvailableTeams((teams.items||[]).filter(x=>x.my_membership?.status==='active'&&['owner','manager'].includes(x.my_membership?.role)));
      }
    } catch(e){setError(e.message);}
    finally{setBusy(false);}
  },[tab]);

  useEffect(()=>{refresh(tab);},[tab,refresh]);

  const mutate=async(action,args={},message='Saved')=>{
    setBusy(true);setError('');setNotice('');
    try{
      const result=await productionAction(action,args);
      setNotice(message);await refresh(tab);
      return result;
    }catch(e){setError(e.message);return null;}
    finally{setBusy(false);}
  };
  const chooseTeam=async(id)=>{
    setTeam(id);setError('');
    try{const result=await productionAction('team_members',{team_id:id});setTeamMembers(result.items||[]);}
    catch(e){setError(e.message);}
  };
  const createTeam=async(e)=>{
    e.preventDefault();
    const result=await mutate('teams_create',{name,description},'Private team created.');
    if(result){setName('');setDescription('');setTeam(result.item.id);}
  };
  const createEvent=async(e)=>{
    e.preventDefault();
    const result=await mutate('events_create',{
      title:name,description,city,capacity,team_id:team||null,
      starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),
      visibility:eventVisibility,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'
    },'Shoot event created.');
    if(result){setName('');setDescription('');setStart('');setEnd('');}
  };
  const openCase=async(e)=>{
    e.preventDefault();
    const result=await mutate('create_case',{category,description},'Your case was recorded privately for review.');
    if(result){setDescription('');setCaseId(result.item.id);}
  };
  const openHistory=async(id)=>{
    setCaseId(id);setError('');
    try{const r=await productionAction('case_history',{case_id:id});setCaseHistory(r.items||[]);}
    catch(e){setError(e.message);}
  };
  const noteCase=async(e)=>{
    e.preventDefault();
    const result=await mutate('case_add_note',{case_id:caseId,note:caseNote},'Case note saved.');
    if(result){setCaseNote('');await openHistory(caseId);}
  };
  const updateStatus=async(id,status)=>{
    const resolution=status==='resolved'?'Resolved after moderator review':'Case moved to '+status;
    const result=await mutate('case_resolve',{case_id:id,status,resolution},'Case status updated.');
    if(result&&caseId===id)await openHistory(id);
  };
  const savePreferences=async(e)=>{
    e.preventDefault();await mutate('set_notification_preferences',prefs,'Notification preferences saved.');
  };

  const visibleTabs=paid?tabs:tabs.filter(x=>x[0]==='cases'||x[0]==='preferences');
  return <section className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div><h2 className="text-2xl font-semibold">Production Manager</h2><p className="text-sm text-[#9AA6BC] mt-1">Organize teams, schedule shoots, coordinate participants and manage concerns privately.</p></div>
      <button className={button} onClick={()=>refresh()} disabled={busy}><RefreshCw size={16} className="inline mr-1"/>Refresh</button>
    </div>
    <div className="flex flex-wrap gap-2">{visibleTabs.map(([id,label,Icon])=><button key={id} className={(tab===id?button:secondary)+' flex items-center gap-2'} onClick={()=>{setTab(id);setError('');}}><Icon size={16}/>{label}</button>)}</div>
    {error&&<p role="alert" className="bg-red-950 text-red-200 rounded-lg p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="bg-emerald-950 text-emerald-200 rounded-lg p-3 text-sm">{notice}</p>}

    {tab==='teams'&&paid&&<div className="grid md:grid-cols-2 gap-4">
      <form className={panel+' space-y-3'} onSubmit={createTeam}><h3 className="font-semibold">Create a production team</h3>
        <label className="block text-sm">Team name<input className={control+' mt-1'} required minLength={3} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="block text-sm">Description<textarea className={control+' mt-1'} rows={3} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <p className="text-xs text-[#9AA6BC]">New teams are private. Members must accept an invitation.</p>
        <button className={button} disabled={busy}>Create team</button>
      </form>
      <div className={panel+' space-y-3'}><h3 className="font-semibold">Your production teams</h3>
        {!items.length&&<p className="text-sm text-[#9AA6BC]">No production teams yet.</p>}
        {items.map(entry=><div className="border-b border-[#34445D] pb-3" key={entry.id}>
          <p className="font-semibold">{entry.name}</p><p className="text-xs text-[#9AA6BC]">{entry.my_membership?.status} · {entry.my_membership?.role}</p>
          {entry.my_membership?.status==='invited'&&<div className="ccx-action-row flex gap-2 mt-2"><button className={button} disabled={busy} onClick={()=>mutate('teams_respond',{team_id:entry.id,status:'active'},'Invitation accepted.')}>Accept</button><button className={secondary} disabled={busy} onClick={()=>mutate('teams_respond',{team_id:entry.id,status:'declined'},'Invitation declined.')}>Decline</button></div>}
          {entry.my_membership?.status==='active'&&<button className="text-blue-300 text-sm mt-2" onClick={()=>chooseTeam(entry.id)}>Show members and invitations</button>}
          {team===entry.id&&<div className="space-y-2 mt-3 bg-[#0F1520] p-3 rounded-lg">
            {teamMembers.map(x=><p key={x.member_id} className="text-xs break-all">{x.member_id} · {x.role} · {x.status}</p>)}
            {['owner','manager'].includes(entry.my_membership?.role)&&<div className="ccx-action-row flex gap-2"><input className={control} placeholder="Verified creator UUID" value={target} onChange={e=>setTarget(e.target.value)}/><button className={button} disabled={busy||!target} onClick={()=>mutate('teams_invite',{team_id:team,member_id:target},'Team invitation sent.')}>Invite</button></div>}
          </div>}
        </div>)}
      </div>
    </div>}

    {tab==='events'&&paid&&<div className="grid md:grid-cols-2 gap-4">
      <form className={panel+' space-y-3'} onSubmit={createEvent}><h3 className="font-semibold">Schedule a shoot or meeting</h3>
        <label className="block text-sm">Event name<input className={control+' mt-1'} required minLength={3} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="block text-sm">Details<textarea className={control+' mt-1'} value={description} onChange={e=>setDescription(e.target.value)} rows={2}/></label>
        <label className="block text-sm">City only (not private address)<input className={control+' mt-1'} value={city} onChange={e=>setCity(e.target.value)}/></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Starts<input required type="datetime-local" className={control+' mt-1'} value={start} onChange={e=>setStart(e.target.value)}/></label>
          <label className="text-sm">Ends<input required type="datetime-local" className={control+' mt-1'} value={end} onChange={e=>setEnd(e.target.value)}/></label>
          <label className="text-sm">Capacity<input type="number" min={1} max={250} className={control+' mt-1'} value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/></label>
          <label className="text-sm">Visibility<select className={control+' mt-1'} value={eventVisibility} onChange={e=>setEventVisibility(e.target.value)}><option value="invite">Invited only</option><option value="verified">Verified professionals</option></select></label>
        </div>
        <p className="text-xs text-[#9AA6BC]">You can optionally associate this shoot with a private production team.</p>
        <label className="text-sm block">Team<select className={control+' mt-1'} value={team} onChange={e=>setTeam(e.target.value)}><option value="">No team</option>{/* Available teams are loaded on the Teams tab */}{availableTeams.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <button className={button} disabled={busy}>Create event</button>
      </form>
      <div className={panel+' space-y-3'}><h3 className="font-semibold">Upcoming production events</h3>
        {!items.length&&<p className="text-sm text-[#9AA6BC]">No upcoming events are visible.</p>}
        {items.map(event=><div key={event.id} className="border-b border-[#34445D] pb-3 space-y-2">
          <p className="font-semibold">{event.title}</p><p className="text-sm text-[#9AA6BC]">{event.city||'Location to be confirmed'} · {new Date(event.starts_at).toLocaleString()} — {new Date(event.ends_at).toLocaleString()}</p>
          <p className="text-xs">Capacity {event.capacity} · RSVP {event.my_rsvp||'Not answered'} · {event.status}</p>
          {event.status==='scheduled'&&<div className="flex flex-wrap gap-2">{['going','maybe','declined'].map(status=><button className={secondary} key={status} disabled={busy} onClick={()=>mutate('events_rsvp',{event_id:event.id,status},'RSVP updated.')}>{status}</button>)}</div>}
          {event.organizer_id===user.id&&<div className="ccx-action-row flex gap-2"><input className={control} placeholder="Member UUID" value={eventTarget} onChange={e=>setEventTarget(e.target.value)}/><button className={button} disabled={busy||!eventTarget} onClick={()=>mutate('events_invite',{event_id:event.id,member_id:eventTarget},'Invitation sent.')}>Invite</button></div>}
        </div>)}
      </div>
    </div>}

    {tab==='cases'&&<div className="grid md:grid-cols-2 gap-4">
      <form className={panel+' space-y-3'} onSubmit={openCase}>
        <h3 className="font-semibold">Submit a private dispute or safety concern</h3>
        <p className="text-sm text-[#9AA6BC]">This safety workflow remains available even without a paid subscription. For immediate danger, contact emergency services.</p>
        <label className="text-sm block">Category<select className={control+' mt-1'} value={category} onChange={e=>setCategory(e.target.value)}>{['consent','safety','contract','payment','booking','harassment','other'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="block text-sm">What happened?<textarea required minLength={10} maxLength={5000} className={control+' mt-1'} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the issue without uploading private ID or health records."/></label>
        <button className={button} disabled={busy}>Submit confidential case</button>
      </form>
      <div className={panel+' space-y-3'}><h3 className="font-semibold">{isAdmin?'Moderation caseload':'Your cases'}</h3>
        {items.map(entry=><div key={entry.id} className="border-b border-[#34445D] pb-3 space-y-2">
          <p className="text-sm font-semibold capitalize">{entry.category} · {entry.status}</p>
          <p className="text-xs text-[#9AA6BC]">{new Date(entry.created_at).toLocaleString()}</p>
          <p className="text-sm whitespace-pre-wrap">{entry.description}</p>
          <button className="text-blue-300 text-sm" onClick={()=>openHistory(entry.id)}>Open case timeline</button>
          {isAdmin&&<div className="flex gap-2 flex-wrap">{['reviewing','mediation','resolved','dismissed'].map(status=><button key={status} className={secondary} disabled={busy} onClick={()=>updateStatus(entry.id,status)}>{status}</button>)}</div>}
        </div>)}
        {!items.length&&<p className="text-sm text-[#9AA6BC]">No cases recorded.</p>}
        {caseId&&<div className="bg-[#0F1520] rounded-lg p-3 space-y-3">
          <p className="font-semibold text-sm">Case timeline</p>
          {caseHistory.map(entry=><div key={entry.id} className="text-xs border-b border-[#273449] pb-2"><strong>{entry.kind}</strong> · {new Date(entry.created_at).toLocaleString()}<p className="text-[#9AA6BC] whitespace-pre-wrap">{entry.note}</p></div>)}
          <form onSubmit={noteCase} className="space-y-2"><textarea className={control} value={caseNote} onChange={e=>setCaseNote(e.target.value)} required placeholder="Add a private case note" rows={3}/><button className={button} disabled={busy}><MessageSquare size={15} className="inline mr-1"/>Add note</button></form>
        </div>}
      </div>
    </div>}

    {tab==='preferences'&&<form className={panel+' space-y-4 max-w-2xl'} onSubmit={savePreferences}>
      <h3 className="font-semibold">Notification preferences</h3>
      {[
        ['email_digest','Optional email digest'],
        ['booking_reminders','Shoot and booking reminders'],
        ['message_alerts','Direct message alerts']
      ].map(([key,label])=><label className="flex gap-3 items-center text-sm" key={key}><input type="checkbox" checked={Boolean(prefs[key])} onChange={e=>setPrefs(p=>({...p,[key]:e.target.checked}))}/>{label}</label>)}
      <p className="text-xs text-[#9AA6BC]">Preferences are stored now; external email and push delivery require a configured provider.</p>
      <button className={button} disabled={busy}>Save preferences</button>
    </form>}
  </section>;
}
