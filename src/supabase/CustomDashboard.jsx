/** Per-account dashboard. A fresh account starts empty; saved choices stay intact. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,ArrowRight,Plus,RefreshCw,Settings2,Trash2,Save,X} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import {roleTitle,dashboardGreetingName} from './roleWorkspacePolicy.mjs';
import {widgetsForRole,defaultDashboardLayout,normalizeDashboardLayout,moveDashboardWidget} from './dashboardWidgets.mjs';
import {accessCopy} from './moduleAccessPolicy.mjs';
import DashboardPeople from './DashboardPeople';
import DashboardProperties from './DashboardProperties';
import SponsorshipSlot from './SponsorshipSlot';
import ConnectFeed from './ConnectFeed';
const secondary='ccx-secondary inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50';
const primary='ccx-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const displayNumber=value=>typeof value==='number'?new Intl.NumberFormat().format(value):String(value??'—');
function Metric({widget,metric,onNavigate}){
 if(!metric)return <p className="text-sm" role="status">Loading metric…</p>;
 if(metric.status!=='ready'){
  const copy=accessCopy(metric.status);
  return <div className="space-y-2"><p className="text-sm font-medium">{copy.title}</p><p className="text-xs leading-5" style={{color:'var(--cc-text-secondary)'}}>{copy.description}</p>{copy.tab&&<button type="button" onClick={()=>onNavigate(copy.tab)} className="text-xs text-[var(--cc-link)] underline">{copy.action}</button>}</div>;
 }
 return <><p className="text-3xl font-bold tabular-nums">{displayNumber(metric.value)}</p><p className="mt-2 text-xs leading-5" style={{color:'var(--cc-text-secondary)'}}>{metric.subtitle}</p>
  {Array.isArray(metric.items)&&<div className="mt-3 space-y-2">{metric.items.length===0?null:metric.items.map(item=><div key={item.id} className="border-t pt-2" style={{borderColor:'var(--cc-border)'}}><p className="text-sm break-words">{item.title}</p><time className="text-xs" style={{color:'var(--cc-text-muted)'}} dateTime={item.at}>{new Date(item.at).toLocaleString()}</time></div>)}</div>}
  <button type="button" onClick={()=>onNavigate(widget.tab)} className="mt-4 inline-flex items-center gap-1 text-xs text-[var(--cc-link)]">Open {widget.title.toLowerCase()}<ArrowRight size={13}/></button></>;
}
export default function CustomDashboard({profile,onNavigate,roleOverride,paid=false}){
 const workspace=useRoleWorkspace();
 const role=roleOverride||workspace?.role||profile?.role_type||'creator';
 const preview=Boolean(workspace?.preview||role!==profile?.role_type);
 const userId=workspace?.user?.id||profile?.id;
 const catalog=widgetsForRole(role);
 const [layout,setLayout]=useState(()=>defaultDashboardLayout(role));
 const [draft,setDraft]=useState([]),[revision,setRevision]=useState(0),[data,setData]=useState(null);
 const [editing,setEditing]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async()=>{
  if(!userId){setLoading(false);return;}
  const request=++sequence.current;setLoading(true);setError('');
  try{
   const {data:result,error:loadError}=await supabase.rpc('ccx_dashboard_action',{p_action:'load'});
   if(loadError)throw loadError;
   if(result?.schema_version!==1||result.role!==profile?.role_type)throw Error('Dashboard account changed. Refresh the page before continuing.');
   if(request!==sequence.current)return;
   setLayout(preview?defaultDashboardLayout(role):normalizeDashboardLayout(result.layout,role));setRevision(result.revision);setData(result);
  }catch(e){if(request===sequence.current)setError(e.message||'Unable to load your dashboard.');}
  finally{if(request===sequence.current)setLoading(false);}
 },[userId,role,preview,profile?.role_type]);
 useEffect(()=>{
  setEditing(false);setData(null);setError('');setNotice('');setLayout(defaultDashboardLayout(role));
  void load();return()=>{sequence.current++;};
 },[load,role]);
 useEffect(()=>{
  const refresh=()=>{if(!editing&&!saving&&document.visibilityState==='visible')void load();};
  window.addEventListener('focus',refresh);window.addEventListener('ccx-data-changed',refresh);
  const interval=window.setInterval(refresh,30000);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('ccx-data-changed',refresh);window.clearInterval(interval);};
 },[load,editing,saving]);
 const defaultStrip=[{id:'connections',width:'normal'},{id:'unread_messages',width:'normal'},{id:'upcoming',width:'normal'}];
 const suggested=data?.revision===0&&layout.length===0?defaultStrip:layout;
 const customize=()=>{sequence.current++;setLoading(false);setDraft(suggested.slice(0,4).map(w=>({...w})));setEditing(true);setError('');setNotice('');};
 const save=async()=>{
  if(preview||!data||saving)return;
  if(draft.length>4){setError('The dashboard banner holds up to four widgets.');return;}
  setSaving(true);setError('');
  try{
   const {data:result,error:saveError}=await supabase.rpc('ccx_dashboard_action',{p_action:'save',p_layout:draft,p_revision:revision});
   if(saveError)throw saveError;
   setLayout(normalizeDashboardLayout(result.layout,role));setRevision(result.revision);setEditing(false);setNotice('Dashboard saved to your account.');
  }catch(e){setError(e.message||'Could not save. Your edits are still available.');}
  finally{setSaving(false);}
 };
 const shown=editing?draft:suggested.slice(0,4);
 return <section className="ccx-personal-dashboard" data-dashboard-feed-layout="desktop-rail-mobile-feed">
 <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
  <main className="min-w-0" aria-label="Feed">
   <header className="ccx-dashboard-welcome mb-4" aria-label="Welcome to your dashboard">
    <div className="flex items-center gap-4">
     <button type="button" aria-label="Open my profile" onClick={()=>onNavigate('profile')}
      className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface-hover)] text-xl font-bold">
      {profile?.avatar_path&&/^https:\/\//.test(profile.avatar_path)?<img src={profile.avatar_path} alt="" className="h-full w-full object-cover"/>:dashboardGreetingName(profile).slice(0,1).toUpperCase()}
     </button>
     <div className="min-w-0">
      <p className="ccx-dashboard-welcome-kicker">YOUR WORKSPACE</p>
      <h1 className="ccx-dashboard-welcome-title">Welcome back, {dashboardGreetingName(profile)}</h1>
      <p className="ccx-dashboard-welcome-subtitle">{roleTitle(role)} workspace · Share an update and stay connected with your community.</p>
     </div>
    </div>
   </header>
   {preview&&<p className="mb-3 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3 text-sm text-[var(--cc-text-secondary)]">
    Viewing the {roleTitle(role)} dashboard layout. Updates are published from your own signed-in account, not as another role.
   </p>}
   <ConnectFeed userId={userId} paid={paid} preview={preview} initialMode="discover" onNavigate={onNavigate}/>
  </main>
  <aside className="hidden min-w-0 space-y-4 xl:block" aria-label="Customizable dashboard cards and sponsored advertisements">
  <header className="ccx-dashboard-heading space-y-3"><div><p className="ccx-workspace-eyebrow">YOUR WORKSPACE</p><h1 className="text-2xl font-bold">{roleTitle(role)} Dashboard</h1><p className="mt-2 text-sm" style={{color:'var(--cc-text-secondary)'}}>Your optional dashboard tools and account overview.</p></div>
   <div className="flex flex-wrap gap-2">{editing?<><button type="button" className={primary} onClick={save} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save dashboard'}</button><button type="button" className={secondary} disabled={saving} onClick={()=>{setEditing(false);setError('');void load();}}><X size={16}/>Cancel</button></>:<><button type="button" className={secondary} onClick={()=>void load()} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={16}/></button><button type="button" className={primary} onClick={customize} disabled={preview||loading||!data}><Settings2 size={16}/>Customize Dashboard</button></>}</div>
  </header>
  {preview&&<p className="ccx-surface p-4 text-sm">This is a role preview, not another member’s dashboard. Return to My dashboard to customize your own layout.</p>}
  {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{!editing&&<button type="button" className="mt-2 underline" onClick={()=>void load()}>Retry dashboard</button>}</div>}
  {notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
  {editing&&<section aria-label="Add dashboard widgets" className="ccx-surface space-y-3 rounded-xl p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Choose up to four widgets</h2><button type="button" className="text-xs underline" onClick={()=>setDraft([])} disabled={saving}>Clear dashboard</button></div><p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>Choose up to four cards for this desktop sidebar. Your feed remains the main dashboard and is always available on mobile.</p><div className="ccx-widget-catalog">{catalog.map(w=>{
   const added=draft.some(item=>item.id===w.id);
   return <button type="button" key={w.id} className="ccx-catalog-option" disabled={saving||added||draft.length>=4} aria-label={(added?'Added ':'Add ')+w.title} onClick={()=>setDraft(v=>v.length>=4?v:[...v,{id:w.id,width:'normal'}])}><span className="flex items-center gap-2"><Plus size={15}/><strong>{w.title}</strong></span><span>{w.description}</span><small>{added?'Added to your dashboard':'Add module'}</small></button>;
  })}</div></section>}
  {loading&&!data&&<p role="status" className="ccx-widget-note">Loading your saved dashboard…</p>}
  {!loading&&!error&&shown.length===0&&<p className="text-sm text-[var(--cc-text-secondary)]">Add up to four optional desktop cards using Customize.</p>}
  <section className="ccx-widget-rail flex flex-col gap-3" aria-label="Customizable dashboard widget strip">{shown.map((item,index)=>{
   const widget=catalog.find(w=>w.id===item.id);if(!widget)return null;
   return <article key={item.id} aria-label={widget.title} className="ccx-surface ccx-dashboard-card min-w-0 rounded-xl p-4">
    <h2 className="mb-3 text-sm font-semibold">{widget.title}</h2>
    {editing&&<div className="mb-4 flex flex-wrap items-center gap-2"><button className={secondary} type="button" disabled={saving||index===0} aria-label={'Move '+widget.title+' earlier'} onClick={()=>setDraft(v=>moveDashboardWidget(v,item.id,-1))}><ArrowUp size={15}/></button><button className={secondary} type="button" disabled={saving||index===shown.length-1} aria-label={'Move '+widget.title+' later'} onClick={()=>setDraft(v=>moveDashboardWidget(v,item.id,1))}><ArrowDown size={15}/></button><button type="button" className={secondary} disabled={saving} aria-label={'Remove '+widget.title} onClick={()=>setDraft(v=>v.filter(w=>w.id!==item.id))}><Trash2 size={15}/></button></div>}
    {widget.kind==='properties'?<DashboardProperties onNavigate={onNavigate}/>:widget.kind==='people'?<DashboardPeople widget={widget} profile={profile} onNavigate={onNavigate}/>:<Metric widget={widget} metric={data?.metrics?.[item.id]} onNavigate={onNavigate}/>}
   </article>;
  })}</section>
   <section aria-label="Sponsored advertisements" className="space-y-3">
    <h2 className="text-sm font-semibold">Sponsored</h2>
    <SponsorshipSlot placement="sidebar"/>
   </section>
  </aside>
 </div>

 </section>;
}
