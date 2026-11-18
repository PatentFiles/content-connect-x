/** Per-account dashboard backed by owner-scoped Supabase metrics and revisioned layouts. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,ArrowRight,Plus,RefreshCw,Settings2,Trash2,Save,X} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import {roleTitle} from './roleWorkspacePolicy.mjs';
import {widgetsForRole,defaultDashboardLayout,normalizeDashboardLayout,moveDashboardWidget} from './dashboardWidgets.mjs';
import {accessCopy} from './moduleAccessPolicy.mjs';
const secondary='ccx-secondary inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50';
const primary='ccx-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const displayNumber=value=>typeof value==='number'?new Intl.NumberFormat().format(value):String(value??'—');
function Metric({widget,metric,onNavigate}){
 // Role previews use the signed-in member's real common metrics, never another user's data.
 if(!metric)return <p className="text-sm" role="status">Loading metric…</p>;
 if(metric.status!=='ready'){
  const copy=accessCopy(metric.status);
  return <div className="space-y-2"><p className="text-sm font-medium">{copy.title}</p><p className="text-xs leading-5" style={{color:'var(--cc-text-secondary)'}}>{copy.description}</p>{copy.tab&&<button type="button" onClick={()=>onNavigate(copy.tab)} className="text-xs text-[var(--cc-link)] underline">{copy.action}</button>}</div>;
 }
 return <><p className="text-3xl font-bold tabular-nums">{displayNumber(metric.value)}</p><p className="mt-2 text-xs leading-5" style={{color:'var(--cc-text-secondary)'}}>{metric.subtitle}</p>
  {Array.isArray(metric.items)&&<div className="mt-3 space-y-2">{metric.items.length===0?<p className="text-xs" style={{color:'var(--cc-text-muted)'}}>No entries yet.</p>:metric.items.map(item=><div key={item.id} className="border-t pt-2" style={{borderColor:'var(--cc-border)'}}><p className="text-sm break-words">{item.title}</p><time className="text-xs" style={{color:'var(--cc-text-muted)'}} dateTime={item.at}>{new Date(item.at).toLocaleString()}</time></div>)}</div>}
  <button type="button" onClick={()=>onNavigate(widget.tab)} className="mt-4 inline-flex items-center gap-1 text-xs text-[var(--cc-link)]">Open {widget.title.toLowerCase()}<ArrowRight size={13}/></button></>;
}
export default function CustomDashboard({profile,onNavigate,roleOverride}){
 const workspace=useRoleWorkspace();
 const role=roleOverride||workspace?.role||profile?.role_type||'creator';
 const preview=Boolean(workspace?.preview||role!==profile?.role_type);
 const userId=workspace?.user?.id||profile?.id;
 const catalog=widgetsForRole(role);
 const [layout,setLayout]=useState(()=>defaultDashboardLayout(role));
 const [draft,setDraft]=useState([]),[revision,setRevision]=useState(0),[data,setData]=useState(null);
 const [editing,setEditing]=useState(false),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async()=>{
  if(!userId)return;
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
  window.addEventListener('focus',refresh);
  window.addEventListener('ccx-data-changed',refresh);
  const interval=window.setInterval(refresh,30000);
  return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('ccx-data-changed',refresh);window.clearInterval(interval);};
 },[load,editing,saving]);
 const customize=()=>{setDraft(layout.map(w=>({...w})));setEditing(true);setError('');setNotice('');};
 const save=async()=>{
  if(preview||!data)return;
  setSaving(true);setError('');
  try{
   const {data:result,error:saveError}=await supabase.rpc('ccx_dashboard_action',{p_action:'save',p_layout:draft,p_revision:revision});
   if(saveError)throw saveError;
   setLayout(normalizeDashboardLayout(result.layout,role));setRevision(result.revision);setEditing(false);setNotice('Dashboard saved to your account.');
  }catch(e){setError(e.message||'Could not save. Your edits are still available.');}
  finally{setSaving(false);}
 };
 const shown=editing?draft:layout;
 return <section className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{roleTitle(role)} Dashboard</h1><p className="mt-2 text-sm" style={{color:'var(--cc-text-secondary)'}}>Welcome{profile?.display_name?', '+profile.display_name:''}. Your metrics, your layout.</p></div>
   <div className="flex flex-wrap gap-2">{editing?<><button type="button" className={primary} onClick={save} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save dashboard'}</button><button type="button" className={secondary} disabled={saving} onClick={()=>{setEditing(false);setError('');void load();}}><X size={16}/>Cancel</button></>:<><button type="button" className={secondary} onClick={()=>void load()} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={16}/></button><button type="button" className={primary} onClick={customize} disabled={preview||loading||!data}><Settings2 size={16}/>Customize dashboard</button></>}</div>
  </header>
  {preview&&<p className="rounded-xl border p-4 text-sm" style={{borderColor:'var(--cc-border)',color:'var(--cc-text-secondary)'}}>You are viewing the {roleTitle(role)} layout with live metrics from your signed-in account. Role-specific tools keep their permissions. Return to My dashboard to save a layout.</p>}
  {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{!editing&&<button type="button" className="mt-2 underline" onClick={()=>void load()}>Retry dashboard</button>}</div>}
  {notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
  {editing&&<section aria-label="Add dashboard widgets" className="ccx-surface space-y-3 p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Add widgets</h2><button type="button" className="text-xs underline" onClick={()=>setDraft(defaultDashboardLayout(role))} disabled={saving}>Reset to role defaults</button></div><p className="text-xs" style={{color:'var(--cc-text-secondary)'}}>Add or remove metrics, change their order, and choose a normal or wide card. Save to keep this layout on your other devices.</p><div className="flex flex-wrap gap-2">{catalog.filter(w=>!draft.some(item=>item.id===w.id)).map(w=><button type="button" key={w.id} className={secondary} disabled={saving} title={w.description} onClick={()=>setDraft(v=>[...v,{id:w.id,width:'normal'}])}><Plus size={14}/>{w.title}</button>)}</div></section>}
  {shown.length===0&&<div className="ccx-surface p-6 text-sm">Your dashboard is empty. Use Customize dashboard to add the metrics you want.</div>}
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{shown.map((item,index)=>{
   const widget=catalog.find(w=>w.id===item.id);if(!widget)return null;
   return <article key={item.id} aria-label={widget.title} className={'ccx-surface min-w-0 p-5 '+(item.width==='wide'?'sm:col-span-2':'')}>
    <h2 className="mb-3 text-sm font-semibold" style={{color:'var(--cc-text-secondary)'}}>{widget.title}</h2>
    {editing&&<div className="mb-4 flex flex-wrap items-center gap-2"><button className={secondary} type="button" disabled={saving||index===0} aria-label={'Move '+widget.title+' earlier'} onClick={()=>setDraft(v=>moveDashboardWidget(v,item.id,-1))}><ArrowUp size={15}/></button><button className={secondary} type="button" disabled={saving||index===shown.length-1} aria-label={'Move '+widget.title+' later'} onClick={()=>setDraft(v=>moveDashboardWidget(v,item.id,1))}><ArrowDown size={15}/></button><label className="text-xs">Width<select className="ml-2 rounded-lg border bg-transparent p-2" style={{borderColor:'var(--cc-border)'}} value={item.width} disabled={saving} onChange={e=>setDraft(v=>v.map(w=>w.id===item.id?{...w,width:e.target.value}:w))}><option value="normal">Normal</option><option value="wide">Wide</option></select></label><button type="button" className={secondary} disabled={saving} aria-label={'Remove '+widget.title} onClick={()=>setDraft(v=>v.filter(w=>w.id!==item.id))}><Trash2 size={15}/></button></div>}
    <Metric widget={widget} metric={data?.metrics?.[item.id]} onNavigate={onNavigate}/>
   </article>;
  })}</div>
  {data?.checked_at&&<p className="text-xs" style={{color:'var(--cc-text-muted)'}}>Updated {new Date(data.checked_at).toLocaleString()}. Metrics are from your account; unknown or restricted values are not shown as zero.</p>}
 </section>;
}
