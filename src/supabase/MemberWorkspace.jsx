/** Real Supabase premium workspace. All mutations use the server-side entitlement gateway. */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Check, FileSignature, MessageSquare, Users, Home, Bell, Loader2, RefreshCw } from 'lucide-react';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-4';
const input='w-full rounded-md border border-[#34445D] bg-[#0F1520] p-2 text-sm text-white placeholder-[#8090A5]';
const button='rounded-md bg-[#4F8CFF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3978ED] disabled:opacity-50';
const muted='text-[#9AA6BC]';
/** @type {Array<[string, string, import('react').ElementType]>} */
const sections=[['collaborations','Collaborations',Users],['invitations','Invitations',Check],['messages','Messages',MessageSquare],['contracts','Contracts',FileSignature],['properties','Properties',Home],['bookings','Bookings',Home],['notifications','Notifications',Bell]];

export default function MemberWorkspace({user}) {
  const [section,setSection]=useState('collaborations');
  const [items,setItems]=useState([]);
  const [secondary,setSecondary]=useState([]);
  const [selected,setSelected]=useState('');
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [target,setTarget]=useState('');
  const [message,setMessage]=useState('');
  const [content,setContent]=useState('');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [city,setCity]=useState('');
  const [rate,setRate]=useState('');
  const [country,setCountry]=useState('United States');

  const invoke=useCallback(async(action,payload={})=>{
    const {data,error:invokeError}=await supabase.functions.invoke('member-workflows',{body:{action,...payload}});
    if(invokeError||data?.error)throw new Error(data?.error||invokeError?.message||'Operation failed');
    return data;
  },[]);

  const refresh=useCallback(async(currentSection=section)=>{
    setWorking(true);setError('');
    try{
      const mainAction={collaborations:'list_collaborations',invitations:'list_invitations',messages:'list_conversations',contracts:'list_contracts',properties:'list_properties',bookings:'list_bookings',notifications:'list_notifications'}[currentSection];
      const [primaryData,secondData]=await Promise.all([
        invoke(mainAction),currentSection==='properties'?invoke('list_my_properties'):currentSection==='contracts'?invoke('list_collaborations'):Promise.resolve({items:[]}),
      ]);
      setItems(primaryData.items||[]);setSecondary(secondData.items||[]);
    }catch(e){setError(e.message);}finally{setWorking(false);}
  },[invoke,section]);

  useEffect(()=>{refresh(section);setSelected('');},[section,refresh]);

  const mutate=async(action,payload={},success='Saved')=>{
    setWorking(true);setError('');setNotice('');
    try{const result=await invoke(action,payload);setNotice(success);await refresh(section);return result;}
    catch(e){setError(e.message);return null;}
    finally{setWorking(false);}
  };

  const chooseConversation=async(id)=>{
    setSelected(id);setWorking(true);setError('');
    try{const result=await invoke('list_messages',{conversation_id:id});setSecondary(result.items||[]);}
    catch(e){setError(e.message);}finally{setWorking(false);}
  };

  const createCollaboration=async(e)=>{
    e.preventDefault();const result=await mutate('create_collaboration',{title,description},'Collaboration draft created.');
    if(result){setTitle('');setDescription('');}
  };
  const createConversation=async(e)=>{
    e.preventDefault();const result=await mutate('create_conversation',{target_user_id:target},'Conversation created.');
    if(result){setTarget('');await chooseConversation(result.item.id);}
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
  const sign=async(contract)=>{
    if(!window.confirm('I have read the full agreement and explicitly consent to signing the current version.'))return;
    await mutate('sign_contract',{contract_id:contract.id,consent:true},'Signature recorded.');
  };
  const createProperty=async(e)=>{
    e.preventDefault();const result=await mutate('create_property',{title,description,city,country,hourly_rate:Number(rate)},'Draft property created; not publicly listed until approved.');
    if(result){setTitle('');setDescription('');setCity('');setRate('');}
  };
  const requestBooking=async(property_id)=>{
    const result=await mutate('book_property',{property_id,starts_at:new Date(dateFrom).toISOString(),ends_at:new Date(dateTo).toISOString()},'Request submitted to the property owner.');
    if(result){setDateFrom('');setDateTo('');}
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Member workspace</h2><button className={button} onClick={()=>refresh()} disabled={working}><RefreshCw size={15}/></button></div>
    <p className={`text-sm ${muted}`}>This is the Supabase-only workspace. Each action is authorized by the backend and recorded for audit.</p>
    <div className="flex flex-wrap gap-2">{sections.map(([key,label,Icon])=><button key={key} onClick={()=>setSection(key)} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs ${key===section?'bg-[#4F8CFF]':'bg-[#1A2438]'}`}><Icon size={14}/>{label}</button>)}</div>
    {error&&<p role="alert" className="rounded-md bg-red-950 p-3 text-red-200 text-sm">{error}</p>}
    {notice&&<p role="status" className="rounded-md bg-emerald-950 p-3 text-emerald-200 text-sm">{notice}</p>}
    {working&&<Loader2 className="animate-spin text-blue-400" size={18}/>}
    {section==='collaborations'&&<div className="grid gap-4 md:grid-cols-2"><form className={`${panel} space-y-3`} onSubmit={createCollaboration}><h3 className="font-semibold">Create collaboration</h3><label className="block text-sm">Title<input required minLength={3} value={title} onChange={e=>setTitle(e.target.value)} className={`${input} mt-1`}/></label><label className="block text-sm">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} className={`${input} mt-1`} rows={4}/></label><button disabled={working} className={button}>Create draft</button></form><div className={`${panel} space-y-2`}><h3 className="font-semibold">Your collaborations</h3>{items.map(item=><div key={item.id} className="border-b border-[#34445D] pb-3"><strong>{item.title}</strong><p className={`text-xs ${muted}`}>{item.status} · {item.id}</p><button className="text-sm text-blue-400" onClick={()=>{setSelected(item.id);setSection('contracts');}}>Open contracts</button><div className="flex gap-2 mt-2"><input className={input} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Verified member UUID"/><button className={button} disabled={working} onClick={()=>mutate('invite_collaborator',{collaboration_id:item.id,invitee_id:target},'Invitation sent.')}>Invite</button></div></div>)}{!items.length&&<p className={muted}>No collaborations yet.</p>}</div></div>}
    {section==='invitations'&&<div className="space-y-2">{items.map(item=><div className={panel} key={item.id}><p>Collaboration: {item.collaboration_id}</p><p className={`text-xs ${muted}`}>{item.status} · {new Date(item.created_at).toLocaleString()}</p>{item.status==='pending'&&<div className="flex gap-2 mt-3"><button className={button} disabled={working} onClick={()=>mutate('respond_invitation',{invitation_id:item.id,status:'accepted'},'Invitation accepted.')}>Accept</button><button className="rounded-md bg-red-700 px-3 py-2 text-sm" disabled={working} onClick={()=>mutate('respond_invitation',{invitation_id:item.id,status:'declined'},'Invitation declined.')}>Decline</button></div>}</div>)}{!items.length&&<div className={panel}>No invitations.</div>}</div>}
    {section==='messages'&&<div className="grid gap-4 md:grid-cols-3"><div className={`${panel} space-y-3`}><form onSubmit={createConversation} className="space-y-2"><h3 className="font-semibold">Start conversation</h3><input className={input} placeholder="Verified member UUID" value={target} onChange={e=>setTarget(e.target.value)} required/><button className={button} disabled={working}>Start</button></form><h3 className="font-semibold">Conversations</h3>{items.map(item=><button className={`block w-full rounded-md p-2 text-left text-xs ${selected===item.id?'bg-[#34445D]':'bg-[#202A3A]'}`} key={item.id} onClick={()=>chooseConversation(item.id)}>{item.id}</button>)}</div><div className={`${panel} md:col-span-2 space-y-3`}><h3 className="font-semibold">Messages</h3>{!selected&&<p className={muted}>Select a conversation to read or send messages.</p>}{selected&&<><div className="max-h-96 overflow-y-auto space-y-2">{secondary.map(msg=><div key={msg.id} className={`rounded-lg p-3 text-sm ${msg.sender_id===user.id?'bg-[#263D66]':'bg-[#1B2737]'}`}><p>{msg.body}</p><p className={`text-xs ${muted}`}>{new Date(msg.created_at).toLocaleString()}</p></div>)}</div><form className="flex gap-2" onSubmit={send}><textarea className={input} value={message} onChange={e=>setMessage(e.target.value)} rows={2} required maxLength={10000}/><button className={button} disabled={working}>Send</button></form></>}</div></div>}
    {section==='contracts'&&<div className="grid gap-4 md:grid-cols-2"><form className={`${panel} space-y-3`} onSubmit={createContract}><h3 className="font-semibold">New agreement</h3><label className="block text-sm">Collaboration<select className={`${input} mt-1`} value={selected} onChange={e=>setSelected(e.target.value)} required><option value="">Select collaboration</option>{secondary.filter(x=>x.title).map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label className="block text-sm">Agreement title<input className={`${input} mt-1`} value={title} onChange={e=>setTitle(e.target.value)} required/></label><label className="block text-sm">Structured terms (JSON)<textarea className={`${input} mt-1 font-mono`} rows={6} value={content} onChange={e=>setContent(e.target.value)} placeholder='{"scope":"...","compensation":"..."}' required/></label><button className={button} disabled={working}>Create draft</button></form><div className={`${panel} space-y-3`}><h3 className="font-semibold">Agreements</h3>{items.map(item=><div key={item.id} className="border-b border-[#34445D] pb-3"><strong>{item.title}</strong><p className={`text-xs ${muted}`}>{item.status} · {item.id}</p><pre className="overflow-auto p-2 text-xs bg-[#0F1520] mt-2">{JSON.stringify(item.content,null,2)}</pre>{['draft','partially_signed'].includes(item.status)&&<button className={`${button} mt-2`} onClick={()=>sign(item)} disabled={working}>Review and sign</button>}</div>)}</div></div>}
    {section==='properties'&&<div className="grid gap-4 md:grid-cols-2"><form className={`${panel} space-y-3`} onSubmit={createProperty}><h3 className="font-semibold">Create property draft</h3><input className={input} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Property title" required/><textarea className={input} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description"/><div className="flex gap-2"><input className={input} value={city} onChange={e=>setCity(e.target.value)} placeholder="City"/><input className={input} value={country} onChange={e=>setCountry(e.target.value)} placeholder="Country"/></div><label className="block text-sm">Hourly rate<input type="number" min="0" step="0.01" className={`${input} mt-1`} value={rate} onChange={e=>setRate(e.target.value)}/></label><button className={button} disabled={working}>Create draft</button><p className={`text-xs ${muted}`}>Listing approval is a separate administrator step; no automatic publication.</p></form><div className="space-y-3"><div className={panel}><h3 className="font-semibold mb-2">Your properties</h3>{secondary.map(item=><p className="text-sm" key={item.id}>{item.title} · {item.status}</p>)}</div><div className={panel}><h3 className="font-semibold mb-2">Available properties</h3>{items.map(item=><div key={item.id} className="border-b border-[#34445D] py-2"><h4>{item.title}</h4><p className={`text-sm ${muted}`}>{[item.city,item.country].filter(Boolean).join(', ')} · {item.hourly_rate||'Ask'} / hr</p><p className="text-xs">ID: {item.id}</p></div>)}</div></div></div>}
    {section==='bookings'&&<div className="grid gap-4 md:grid-cols-2"><div className={`${panel} space-y-3`}><h3 className="font-semibold">Request a property booking</h3><p className={muted}>Select an active property ID from the Properties tab.</p><input className={input} value={target} placeholder="Property UUID" onChange={e=>setTarget(e.target.value)}/><label className="block text-sm">Start<input className={`${input} mt-1`} type="datetime-local" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label className="block text-sm">End<input className={`${input} mt-1`} type="datetime-local" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label><button className={button} disabled={working||!dateFrom||!dateTo||!target} onClick={()=>requestBooking(target)}>Request booking</button></div><div className={`${panel} space-y-3`}><h3 className="font-semibold">Your booking requests</h3>{items.map(item=><div key={item.id} className="border-b border-[#34445D] py-3"><p>{item.status} · {new Date(item.starts_at).toLocaleString()}</p><p className={`text-xs ${muted}`}>{item.property_id}</p>{item.owner_id===user.id&&item.status==='requested'&&<div className="flex gap-2 mt-2"><button className={button} onClick={()=>mutate('respond_booking',{booking_id:item.id,status:'accepted'},'Booking accepted.')} disabled={working}>Accept</button><button className="rounded-md bg-red-700 px-3 py-2 text-sm" onClick={()=>mutate('respond_booking',{booking_id:item.id,status:'declined'},'Booking declined.')} disabled={working}>Decline</button></div>}</div>)}</div></div>}
    {section==='notifications'&&<div className="space-y-2">{items.map(item=><div className={panel} key={item.id}><h3 className="font-semibold">{item.title}</h3><p className={`text-xs ${muted}`}>{new Date(item.created_at).toLocaleString()}</p>{!item.read_at&&<button className="text-blue-400 text-sm mt-2" disabled={working} onClick={()=>mutate('mark_notification_read',{notification_id:item.id},'Marked read.')}>Mark read</button>}</div>)}{items.length===0&&<div className={panel}>No notifications.</div>}</div>}
  </div>;
}
