/** Private friendship policy + message-before-friend introductions.
 * Does not provide unsolicited mass messaging or bypass block/cooldown rules.
 */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import MemberPicker from './MemberPicker';
import {MessageCircle,ShieldCheck} from 'lucide-react';
const field='mt-1 w-full min-h-11 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2 text-sm';
const primary='ccx-primary min-h-11 rounded-xl px-4 py-2 text-sm disabled:opacity-50';
const defaultPolicy={request_policy:'message_first',allow_intro_messages:true,allow_nonfriend_collaboration_invites:false,friend_count_visibility:'private',friend_request_daily_limit:10};
async function intro(action,extra={}){
 const {data,error}=await supabase.functions.invoke('member-workflows',{body:{action,...extra}});
 if(error||data?.error)throw Error(data?.error||'Friendship introductions are unavailable.');
 return data;
}
export default function FriendSettingsPanel({userId}){
 const [policy,setPolicy]=useState(defaultPolicy),[target,setTarget]=useState(''),[text,setText]=useState('');
 const [introductions,setIntroductions]=useState([]),[replies,setReplies]=useState({});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  try{
   const [prefs,msgs]=await Promise.all([
    supabase.from('ccx_friend_preferences').select('request_policy,allow_intro_messages,allow_nonfriend_collaboration_invites,friend_count_visibility,friend_request_daily_limit').eq('user_id',userId).maybeSingle(),
    intro('intro_list')
   ]);
   if(prefs.error)throw prefs.error;
   setPolicy(prefs.data||defaultPolicy);setIntroductions(msgs.items||[]);
  }catch(e){setError(e.message);}finally{setLoading(false);}
 };
 useEffect(()=>{if(userId)void load();},[userId]);
 const save=async e=>{
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {error}=await supabase.from('ccx_friend_preferences').upsert({user_id:userId,...policy,updated_at:new Date().toISOString()},{onConflict:'user_id'});
   if(error)throw error;
   setNotice('Friendship settings saved. Other members must follow your current policy.');
  }catch(e){setError('Friend settings could not be saved: '+e.message);}finally{setBusy(false);}
 };
 const send=async(e)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   await intro('intro_start',{target_user_id:target,message:text});
   setText('');setTarget('');setNotice('Introduction sent. Wait for a reply before requesting friendship.');
   const result=await intro('intro_list');setIntroductions(result.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const reply=async(id,decline=false)=>{
  setBusy(true);setError('');setNotice('');
  try{
   await intro(decline?'intro_decline':'intro_reply',{introduction_id:id,message:replies[id]||''});
   setReplies(p=>({...p,[id]:''}));
   setNotice(decline?'Introduction declined.':'Introduction answered. You can now send a friendship request if permitted.');
   const result=await intro('intro_list');setIntroductions(result.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <section className="ccx-surface space-y-4 rounded-xl p-5" data-friend-settings="true">
  <header className="space-y-1"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={19}/>Friends and introductions</h2>
   <p className="text-xs text-[var(--cc-text-secondary)]">Default: exchange a genuine introduction and reply before sending a friend request. You can change this at any time. Blocking always overrides these settings.</p></header>
  <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
   <label className="text-sm">Who can request friendship?
    <select className={field} disabled={busy||loading} value={policy.request_policy} onChange={e=>setPolicy(p=>({...p,request_policy:e.target.value}))}>
     <option value="message_first">Message and reply first</option><option value="everyone">Verified members</option><option value="no_one">Nobody</option>
    </select>
   </label>
   <label className="text-sm">Friend count visibility
    <select className={field} value={policy.friend_count_visibility} onChange={e=>setPolicy(p=>({...p,friend_count_visibility:e.target.value}))}>
     <option value="private">Only me</option><option value="verified">Verified members</option><option value="public">Public</option>
    </select>
   </label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={policy.allow_intro_messages} onChange={e=>setPolicy(p=>({...p,allow_intro_messages:e.target.checked}))}/>Allow professional introductions from verified people</label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={policy.allow_nonfriend_collaboration_invites} onChange={e=>setPolicy(p=>({...p,allow_nonfriend_collaboration_invites:e.target.checked}))}/>Allow collaboration invitations from members after a two-way conversation</label>
   <label className="text-sm">Maximum friendship requests per day
    <select className={field} value={policy.friend_request_daily_limit} onChange={e=>setPolicy(p=>({...p,friend_request_daily_limit:Number(e.target.value)}))}>
     {[3,5,10,15,20,25].map(v=><option key={v} value={v}>{v}</option>)}
    </select>
   </label>
   <button disabled={busy||loading} className={primary+' self-end'} type="submit">Save friendship settings</button>
  </form>
  <div className="space-y-3 border-t border-[var(--cc-border)] pt-3">
   <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle size={17}/>Professional introductions</h3>
   <form onSubmit={send} className="space-y-2">
    <MemberPicker label="Find a verified member to introduce yourself to" excludeIds={[userId]} value={target} onChange={setTarget}/>
    <label className="block text-xs">Your first introduction
     <textarea className={field} minLength={10} maxLength={1000} rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Introduce your professional role, interests and why you would like to connect."/>
    </label>
    <button className={primary} type="submit" disabled={busy||!target||text.trim().length<10}>Send introduction</button>
   </form>
   <div className="space-y-3" aria-label="Private introduction inbox">
    {introductions.map(i=><article key={i.id} className="space-y-2 rounded-xl border border-[var(--cc-border)] p-3 text-xs">
     <p className="font-semibold">{i.requester_id===userId?'Sent introduction':'Received introduction'} · {i.status.replaceAll('_',' ')}</p>
     {(i.messages||[]).map(m=><p key={m.id} className="whitespace-pre-wrap break-words">{m.sender_id===userId?'You: ':'Member: '}{m.body}</p>)}
     {i.recipient_id===userId&&i.status==='awaiting_reply'&&<div className="space-y-2">
      <textarea className={field} rows={2} minLength={2} maxLength={1000} value={replies[i.id]||''} onChange={e=>setReplies(p=>({...p,[i.id]:e.target.value}))} placeholder="Reply to begin a two-way conversation"/>
      <div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={busy||(replies[i.id]||'').trim().length<2} onClick={()=>void reply(i.id)}>Reply</button>
       <button type="button" className="ccx-secondary rounded-xl px-3 py-2 text-sm" disabled={busy} onClick={()=>void reply(i.id,true)}>Decline</button></div>
     </div>}
    </article>)}
    {!introductions.length&&!loading&&<p className="text-xs text-[var(--cc-text-secondary)]">No introductions yet.</p>}
   </div>
  </div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-[var(--cc-surface-subtle)] p-2 text-sm">{notice}</p>}
 </section>;
}
