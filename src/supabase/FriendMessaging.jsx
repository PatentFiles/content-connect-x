import React,{useEffect,useState} from 'react';
import {MessageCircle,RefreshCw} from 'lucide-react';
import {suiteAction} from './collabSuiteApi';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm';
const btn='ccx-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-60';
export function FriendSettings(){
 const [settings,setSettings]=useState({request_policy:'message_first',allow_intro_messages:true}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{suiteAction('friend_settings_get').then(r=>setSettings(r.settings)).catch(e=>setError(e.message));},[]);
 const save=async()=>{setBusy(true);setError('');try{await suiteAction('friend_settings_save',settings);setNotice('Friend settings saved.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="ccx-surface space-y-3 p-5"><h3 className="font-semibold">Friend request settings</h3><label className="block text-sm">Who may send a friend request?
  <select className={input+' mt-1'} value={settings.request_policy} onChange={e=>setSettings(s=>({...s,request_policy:e.target.value}))}>
   <option value="message_first">After we have both exchanged messages</option><option value="everyone">Any verified member</option><option value="no_one">Nobody</option>
  </select></label>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={settings.allow_intro_messages} onChange={e=>setSettings(s=>({...s,allow_intro_messages:e.target.checked}))}/>Accept introductory messages from verified members</label>
  <p className="text-xs text-[var(--cc-text-secondary)]">Introductions are private. Requests are validated by the database, including the mutual-message requirement.</p>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p className="text-sm">{notice}</p>}
  <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" disabled={busy} onClick={()=>void save()}>Save friend settings</button>
 </section>;
}
export function IntroThread({peerId,userId}){
 const [items,setItems]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{if(!peerId)return;try{const r=await suiteAction('intro_thread',{peer_id:peerId});setItems(r.items||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{setItems([]);setError('');void load();},[peerId]);
 const send=async()=>{setBusy(true);setError('');setNotice('');try{await suiteAction('intro_send',{peer_id:peerId,message});setMessage('');setNotice('Introduction sent.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(!peerId)return null;
 return <section className="space-y-3 rounded-xl border border-[var(--cc-border)] p-3" data-intro-thread="true">
  <div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 font-semibold"><MessageCircle size={16}/>Introduce yourself</h4><button className={btn} type="button" onClick={()=>void load()} aria-label="Refresh introductions"><RefreshCw size={16}/></button></div>
  <p className="text-xs text-[var(--cc-text-secondary)]">Exchange a message in both directions before requesting friendship when the other member uses Message First.</p>
  <div className="max-h-48 space-y-2 overflow-y-auto">{items.map(x=><p key={x.id} className={'rounded-lg p-2 text-sm '+(x.sender_id===userId?'bg-[var(--cc-surface-hover)]':'bg-[var(--cc-surface-subtle)]')}><span className="font-medium">{x.sender_id===userId?'You':'Member'}:</span> {x.body}</p>)}</div>
  <textarea className={input} rows={2} maxLength={1200} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Hello! I would like to discuss a potential collaboration…"/>
  <button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" onClick={()=>void send()} disabled={busy||message.trim().length<2}>{busy?'Sending…':'Send introduction'}</button>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>;
}
export function IntroInbox({userId}){
 const [peers,setPeers]=useState([]),[peer,setPeer]=useState(''),[error,setError]=useState('');
 const load=()=>suiteAction('intro_inbox').then(r=>setPeers([...new Set((r.items||[]).map(m=>m.sender_id===userId?m.recipient_id:m.sender_id))])).catch(e=>setError(e.message));
 useEffect(()=>{void load();},[userId]);
 return <section className="ccx-surface space-y-3 p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Introductions</h3><button className={btn} type="button" onClick={()=>void load()}>Refresh</button></div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {!peers.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No introductions yet. Find people in Discovery to start a conversation.</p>}
  <div className="flex flex-wrap gap-2">{peers.map(id=><button type="button" className={btn} key={id} onClick={()=>setPeer(id)}>{id===peer?'Selected · ':''}Conversation {id.slice(0,8)}</button>)}</div>
  {peer&&<IntroThread key={peer} peerId={peer} userId={userId}/>}
 </section>;
}