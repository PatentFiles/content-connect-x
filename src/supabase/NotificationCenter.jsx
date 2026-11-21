/** One route for private alerts, friend requests and collaboration invitations.
 * Rendering is read-only; existing backend handlers authorize every response.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Bell,UserPlus,Users,RefreshCw,Check,ArrowUpRight} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const panel='ccx-surface p-5';
const primary='ccx-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const secondary='ccx-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-50';
async function action(name,payload={}){
 const {data,error}=await supabase.functions.invoke('member-workflows',{body:{action:name,...payload}});
 if(error||data?.error){let text=data?.error||error?.message||'Request failed';try{if(error?.context?.json)text=(await error.context.json()).error||text;}catch{/* original error */}throw Error(text);}
 return data;
}
const destination=notification=>{
 const kind=String(notification.kind||'');
 if(kind==='annual_recap')return 'annual-recap';
 if(kind.includes('connection')||kind.includes('friend')||kind==='introduction')return 'connections';
 if(kind==='meeting_invitation')return 'meeting';
 if(kind==='trust_case'||kind==='trust_case_followup')return 'messages';
 if(kind.includes('message'))return 'messages';
 if(kind.includes('contract'))return 'contracts';
 if(kind.includes('collaboration'))return 'collaborations';
 if(kind.includes('booking')||kind.includes('property'))return 'hosting';
 return 'dashboard';
};
export default function NotificationCenter({user,onNavigate}){
 const [notifications,setNotifications]=useState([]),[friends,setFriends]=useState([]),[invitations,setInvitations]=useState([]),[names,setNames]=useState({});
 const [busy,setBusy]=useState(false),[saving,setSaving]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [requestsUnavailable,setRequestsUnavailable]=useState(false);
 const generation=useRef(0);
 const load=useCallback(async()=>{
  const request=++generation.current;setBusy(true);setError('');
  try{
   const [alertsResult,requestsResult,invitesResult]=await Promise.allSettled([
    action('list_notifications'),action('list_connection_requests'),
    supabase.from('collaboration_invitations').select('id,collaboration_id,invited_by,invitee_id,status,created_at').eq('invitee_id',user.id).eq('status','pending').order('created_at',{ascending:false}).limit(100),
   ]);
   if(request!==generation.current)return;
   if(alertsResult.status==='rejected')throw alertsResult.reason;
   const requests=requestsResult.status==='fulfilled'?requestsResult.value.items||[]:[];
   const invites=invitesResult.status==='fulfilled'&&!invitesResult.value.error?invitesResult.value.data||[]:[];
   const pending=requests.filter(v=>v.recipient_id===user.id&&v.status==='pending');
   setNotifications(alertsResult.value.items||[]);setFriends(pending);setInvitations(invites);
   setRequestsUnavailable(requestsResult.status==='rejected'||invitesResult.status==='rejected'||!!(invitesResult.status==='fulfilled'&&invitesResult.value.error));
   const ids=[...new Set([...pending.map(v=>v.requester_id),...invites.map(v=>v.invited_by)])].slice(0,100);
   if(ids.length){const {data}=await supabase.functions.invoke('directory',{body:{ids}});if(request===generation.current)setNames(Object.fromEntries((data?.results||[]).map(v=>[v.id,v.display_name])));}
  }catch(e){if(request===generation.current)setError(e.message||'Notifications could not be loaded.');}
  finally{if(request===generation.current)setBusy(false);}
 },[user.id]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);
  const focus=()=>void load();window.addEventListener('focus',focus);
  const channel=supabase.channel('notifications-page-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'member_notifications',filter:'recipient_id=eq.'+user.id},focus).subscribe();
  return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',focus);void supabase.removeChannel(channel);};
 },[load,user.id]);
 const respond=async(kind,item,status)=>{
  setSaving(item.id);setError('');setNotice('');
  try{
   await action(kind==='friend'?'respond_connection':'respond_invitation',kind==='friend'?{request_id:item.id,status}:{invitation_id:item.id,status});
   const related=notifications.filter(n=>n.details?.request_id===item.id||n.details?.invitation_id===item.id);
   await Promise.all(related.filter(n=>!n.read_at).map(n=>action('mark_notification_read',{notification_id:n.id})));
   setNotice(status==='accepted'?'Invitation accepted.':'Invitation declined.');
   await load();window.dispatchEvent(new Event('ccx-data-changed'));
  }catch(e){setError(e.message);}finally{setSaving('');}
 };
 const markRead=async(id)=>{setSaving(id);try{await action('mark_notification_read',{notification_id:id});setNotifications(v=>v.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));window.dispatchEvent(new Event('ccx-data-changed'));}catch(e){setError(e.message);}finally{setSaving('');}};
 const markAll=async()=>{setSaving('all');setError('');try{await action('mark_all_notifications_read');await load();window.dispatchEvent(new Event('ccx-data-changed'));}catch(e){setError(e.message);}finally{setSaving('');}};
 return <section className="space-y-6" data-member-page="notifications">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-3 text-2xl font-bold"><Bell/>Notifications</h1><p className="mt-2 text-sm text-[var(--cc-text-secondary)]">Your updates, friend requests and collaboration invitations, together.</p></div>
   <div className="ccx-action-row flex gap-2"><button type="button" className={secondary} disabled={busy} onClick={()=>void load()} aria-label="Refresh notifications"><RefreshCw size={18}/></button><button type="button" className={primary} disabled={!!saving||!notifications.some(n=>!n.read_at)} onClick={markAll}><Check size={16}/>Mark all read</button></div></header>
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm">{error}</p>}
  {notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
  <section className={panel+' space-y-4'} aria-labelledby="notification-invitations"><h2 id="notification-invitations" className="flex items-center gap-2 text-lg font-semibold"><UserPlus size={20}/>Invitations & requests <span className="text-sm text-[var(--cc-link)]">{friends.length+invitations.length}</span></h2>
   {requestsUnavailable&&<p role="status" className="text-sm text-amber-800">Some request lists could not be loaded or are not enabled. Your notifications remain available.</p>}
   {!busy&&!requestsUnavailable&&!friends.length&&!invitations.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No pending invitations or friend requests.</p>}
   {[...friends.map(item=>({kind:'friend',item})),...invitations.map(item=>({kind:'collaboration',item}))].map(({kind,item})=><article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--cc-border)] p-4">
    <div><h3 className="flex items-center gap-2 font-medium">{kind==='friend'?<UserPlus size={17}/>:<Users size={17}/>} {kind==='friend'?'Friend request':'Collaboration invitation'}</h3><p className="mt-1 text-sm text-[var(--cc-text-secondary)]">From {names[item.requester_id||item.invited_by]||'a member'} · {new Date(item.requested_at||item.created_at).toLocaleDateString()}</p></div>
    <div className="ccx-action-row flex gap-2"><button type="button" className={primary} disabled={!!saving} onClick={()=>respond(kind,item,'accepted')}>Accept</button><button type="button" className={secondary} disabled={!!saving} onClick={()=>respond(kind,item,'declined')}>Decline</button></div>
   </article>)}
  </section>
  <section className="space-y-3" aria-labelledby="notification-updates"><h2 id="notification-updates" className="text-lg font-semibold">Latest updates</h2>
   {notifications.map(item=><article key={item.id} className={panel+' flex flex-wrap items-start justify-between gap-3 '+(!item.read_at?'border-l-4 border-l-[#D64BCB]':'')}><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{new Date(item.created_at).toLocaleString()}</p></div>
    <div className="flex gap-3"><button type="button" className="inline-flex items-center gap-1 text-sm text-[var(--cc-link)]" onClick={()=>onNavigate(destination(item),
      item.kind==='meeting_invitation'?{scope:item.details?.scope,scopeId:item.details?.scope_id}
      :item.details?.case_id?{supportCaseId:item.details.case_id}:undefined)}>Open<ArrowUpRight size={14}/></button>{!item.read_at&&<button type="button" className="text-sm underline" disabled={!!saving} onClick={()=>markRead(item.id)}>Mark read</button>}</div></article>)}
   {!busy&&!notifications.length&&<div className={panel+' text-sm text-[var(--cc-text-secondary)]'}>No updates yet. Your activity will appear here.</div>}
  </section>
 </section>;
}
