import MessengerLayout,{PersonAvatar} from './MessengerLayout';
import {uploadMessageAttachment} from './messageMediaApi';
/** Supabase member workflows. Selections survive refresh; stale requests cannot replace another chat. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Loader2,RefreshCw} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {isModuleEnabled} from './featureModules.mjs';
import MemberPicker from './MemberPicker';
import CollaborationHub from './CollaborationHub';
import ModuleAccessBoundary from './ModuleAccessBoundary';
import {IntroInbox,IntroThread} from './FriendMessaging';
import AdminTrustInbox from './AdminTrustInbox';
import {useRoleWorkspace} from './RoleWorkspaceContext';
const panel='ccx-surface p-4';
const input='w-full rounded-md border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-2 text-sm text-[var(--cc-text-primary)] placeholder-[var(--cc-text-muted)]';
const button='rounded-md ccx-action-primary px-3 py-2 text-sm font-semibold text-[var(--cc-text-primary)] disabled:opacity-50';
const muted='text-[var(--cc-text-secondary)]';
const listAction={collaborations:'list_collaborations',invitations:'list_invitations',connections:'list_connection_requests',messages:'list_conversations',contracts:'list_contracts',notifications:'list_notifications'};
export default function MemberWorkspace({user,flags={},paid=false,initialSection='collaborations',onNavigate}){
 const workspace=useRoleWorkspace();
 const [section,setSection]=useState(initialSection),[items,setItems]=useState([]),[projects,setProjects]=useState([]),[friends,setFriends]=useState([]),[people,setPeople]=useState({});
 const [selected,setSelected]=useState(''),[messages,setMessages]=useState([]),[contractProject,setContractProject]=useState('');
 const [working,setWorking]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [title,setTitle]=useState('');
 const [target,setTarget]=useState(''),[message,setMessage]=useState('');
 const [groupName,setGroupName]=useState(''),[groupPeople,setGroupPeople]=useState([]);
 const [newGroupMember,setNewGroupMember]=useState('');
 const [adminMessagesView,setAdminMessagesView]=useState('chats');
 const [peopleRecords,setPeopleRecords]=useState({}),[attachmentsEnabled,setAttachmentsEnabled]=useState(false);
 const [editId,setEditId]=useState(''),[editBody,setEditBody]=useState('');
 const [onlineMembers,setOnlineMembers]=useState([]),[typingMembers,setTypingMembers]=useState([]);
 const [terms,setTerms]=useState({scope:'',compensation:'',usage_rights:'',deliverables:''});
 const goTo=(next,context={})=>{if(onNavigate)onNavigate(next,context);else setSection(next);};
 useEffect(()=>{const context=window.history.state?.memberContext;
  if(context?.targetUserId)setTarget(context.targetUserId);
  if(context?.collaborationId)setContractProject(context.collaborationId);
 },[]);
 const currentSection=useRef(section),selectedRef=useRef(''),listVersion=useRef(0),messageVersion=useRef(0),mounted=useRef(true);
 const presenceRef=useRef(null),lastTypingRef=useRef(0),stopTypingRef=useRef(null);
 currentSection.current=section;
 const invoke=useCallback(async(action,payload={})=>{
  const {data,error:failure}=await supabase.functions.invoke('member-workflows',{body:{action,...payload}});
  if(failure||data?.error){let reason=data?.error||failure?.message||'Operation failed';if(failure?.context?.json){try{const body=await failure.context.json();if(typeof body?.error==='string')reason=body.error;}catch{/* retain original */}}throw Error(reason);}
  return data;
 },[]);
 const loadNames=useCallback(async(ids)=>{
  const unique=[...new Set(ids.filter(id=>id&&id!==user.id))].slice(0,100);if(!unique.length)return;
  const {data,error:failure}=await supabase.functions.invoke('directory',{body:{ids:unique}});
  if(!mounted.current||failure||data?.error)return;
  setPeople(old=>({...old,...Object.fromEntries((data?.results||[]).map(p=>[p.id,p.display_name]))}));
  setPeopleRecords(old=>({...old,...Object.fromEntries((data?.results||[]).map(p=>[p.id,p]))}));
 },[user.id]);
 const refresh=useCallback(async(wanted=currentSection.current)=>{
  const version=++listVersion.current;setWorking(true);setError('');
  try{
   const [result,related]=await Promise.all([invoke(listAction[wanted]),wanted==='contracts'?invoke('list_collaborations'):wanted==='messages'?invoke('list_connection_requests'):Promise.resolve({items:[]})]);
   if(!mounted.current||version!==listVersion.current||wanted!==currentSection.current)return;
   setItems(result.items||[]);
   if(wanted==='contracts')setProjects(related.items||[]);
   if(wanted==='messages'){setFriends(related.items||[]);setAttachmentsEnabled(result.capabilities?.attachments===true);void loadNames((result.items||[]).map(c=>c.peer_user_id));}
   const connections=wanted==='connections'?result.items:related.items;
   if(['connections','messages'].includes(wanted))void loadNames((connections||[]).flatMap(c=>[c.requester_id,c.recipient_id]));
  }catch(e){if(mounted.current&&version===listVersion.current)setError(e.message);}
  finally{if(mounted.current&&version===listVersion.current)setWorking(false);}
 },[invoke,loadNames]);
 const loadMessages=useCallback(async(id,showLoading=false)=>{
  if(!id)return;const version=++messageVersion.current;
  if(showLoading)setWorking(true);
  try{
   const result=await invoke('list_messages',{conversation_id:id});
   if(!mounted.current||selectedRef.current!==id||version!==messageVersion.current)return;
   setMessages(result.items||[]);
   if(document.visibilityState==='visible'){await invoke('mark_conversation_read',{conversation_id:id});if(mounted.current)setItems(old=>old.map(thread=>thread.id===id?{...thread,unread:0,unread_count:0}:thread));window.dispatchEvent(new Event('ccx-data-changed'));}
  }catch(e){if(mounted.current&&selectedRef.current===id&&version===messageVersion.current)setError(e.message);}
  finally{if(showLoading&&mounted.current&&selectedRef.current===id&&version===messageVersion.current)setWorking(false);}
 },[invoke]);
 const chooseConversation=useCallback(async id=>{
  selectedRef.current=id;setSelected(id);setMessages([]);setEditId('');setMessage('');setError('');
  await loadMessages(id,true);
 },[loadMessages]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;listVersion.current++;messageVersion.current++;if(stopTypingRef.current)clearTimeout(stopTypingRef.current);};},[]);
 useEffect(()=>{
  setItems([]);setError('');setNotice('');
  if(section!=='messages'){selectedRef.current='';setSelected('');setMessages([]);messageVersion.current++;}
  if(isModuleEnabled(section,flags))void refresh(section);
 },[section,refresh,flags]);
 useEffect(()=>{
  const onFocus=()=>{if(document.visibilityState==='visible'){void refresh();if(currentSection.current==='messages')void loadMessages(selectedRef.current);}};
  window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus);
 },[refresh,loadMessages]);
 const mutate=async(action,payload={},success='Saved')=>{
  const atSection=currentSection.current;setWorking(true);setError('');setNotice('');
  try{const result=await invoke(action,payload);window.dispatchEvent(new Event('ccx-data-changed'));if(mounted.current){setNotice(success);if(atSection===currentSection.current)await refresh(atSection);}return result;}
  catch(e){if(mounted.current)setError(e.message);return null;}
  finally{if(mounted.current)setWorking(false);}
 };
 useEffect(()=>{
  if(section!=='messages'||!selected)return;
  const id=selected;
  const channel=supabase.channel('member-messages-'+id).on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'conversation_id=eq.'+id},()=>void loadMessages(id)).subscribe();
  // Reconnect/fallback refresh complements realtime without clearing the open chat.
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void loadMessages(id);},20000);
  return()=>{window.clearInterval(timer);void supabase.removeChannel(channel);};
 },[selected,section,loadMessages]);
 useEffect(()=>{
  setOnlineMembers([]);setTypingMembers([]);
  if(section!=='messages'||!selected)return;
  let active=true;const timers=new Map();
  const ch=supabase.channel('ccx-chat:'+selected,{config:{private:true,presence:{key:user.id}}});presenceRef.current=ch;
  ch.on('presence',{event:'sync'},()=>{if(active)setOnlineMembers(Object.keys(ch.presenceState()).filter(id=>id!==user.id));})
   .on('broadcast',{event:'typing'},({payload})=>{if(!active||payload?.user_id===user.id||!payload?.user_id)return;const id=String(payload.user_id);setTypingMembers(v=>payload.typing?[...new Set([...v,id])]:v.filter(x=>x!==id));if(timers.has(id))clearTimeout(timers.get(id));if(payload.typing)timers.set(id,setTimeout(()=>{if(active)setTypingMembers(v=>v.filter(x=>x!==id));},2500));})
   .subscribe(status=>{if(status==='SUBSCRIBED')void ch.track({user_id:user.id,online:true});});
  return()=>{active=false;for(const timer of timers.values())clearTimeout(timer);if(stopTypingRef.current)clearTimeout(stopTypingRef.current);if(presenceRef.current===ch)presenceRef.current=null;void supabase.removeChannel(ch);};
 },[section,selected,user.id]);
 const typingChange=value=>{setMessage(value);const ch=presenceRef.current;if(!ch)return;if(Date.now()-lastTypingRef.current>900){void ch.send({type:'broadcast',event:'typing',payload:{user_id:user.id,typing:true}});lastTypingRef.current=Date.now();}if(stopTypingRef.current)clearTimeout(stopTypingRef.current);stopTypingRef.current=setTimeout(()=>{void ch.send({type:'broadcast',event:'typing',payload:{user_id:user.id,typing:false}});},1300);};
 const routeSelection=useRef('');
 useEffect(()=>{
  if(section!=='messages'||!items.length)return;
  const context=window.history.state?.memberContext||{};
  const wanted=context.conversationId||items.find(t=>t.peer_user_id===context.targetUserId)?.id;
  if(wanted&&items.some(t=>t.id===wanted)&&routeSelection.current!==wanted){routeSelection.current=wanted;void chooseConversation(wanted);}
 },[section,items]);
 useEffect(()=>{if(section!=='contracts')return;const target=window.history.state?.memberContext?.contractId;if(target&&items.some(c=>c.id===target)){const card=document.querySelector('[data-contract-id="'+CSS.escape(target)+'"] details');if(card instanceof HTMLDetailsElement){card.open=true;card.scrollIntoView({block:'nearest'});}}},[section,items]);
 const acceptedIds=friends.filter(f=>f.status==='accepted').map(f=>f.requester_id===user.id?f.recipient_id:f.requester_id);
 const name=id=>id===user.id?'You':people[id]||'Member';
 const selectMember=(id,person)=>{setTarget(id);if(person)setPeople(v=>({...v,[id]:person.display_name}));};
 const createConversation=async e=>{e.preventDefault();if(!target)return;const result=await mutate('create_conversation',{target_user_id:target},'Conversation opened.');if(result?.item?.id){setTarget('');await chooseConversation(result.item.id);}};
 const createGroup=async e=>{e.preventDefault();const result=await mutate('create_group_conversation',{title:groupName,member_ids:groupPeople},'Private group created.');if(result?.item?.id){setGroupName('');setGroupPeople([]);await chooseConversation(result.item.id);}};
 const send=async e=>{e.preventDefault();const id=selectedRef.current,body=message.trim();if(!id||!body||sending)return;setSending(true);setError('');try{await invoke('send_message',{conversation_id:id,message:body});if(selectedRef.current===id){setMessage('');await loadMessages(id);}void refresh('messages');}catch(failure){setError(failure.message);}finally{setSending(false);}};
 const messageAction=async(action,payload,success)=>{const id=selectedRef.current;const result=await mutate(action,payload,success);if(result&&selectedRef.current===id)await loadMessages(id);return result;};
 const createContract=async e=>{e.preventDefault();const result=await mutate('create_contract',{collaboration_id:contractProject,title,content:terms},'Draft agreement created.');if(result){setTitle('');setTerms({scope:'',compensation:'',usage_rights:'',deliverables:''});}};
 const pageTitle={collaborations:'Collaborations',connections:'Friends',messages:'Messages',contracts:'Contracts',notifications:'Notifications',invitations:'Invitations'}[section]||'Workspace';
 const pageDescription={collaborations:'Plan productions and coordinate your collaborators.',connections:'Your accepted professional connections. Incoming requests are in Notifications.',messages:'Private conversations and, for administrators, confidential support requests from the website footer.',contracts:'Create, review and manage your agreements.'}[section]||'';
 return <div className="space-y-5" data-member-page={section}>
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{pageTitle}</h1><p className={'mt-2 text-sm '+muted}>{pageDescription}</p></div><button type="button" className={button} aria-label={'Refresh '+pageTitle} onClick={()=>{void refresh();if(section==='messages')void loadMessages(selectedRef.current);}} disabled={working}><RefreshCw size={16}/></button></header>
  {error&&<p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{working&&<Loader2 className="animate-spin text-[var(--cc-text-secondary)]" size={18}/>}
  <ModuleAccessBoundary tab={section} flags={flags} onNavigate={workspace.onNavigate}>
  {section==='collaborations'&&<CollaborationHub user={user} onNavigate={goTo} initialTargetId={typeof window!=='undefined'?window.history.state?.memberContext?.targetUserId||'':''}/>}
  {section==='invitations'&&<div className="space-y-2">{items.map(item=><article className={panel} key={item.id}><p>{item.title||'Production collaboration invitation'}</p><p className={'text-xs '+muted}>{item.status} · {new Date(item.created_at).toLocaleString()}</p>{item.status==='pending'&&<div className="ccx-action-row mt-3 flex gap-2"><button type="button" className={button} disabled={working} onClick={()=>mutate('respond_invitation',{invitation_id:item.id,status:'accepted'},'Invitation accepted.')}>Accept</button><button type="button" className="rounded-md bg-red-700 px-3 py-2 text-sm text-white" disabled={working} onClick={()=>mutate('respond_invitation',{invitation_id:item.id,status:'declined'},'Invitation declined.')}>Decline</button></div>}</article>)}{!items.length&&!working&&<div className={panel}>No invitations.</div>}</div>}
  {section==='connections'&&<div className="grid gap-4 md:grid-cols-2"><div className={panel+' space-y-3'}><h3 className="font-semibold">Add a friend</h3><p className={'text-sm '+muted}>Send an introduction first. When the other member replies, you can request friendship.</p><MemberPicker value={target} onChange={selectMember} excludeIds={[user.id]} disabled={working}/><button type="button" className={button} disabled={working||!target} onClick={async()=>{const result=await mutate('request_connection',{target_user_id:target},'Friend request sent.');if(result)setTarget('');}}>Send friend request</button></div><div className={panel+' space-y-3'}><h3 className="font-semibold">Friends</h3><button type="button" className="text-sm text-[var(--cc-text-secondary)] underline" onClick={()=>goTo('notifications')}>View invitations and friend requests in Notifications</button>{items.filter(item=>['accepted','pending'].includes(item.status)).map(item=>{const other=item.requester_id===user.id?item.recipient_id:item.requester_id;return <article key={item.id} className="border-b border-[var(--cc-border)] pb-3"><div className="flex items-center gap-3"><PersonAvatar person={peopleRecords[other]} name={name(other)}/><div><p className="text-sm font-semibold">{name(other)}{Number.isFinite(peopleRecords[other]?.profile_age)?", "+peopleRecords[other].profile_age:''}</p><p className="text-xs capitalize text-[var(--cc-text-secondary)]">{peopleRecords[other]?.role_type?.replaceAll('_',' ')}{peopleRecords[other]?.city?' · '+peopleRecords[other].city:''}</p></div></div><p className={'text-xs '+muted}>{item.status} · {item.requester_id===user.id?'Outgoing':'Incoming'} · {new Date(item.requested_at).toLocaleDateString()}</p>{item.recipient_id===user.id&&item.status==='pending'&&<div className="ccx-action-row mt-2 flex gap-2"><button type="button" className={button} disabled={working} onClick={()=>mutate('respond_connection',{request_id:item.id,status:'accepted'},'Friend request accepted.')}>Accept</button><button type="button" className="rounded-md bg-red-700 px-3 py-2 text-sm text-white" disabled={working} onClick={()=>mutate('respond_connection',{request_id:item.id,status:'declined'},'Request declined.')}>Decline</button></div>}{item.status==='accepted'&&<button type="button" className="mt-2 text-sm text-[var(--cc-text-secondary)]" onClick={()=>{goTo('messages',{targetUserId:other});}}>Message</button>}</article>;})}{!items.length&&!working&&<p className={'text-sm '+muted}>No friends or requests yet.</p>}</div></div>}
  {section==='connections'&&<IntroInbox userId={user.id}/>}
  {section==='connections'&&target&&<IntroThread peerId={target} userId={user.id}/>}
  {section==='messages'&&workspace.isAdmin&&<div className="flex flex-wrap gap-2" role="group" aria-label="Administrator messaging areas">
   <button type="button" className={adminMessagesView==='requests'?'ccx-primary rounded-xl px-4 py-2.5 text-sm':'ccx-secondary rounded-xl px-4 py-2.5 text-sm'} aria-pressed={adminMessagesView==='requests'} onClick={()=>setAdminMessagesView('requests')}>Footer requests & support inbox</button>
   <button type="button" className={adminMessagesView==='chats'?'ccx-primary rounded-xl px-4 py-2.5 text-sm':'ccx-secondary rounded-xl px-4 py-2.5 text-sm'} aria-pressed={adminMessagesView==='chats'} onClick={()=>setAdminMessagesView('chats')}>Personal and group messages</button>
  </div>}
  {section==='messages'&&workspace.isAdmin&&adminMessagesView==='requests'&&<AdminTrustInbox initialCaseId={typeof window!=='undefined'?window.history.state?.memberContext?.supportCaseId||'':''} onNavigate={goTo}/>}
  {section==='messages'&&(!workspace.isAdmin||adminMessagesView==='chats')&&<>
   <MessengerLayout threads={items} messages={messages} people={peopleRecords} user={user} selected={selected} working={working} sending={sending} attachmentsEnabled={attachmentsEnabled}
    onSelect={chooseConversation} onBack={()=>{selectedRef.current='';setSelected('');setMessages([]);messageVersion.current++;}}
    onSend={async(body,files)=>{const conversationId=selectedRef.current;if(!conversationId)return;setSending(true);setError('');try{const attachments=[];for(const file of files)attachments.push(await uploadMessageAttachment(conversationId,file));await invoke('send_message',{conversation_id:conversationId,message:body,attachment_ids:attachments.map(a=>a.id),attachments});if(selectedRef.current===conversationId)await loadMessages(conversationId);await refresh('messages');}finally{setSending(false);}}}
    onEdit={msg=>{setEditId(msg.id);setEditBody(msg.body);}}
    onRemove={msg=>{if(window.confirm('Remove this message? The audit record is retained.'))void messageAction('delete_message',{message_id:msg.id},'Message removed.');}}
    onReact={(message_id,reaction)=>messageAction('react_message',{message_id,reaction},'Reaction updated.')}
    presenceLabel={typingMembers.length?typingMembers.map(name).join(', ')+' is typing…':onlineMembers.length?onlineMembers.length+' online':''} onTypingChange={typingChange}
    headerActions={selected&&<div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>goTo('meeting',{scope:'conversation',scopeId:selected})}>Video call</button><button type="button" className="ccx-secondary rounded-xl px-3 py-2 text-xs" onClick={()=>goTo('collaborations',{targetUserId:items.find(i=>i.id===selected)?.peer_user_id,conversationId:selected})}>Start collaboration</button>{paid&&items.some(c=>c.id===selected&&c.kind==='group'&&(c.created_by===user.id||workspace.isAdmin))&&<details className="relative"><summary className="ccx-secondary cursor-pointer rounded-xl px-3 py-2 text-xs">Manage group</summary><div className="absolute right-0 top-full z-30 mt-2 w-64 space-y-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4 shadow-xl"><MemberPicker label="Add a connected friend" value={newGroupMember} onChange={setNewGroupMember} onlyIds={acceptedIds} excludeIds={[user.id]} disabled={working}/><button type="button" className={button} disabled={working||!newGroupMember} onClick={async()=>{const result=await mutate('add_group_conversation_member',{conversation_id:selected,target_user_id:newGroupMember},'Friend added to the group.');if(result)setNewGroupMember('');}}>Add friend</button></div></details>}</div>}
    tools={<details className="rounded-xl border border-[var(--cc-border)] p-3"><summary className="cursor-pointer text-sm font-semibold">New conversation</summary><form onSubmit={createConversation} className="mt-3 space-y-3"><MemberPicker label="Find an accepted friend" value={target} onChange={selectMember} onlyIds={acceptedIds} excludeIds={[user.id]} disabled={working}/><button className={button} disabled={working||!target}>Start conversation</button></form>{paid&&<form onSubmit={createGroup} className="mt-4 space-y-3 border-t border-[var(--cc-border)] pt-3"><label className="block text-sm">Group title<input className={input+' mt-1'} required minLength={3} value={groupName} onChange={e=>setGroupName(e.target.value)}/></label><MemberPicker label="Add an accepted friend" value="" onlyIds={acceptedIds} excludeIds={[user.id,...groupPeople]} disabled={working||groupPeople.length>=9} onChange={(id,p)=>{if(id){setGroupPeople(v=>[...new Set([...v,id])]);if(p)setPeople(v=>({...v,[id]:p.display_name}));}}}/><div className="flex flex-wrap gap-2">{groupPeople.map(id=><button key={id} type="button" className="ccx-secondary rounded-lg px-2 py-1 text-xs" onClick={()=>setGroupPeople(v=>v.filter(x=>x!==id))}>{name(id)} ×</button>)}</div><button className={button} disabled={working||groupPeople.length<2}>Create group chat</button></form>}</details>}/>
   {editId&&<form className={panel+' space-y-3 rounded-xl'} onSubmit={async e=>{e.preventDefault();const result=await messageAction('edit_message',{message_id:editId,message:editBody},'Message updated.');if(result)setEditId('');}}><label className="block text-sm">Edit your message<textarea className={input+' mt-1'} rows={3} value={editBody} onChange={e=>setEditBody(e.target.value)} maxLength={10000} required/></label><div className="flex gap-2"><button className={button} disabled={working}>Save changes</button><button type="button" className="ccx-secondary rounded-xl px-3 py-2" onClick={()=>setEditId('')}>Cancel</button></div></form>}
  </>}
  {section==='contracts'&&<div className="grid gap-4 md:grid-cols-2"><form className={panel+' space-y-3'} onSubmit={createContract}><h3 className="font-semibold">New agreement</h3><label className="block text-sm">Collaboration<select className={input+' mt-1'} value={contractProject} onChange={e=>setContractProject(e.target.value)} required><option value="">Select collaboration</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label className="block text-sm">Agreement title<input className={input+' mt-1'} value={title} onChange={e=>setTitle(e.target.value)} required/></label>{Object.entries({scope:'Scope of work',compensation:'Compensation',usage_rights:'Usage rights',deliverables:'Deliverables and timing'}).map(([key,label])=><label key={key} className="block text-sm">{label}<textarea className={input+' mt-1'} rows={3} required={key==='scope'} maxLength={5000} value={terms[key]} onChange={e=>setTerms(v=>({...v,[key]:e.target.value}))}/></label>)}<button className={button} disabled={working}>Create draft</button></form><div className={panel+' space-y-3'}><h3 className="font-semibold">Agreements</h3>{items.map(item=><article key={item.id} data-contract-id={item.id} className="space-y-2 border-b border-[var(--cc-border)] pb-3"><strong>{item.title}</strong><p className={'text-xs '+muted}>{String(item.status||'Unknown').replaceAll('_',' ')}{item.created_at?' · '+new Date(item.created_at).toLocaleDateString():''}</p>{item.participants?.length>0&&<div className="flex flex-wrap gap-3" aria-label="Agreement participants">{item.participants.map(p=><span className="flex items-center gap-2 text-xs" key={p.id||p.user_id}><PersonAvatar person={p} size={28}/>{p.display_name}</span>)}</div>}<details className="rounded-xl border border-[var(--cc-border)] p-3"><summary className="cursor-pointer text-sm font-semibold">View agreement · Version {item.version||1}</summary><dl className="ccx-contract-content mt-4">{Object.entries(item.content||{}).map(([key,value])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd className="text-sm">{Array.isArray(value)?value.join(', '):typeof value==='object'?'See associated production plan.':String(value??'')}</dd></div>)}</dl>{item.demo&&<p className="mt-3 text-xs text-[var(--cc-text-secondary)]">Fictional demonstration. No real signatures or legal agreement.</p>}</details>{['draft','partially_signed'].includes(item.status)&&<p className="text-sm text-amber-800">Draft only. Formal signing needs the configured document provider; a saved draft is not a signature.</p>}</article>)}{!items.length&&!working&&<p className={'text-sm '+muted}>No agreements yet.</p>}</div></div>}
  {section==='notifications'&&<div className="space-y-2">{items.map(item=><article className={panel} key={item.id}><h3 className="font-semibold">{item.title}</h3><p className={'text-xs '+muted}>{new Date(item.created_at).toLocaleString()}</p>{!item.read_at&&<button type="button" className="mt-2 text-sm text-[var(--cc-text-secondary)]" disabled={working} onClick={()=>mutate('mark_notification_read',{notification_id:item.id},'Marked read.')}>Mark read</button>}</article>)}{!items.length&&!working&&<div className={panel}>No notifications.</div>}</div>}
  </ModuleAccessBoundary>
 </div>;
}
