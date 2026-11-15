/** Real Supabase premium workspace. All mutations use the server-side entitlement gateway. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Check, FileSignature, MessageSquare, Users, Bell, Loader2, RefreshCw } from 'lucide-react';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-4';
const input='w-full rounded-md border border-[#34445D] bg-[#0F1520] p-2 text-sm text-white placeholder-[#8090A5]';
const button='rounded-md bg-[#4F8CFF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3978ED] disabled:opacity-50';
const muted='text-[#9AA6BC]';
/** @type {Array<[string, string, import('react').ElementType]>} */
const sections=[['collaborations','Collaborations',Users],['invitations','Invitations',Check],['connections','Connections',Users],['messages','Messages',MessageSquare],['contracts','Contracts',FileSignature],['notifications','Notifications',Bell]];

export default function MemberWorkspace({user,flags={}}) {
  const [section,setSection]=useState('collaborations');
  const [items,setItems]=useState([]);
  const [secondary,setSecondary]=useState([]);
  const [selected,setSelected]=useState('');
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [requiresClearance,setRequiresClearance]=useState(false);
  const [target,setTarget]=useState('');
  const [message,setMessage]=useState('');
  const [groupName,setGroupName]=useState('');
  const [groupPeople,setGroupPeople]=useState('');
  const [editId,setEditId]=useState('');
  const [editBody,setEditBody]=useState('');
  const [onlineMembers,setOnlineMembers]=useState([]);
  const [typingMembers,setTypingMembers]=useState([]);
  const presenceRef=useRef(null);
  const lastTypingRef=useRef(0);
  const stopTypingRef=useRef(null);
  const [content,setContent]=useState('');

  const invoke=useCallback(async(action,payload={})=>{
    const {data,error:invokeError}=await supabase.functions.invoke('member-workflows',{body:{action,...payload}});
    if(invokeError||data?.error)throw new Error(data?.error||invokeError?.message||'Operation failed');
    return data;
  },[]);

  const refresh=useCallback(async(currentSection=section)=>{
    setWorking(true);setError('');
    try{
      const mainAction={collaborations:'list_collaborations',invitations:'list_invitations',connections:'list_connection_requests',messages:'list_conversations',contracts:'list_contracts',notifications:'list_notifications'}[currentSection];
      const [primaryData,secondData]=await Promise.all([
        invoke(mainAction),currentSection==='contracts'?invoke('list_collaborations'):Promise.resolve({items:[]}),
      ]);
      setItems(primaryData.items||[]);setSecondary(secondData.items||[]);
    }catch(e){setError(e.message);}finally{setWorking(false);}
  },[invoke,section]);

  useEffect(()=>{refresh(section); if(section!=='contracts')setSelected('');},[section,refresh]);

  const mutate=async(action,payload={},success='Saved')=>{
    setWorking(true);setError('');setNotice('');
    try{const result=await invoke(action,payload);setNotice(success);await refresh(section);return result;}
    catch(e){setError(e.message);return null;}
    finally{setWorking(false);}
  };

  const chooseConversation=async(id)=>{
    setSelected(id);setWorking(true);setError('');
    try{
      const result=await invoke('list_messages',{conversation_id:id});
      setSecondary(result.items||[]);
      await invoke('mark_conversation_read',{conversation_id:id});
    }catch(e){setError(e.message);}finally{setWorking(false);}
  };

  // RLS-filtered postgres_changes: only conversation members can receive row
  // updates from Supabase Realtime. No public typing/presence channel is used.
  useEffect(()=>{
    if(section!=='messages'||!selected)return;
    let active=true;
    const channel=supabase.channel('member-messages-'+selected)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'messages',filter:'conversation_id=eq.'+selected
      },async()=>{
        if(!active)return;
        try{
          const result=await invoke('list_messages',{conversation_id:selected});
          if(active)setSecondary(result.items||[]);
          await invoke('mark_conversation_read',{conversation_id:selected});
        }catch(e){if(active)setError(e.message);}
      }).subscribe();
    return()=>{active=false;supabase.removeChannel(channel);};
  },[selected,section,invoke]);

  // Private broadcasts and presence are protected by realtime.messages RLS.
  // A blocked, expired, suspended or nonmember user cannot join the topic.
  useEffect(()=>{
    if(section!=='messages'||!selected)return;
    let active=true;
    const ch=supabase.channel('ccx-chat:'+selected,{config:{private:true,presence:{key:user.id}}});
    presenceRef.current=ch;
    const timeouts=new Map();
    ch.on('presence',{event:'sync'},()=>{
      if(!active)return;
      setOnlineMembers(Object.keys(ch.presenceState()).filter(id=>id!==user.id));
    }).on('broadcast',{event:'typing'},({payload})=>{
      if(!active||payload?.user_id===user.id||!payload?.user_id)return;
      const id=String(payload.user_id);
      setTypingMembers(prev=>payload.typing?[...new Set([...prev,id])]:prev.filter(v=>v!==id));
      if(timeouts.has(id))clearTimeout(timeouts.get(id));
      if(payload.typing)timeouts.set(id,setTimeout(()=>{
        if(active)setTypingMembers(prev=>prev.filter(v=>v!==id));
      },2500));
    }).subscribe(status=>{
      if(status==='SUBSCRIBED')void ch.track({user_id:user.id,online:true});
    });
    return()=>{
      active=false;
      for(const value of timeouts.values())clearTimeout(value);
      if(presenceRef.current===ch)presenceRef.current=null;
      void supabase.removeChannel(ch);
    };
  },[section,selected,user.id]);

  const typingChange=value=>{
    setMessage(value);
    const ch=presenceRef.current;
    if(!ch)return;
    if(Date.now()-lastTypingRef.current>900){
      void ch.send({type:'broadcast',event:'typing',payload:{user_id:user.id,typing:true}});
      lastTypingRef.current=Date.now();
    }
    if(stopTypingRef.current)clearTimeout(stopTypingRef.current);
    stopTypingRef.current=setTimeout(()=>{
      void ch.send({type:'broadcast',event:'typing',payload:{user_id:user.id,typing:false}});
    },1300);
  };

  const createCollaboration=async(e)=>{
    e.preventDefault();const result=await mutate('create_collaboration',{title,description,requires_work_clearance:requiresClearance},'Collaboration draft created.');
    if(result){setTitle('');setDescription('');}
  };
  const createConversation=async(e)=>{
    e.preventDefault();const result=await mutate('create_conversation',{target_user_id:target},'Conversation created.');
    if(result){setTarget('');await chooseConversation(result.item.id);}
  };
  const createGroup=async(event)=>{
    event.preventDefault();
    const member_ids=groupPeople.split(',').map(p=>p.trim()).filter(Boolean);
    const created=await mutate('create_group_conversation',{title:groupName,member_ids},'Private group created.');
    if(created){setGroupName('');setGroupPeople('');await chooseConversation(created.item.id);}
  };
  const editMessage=async(event)=>{
    event.preventDefault();
    const result=await mutate('edit_message',{message_id:editId,message:editBody},'Message updated.');
    if(result){setEditId('');setEditBody('');await chooseConversation(selected);}
  };
  const removeMessage=async(id)=>{
    if(!window.confirm('Remove this message from the conversation? The audit record will be retained.'))return;
    const result=await mutate('delete_message',{message_id:id},'Message removed.');
    if(result)await chooseConversation(selected);
  };
  const reactTo=async(id,reaction)=>{
    const result=await mutate('react_message',{message_id:id,reaction},'Reaction updated.');
    if(result)await chooseConversation(selected);
  };
  const send=async(e)=>{
    e.preventDefault();if(!selected)return;
    const result=await mutate('send_message',{conversation_id:selected,message},'Message sent.');
    if(result){setMessage('');await chooseConversation(selected);}
  };
  const createContract=async(e)=>{
    e.preventDefault();let parsed;
    try{parsed=JSON.parse(content);}catch{return setError('Contract body must be valid JSON.');}
    if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')return setError('Use a JSON object.');
    const result=await mutate('create_contract',{collaboration_id:selected,title,content:parsed},'Draft agreement created.');
    if(result){setTitle('');setContent('');}
  };
  const enabled = /** @type {Record<string, boolean>} */ (flags);
  const visibleSections=sections.filter(([key])=>(key==='messages'||key==='connections')?enabled.messages!==false:(key==='contracts')?enabled.contracts!==false:true);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Member workspace</h2><button className={button} onClick={()=>refresh()} disabled={working}><RefreshCw size={15}/></button></div>
    <p className={`text-sm ${muted}`}>Collaborations, private conversations and contracts are managed here. Studio rentals, venue calendars, equipment and host bookings are managed in the Hosting Marketplace.</p>
    <div className="flex flex-wrap gap-2">{visibleSections.map(([key,label,Icon])=><button key={key} onClick={()=>setSection(key)} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs ${key===section?'ccx-nav-pill is-active':'ccx-nav-pill'}`}><Icon size={14}/>{label}</button>)}</div>
    {error&&<p role="alert" className="rounded-md bg-red-950 p-3 text-red-200 text-sm">{error}</p>}
    {notice&&<p role="status" className="rounded-md bg-emerald-950 p-3 text-emerald-200 text-sm">{notice}</p>}
    {working&&<Loader2 className="animate-spin text-blue-400" size={18}/>}
    {section==='collaborations'&&<div className="grid gap-4 md:grid-cols-2"><form className={`${panel} space-y-3`} onSubmit={createCollaboration}><h3 className="font-semibold">Create collaboration</h3><label className="block text-sm">Title<input required minLength={3} value={title} onChange={e=>setTitle(e.target.value)} className={`${input} mt-1`}/></label><label className="block text-sm">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} className={`${input} mt-1`} rows={4}/></label><label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={requiresClearance} onChange={e=>setRequiresClearance(e.target.checked)} className="mt-1"/>Require a current provider-confirmed STI work clearance before signatures</label><button disabled={working} className={button}>Create draft</button></form><div className={`${panel} space-y-2`}><h3 className="font-semibold">Your collaborations</h3>{items.map(item=><div key={item.id} className="border-b border-[#34445D] pb-3"><strong>{item.title}</strong><p className={`text-xs ${muted}`}>{item.status} · {item.id}</p><button className="text-sm text-blue-400" onClick={()=>{setSelected(item.id);setSection('contracts');}}>Open contracts</button><div className="flex gap-2 mt-2"><input className={input} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Verified member UUID"/><button className={button} disabled={working} onClick={()=>mutate('invite_collaborator',{collaboration_id:item.id,invitee_id:target},'Invitation sent.')}>Invite</button></div></div>)}{!items.length&&<p className={muted}>No collaborations yet.</p>}</div></div>}
    {section==='invitations'&&<div className="space-y-2">{items.map(item=><div className={panel} key={item.id}><p>Collaboration: {item.collaboration_id}</p><p className={`text-xs ${muted}`}>{item.status} · {new Date(item.created_at).toLocaleString()}</p>{item.status==='pending'&&<div className="flex gap-2 mt-3"><button className={button} disabled={working} onClick={()=>mutate('respond_invitation',{invitation_id:item.id,status:'accepted'},'Invitation accepted.')}>Accept</button><button className="rounded-md bg-red-700 px-3 py-2 text-sm" disabled={working} onClick={()=>mutate('respond_invitation',{invitation_id:item.id,status:'declined'},'Invitation declined.')}>Decline</button></div>}</div>)}{!items.length&&<div className={panel}>No invitations.</div>}</div>}
    {section==='connections'&&<div className="grid gap-4 md:grid-cols-2"><div className={panel}><h3 className="font-semibold mb-3">Request a connection</h3><p className="text-sm text-[#9AA6BC] mb-3">The other creator must accept before either person can start a direct conversation.</p><div className="flex gap-2"><input className={input} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Verified member ID"/><button disabled={working||!target} className={button} onClick={()=>mutate('request_connection',{target_user_id:target},'Request sent.')}>Request</button></div></div><div className={`${panel} space-y-3`}><h3 className="font-semibold">Your connection requests</h3>{items.map(item=><div key={item.id} className="border-b border-[#34445D] pb-3"><p className="text-sm break-all">{item.requester_id===user.id?'To: '+item.recipient_id:'From: '+item.requester_id}</p><p className="text-xs text-[#9AA6BC]">{item.status} · {new Date(item.requested_at).toLocaleString()}</p>{item.recipient_id===user.id&&item.status==='pending'&&<div className="flex gap-2 mt-2"><button className={button} disabled={working} onClick={()=>mutate('respond_connection',{request_id:item.id,status:'accepted'},'Connection accepted.')}>Accept</button><button className="rounded-md bg-red-700 px-3 py-2 text-sm" disabled={working} onClick={()=>mutate('respond_connection',{request_id:item.id,status:'declined'},'Connection declined.')}>Decline</button></div>}{item.status==='accepted'&&<button className="mt-2 text-sm text-blue-400" onClick={()=>{setTarget(item.requester_id===user.id?item.recipient_id:item.requester_id);setSection('messages');}}>Start conversation</button>}</div>)}{!items.length&&<p className="text-sm text-[#9AA6BC]">No connection requests yet.</p>}</div></div>}
    {section==='messages'&&<div className="grid gap-4 md:grid-cols-3"><div className={`${panel} space-y-3`}><form onSubmit={createConversation} className="space-y-2"><h3 className="font-semibold">Start conversation</h3><p className="text-xs text-[#9AA6BC]">Both creators must accept a connection request first.</p><input className={input} placeholder="Verified member UUID" value={target} onChange={e=>setTarget(e.target.value)} required/><button className={button} disabled={working}>Start</button></form><form onSubmit={createGroup} className="space-y-2 border-t border-[#34445D] pt-3"><h3 className="font-semibold">Create group chat</h3><input className={input} placeholder="Group title" required minLength={3} value={groupName} onChange={e=>setGroupName(e.target.value)}/><textarea className={input} placeholder="2–9 mutually connected member IDs, separated by commas" rows={2} required value={groupPeople} onChange={e=>setGroupPeople(e.target.value)}/><button className={button} disabled={working}>Create private group</button></form><h3 className="font-semibold">Conversations</h3>{items.map(item=><button className={`block w-full rounded-md p-2 text-left text-xs ${selected===item.id?'bg-[#34445D]':'bg-[#202A3A]'}`} key={item.id} onClick={()=>chooseConversation(item.id)}>{item.title||item.id}{item.kind==='group'?' · Group':''}{item.unread>0?' · '+item.unread+' unread':''}</button>)}</div><div className={`${panel} md:col-span-2 space-y-3`}><h3 className="font-semibold">Messages</h3><p className="text-xs text-[#9AA6BC]">{onlineMembers.length} other members online{typingMembers.length?` · ${typingMembers.length} typing...`:``}</p>{!selected&&<p className={muted}>Select a conversation to read or send messages.</p>}{selected&&<><div className="max-h-96 overflow-y-auto space-y-2">{secondary.map(msg=><div key={msg.id} className={`rounded-lg p-3 text-sm ${msg.sender_id===user.id?'bg-[#263D66]':'bg-[#1B2737]'}`}><p className="whitespace-pre-wrap break-words">{msg.body}</p><p className={`text-xs ${muted}`}>{new Date(msg.created_at).toLocaleString()}{msg.edited_at?' · edited':''}</p><div className="flex gap-2 mt-2 flex-wrap">{!msg.deleted_at&&['like','heart','support'].map(reaction=><button className="text-xs text-blue-300" key={reaction} onClick={()=>reactTo(msg.id,reaction)}>{reaction}</button>)}{msg.sender_id===user.id&&!msg.deleted_at&&<><button className="text-xs text-blue-300" onClick={()=>{setEditId(msg.id);setEditBody(msg.body);}}>Edit</button><button className="text-xs text-red-300" onClick={()=>removeMessage(msg.id)}>Remove</button></>}</div></div>)}</div>{editId&&<form className="space-y-2 bg-[#0F1520] p-3 rounded-lg" onSubmit={editMessage}><p className="text-sm">Edit your message (within 15 minutes)</p><textarea className={input} rows={3} value={editBody} onChange={e=>setEditBody(e.target.value)} maxLength={10000}/><div className="flex gap-2"><button className={button} disabled={working}>Save changes</button><button type="button" className="text-sm" onClick={()=>setEditId('')}>Cancel</button></div></form>}<form className="flex gap-2" onSubmit={send}><textarea className={input} value={message} onChange={e=>typingChange(e.target.value)} rows={2} required maxLength={10000}/><button className={button} disabled={working}>Send</button></form></>}</div></div>}
    {section==='contracts'&&<div className="grid gap-4 md:grid-cols-2"><form className={`${panel} space-y-3`} onSubmit={createContract}><h3 className="font-semibold">New agreement</h3><label className="block text-sm">Collaboration<select className={`${input} mt-1`} value={selected} onChange={e=>setSelected(e.target.value)} required><option value="">Select collaboration</option>{secondary.filter(x=>x.title).map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label className="block text-sm">Agreement title<input className={`${input} mt-1`} value={title} onChange={e=>setTitle(e.target.value)} required/></label><label className="block text-sm">Structured terms (JSON)<textarea className={`${input} mt-1 font-mono`} rows={6} value={content} onChange={e=>setContent(e.target.value)} placeholder='{"scope":"...","compensation":"..."}' required/></label><button className={button} disabled={working}>Create draft</button></form><div className={`${panel} space-y-3`}><h3 className="font-semibold">Agreements</h3>{items.map(item=><div key={item.id} className="border-b border-[#34445D] pb-3"><strong>{item.title}</strong><p className={`text-xs ${muted}`}>{item.status} · {item.id}</p><pre className="overflow-auto p-2 text-xs bg-[#0F1520] mt-2">{JSON.stringify(item.content,null,2)}</pre>{['draft','partially_signed'].includes(item.status)&&<p className="mt-2 text-sm text-amber-200">Pending DocuSign setup — formal signing is not enabled yet.</p>}</div>)}</div></div>}
    {section==='notifications'&&<div className="space-y-2">{items.map(item=><div className={panel} key={item.id}><h3 className="font-semibold">{item.title}</h3><p className={`text-xs ${muted}`}>{new Date(item.created_at).toLocaleString()}</p>{!item.read_at&&<button className="text-blue-400 text-sm mt-2" disabled={working} onClick={()=>mutate('mark_notification_read',{notification_id:item.id},'Marked read.')}>Mark read</button>}</div>)}{items.length===0&&<div className={panel}>No notifications.</div>}</div>}
  </div>;
}
