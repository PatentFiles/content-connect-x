/** Saved per-account dashboard. No fake counters, localStorage authority or cross-role writes. */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Eye,Users,UserPlus,Heart,MessageCircle,Briefcase,Mail,FileText,Building2,ShieldCheck,Camera,CalendarDays,Bell,UserRound,Settings2,RefreshCw,ArrowUp,ArrowDown,X,Plus,Save} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {useRoleWorkspace} from './RoleWorkspaceContext';
import {roleTitle} from './roleWorkspacePolicy.mjs';
import {widgetsForRole,defaultDashboardLayout,normalizeDashboardLayout,moveDashboardWidget,ACCESS_LABELS} from './dashboardCatalog.mjs';
const icons={Eye,Users,UserPlus,Heart,MessageCircle,Briefcase,Mail,FileText,Building2,ShieldCheck,Camera,CalendarDays,Bell,UserRound};
const button='ccx-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50';
const control='w-full rounded-lg border border-[#34445D] bg-[#0F1520] px-3 py-2 text-white';
const format=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat().format(value):typeof value==='string'?value:'—';
export default function CustomizableDashboard({profile,verified=false,paid=false,onNavigate,roleOverride,features}){
 const workspace=useRoleWorkspace();
 const role=roleOverride||workspace.role||profile?.role_type||'creator';
 const actualRole=profile?.role_type||workspace.actualRole||role;
 const preview=workspace.preview||role!==actualRole;
 const userId=workspace.user?.id||profile?.id;
 const [layout,setLayout]=useState(()=>defaultDashboardLayout(role));
 const [draft,setDraft]=useState(()=>defaultDashboardLayout(role));
 const [revision,setRevision]=useState(0);
 const [snapshot,setSnapshot]=useState(null);
 const [editing,setEditing]=useState(false),[loading,setLoading]=useState(!preview),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const sequence=useRef(0),editingRef=useRef(false),savingRef=useRef(false);
 editingRef.current=editing;
 const catalogue=widgetsForRole(role);
 const load=useCallback(async()=>{
  if(preview||!userId||savingRef.current){setLoading(false);return;}
  const current=++sequence.current;
  setLoading(true);setError('');
  try{
   const {data,error:failure}=await supabase.rpc('ccx_dashboard_action',{p_action:'load'});
   if(failure)throw failure;
   if(data?.schema_version!==1||!data.metrics||data.role!==actualRole)throw new Error('Dashboard data does not match this account. Refresh your profile and try again.');
   if(current!==sequence.current)return;
   setSnapshot(data);
   if(!editingRef.current){
    const next=normalizeDashboardLayout(data.layout,role);
    setLayout(next);setDraft(next);setRevision(data.revision||0);
   }
  }catch(e){if(current===sequence.current)setError(e.message||'Dashboard data is unavailable.');}
  finally{if(current===sequence.current)setLoading(false);}
 },[preview,userId,actualRole,role]);
 useEffect(()=>{
  setLayout(defaultDashboardLayout(role));setDraft(defaultDashboardLayout(role));setSnapshot(null);
  setRevision(0);setEditing(false);editingRef.current=false;setError('');setNotice('');
  void load();
  const refresh=()=>{if(document.visibilityState==='visible')void load();};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  const interval=window.setInterval(refresh,60000);
  return()=>{sequence.current++;window.clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[load,role]);
 const startEditing=()=>{setDraft(layout.map(item=>({...item})));setNotice('');setEditing(true);};
 const cancel=()=>{setEditing(false);setDraft(layout.map(item=>({...item})));setNotice('');};
 const toggle=id=>setDraft(previous=>previous.some(item=>item.id===id)?previous.filter(item=>item.id!==id):[...previous,{id,width:'normal'}]);
 const save=async()=>{
  if(preview||savingRef.current)return;
  savingRef.current=true;sequence.current++;setSaving(true);setError('');setNotice('');
  try{
   const next=normalizeDashboardLayout(draft,role);
   const {data,error:failure}=await supabase.rpc('ccx_dashboard_action',{p_action:'save',p_layout:next,p_revision:revision});
   if(failure)throw failure;
   if(!Array.isArray(data?.layout)||!Number.isInteger(data?.revision))throw new Error('The server did not confirm the saved dashboard.');
   setLayout(data.layout);setDraft(data.layout);setRevision(data.revision);setEditing(false);editingRef.current=false;
   setNotice('Dashboard saved to your account. Your selection and order will follow you across devices.');
  }catch(e){setError(e.message||'Could not save the dashboard. Your previous layout is unchanged.');}
  finally{savingRef.current=false;setSaving(false);setLoading(false);}
 };
 const shown=editing?draft:layout;
 const navigate=tab=>onNavigate?.(tab);
 return <section className="space-y-5" aria-label={roleTitle(role)+' configurable dashboard'}>
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><h1 className="text-2xl font-bold">{roleTitle(role)} Dashboard</h1>
    <p className="mt-2 text-sm" style={{color:'var(--cc-text-secondary)'}}>Welcome{profile?.display_name?', '+profile.display_name:''}. Choose the metrics and updates that matter to you.</p></div>
   <div className="flex flex-wrap gap-2">
    <button type="button" className={button} onClick={()=>{void load();}} disabled={loading||saving||preview} aria-label="Refresh dashboard metrics"><RefreshCw size={17} className={loading?'animate-spin':''}/>Refresh</button>
    {!editing&&<button type="button" className={button} onClick={startEditing} disabled={saving||(!preview&&!snapshot)}><Settings2 size={17}/>Customize dashboard</button>}
   </div>
  </header>
  {preview&&<p className="ccx-surface p-4 text-sm text-[#B7C5DA]">{roleTitle(role)} dashboard preview. You can arrange the sample layout, but no private records or invented metrics are shown and changes are not saved to another role.</p>}
  {!preview&&snapshot?.account?.age_verified===false&&<div className="ccx-surface space-y-3 p-4">
   <p className="text-sm text-[#B7C5DA]">Your dashboard layout can be configured now. Protected metrics and workflows require independent age verification. Administrator permissions do not mark your age as verified.</p>
   <button type="button" className={button} onClick={()=>navigate('verification')}><ShieldCheck size={17}/>Complete verification</button>
  </div>}
  {error&&<div role="alert" className="rounded-xl border border-red-500/40 bg-red-950 p-3 text-sm text-red-200">{error}<p className="mt-1">Unavailable data is not reported as zero. Retry after the connection or access issue is resolved.</p></div>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
  {editing&&<section className="ccx-surface space-y-4 p-5" aria-label="Dashboard customization">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Add or remove widgets</h2><button type="button" className={button} disabled={saving} onClick={()=>setDraft(defaultDashboardLayout(role))}>Restore defaults</button></div>
   <p className="text-sm text-[#AABBD4]">Choose your widgets below. Use Move up and Move down on each widget to set its order; choose Wide for a larger card. Changes take effect only when saved.</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{catalogue.map(widget=><label key={widget.id} className="flex items-start gap-3 rounded-xl border border-[#34445D] p-3 text-sm">
    <input type="checkbox" className="mt-1 shrink-0" checked={draft.some(item=>item.id===widget.id)} onChange={()=>toggle(widget.id)} disabled={saving}/>
    <span className="min-w-0"><strong className="block">{widget.title}</strong><span className="mt-1 block text-xs text-[#AABBD4]">{widget.description}</span></span>
   </label>)}</div>
   <div className="flex flex-wrap gap-3"><button type="button" className="ccx-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50" disabled={saving||preview} onClick={save}><Save size={17}/>{saving?'Saving…':'Save dashboard'}</button><button type="button" className={button} onClick={cancel} disabled={saving}>Cancel</button></div>
  </section>}
  {loading&&!snapshot&&!preview&&<p role="status" className="text-sm text-[#AABBD4]">Loading your saved dashboard and platform metrics…</p>}
  {!shown.length&&<section className="ccx-surface space-y-3 p-8 text-center"><h2 className="font-semibold">Your dashboard is empty</h2><p className="text-sm text-[#AABBD4]">Keep it minimal or add the information you use most.</p><button type="button" className={button} onClick={startEditing} disabled={!preview&&!snapshot}><Plus size={17}/>Choose widgets</button></section>}
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((item,index)=>{
   const widget=catalogue.find(entry=>entry.id===item.id);if(!widget)return null;
   const Icon=icons[widget.icon]||UserRound;
   const metric=preview?{status:'preview'}:snapshot?.metrics?.[item.id];
   const ready=metric?.status==='ready';
   const reason=metric?.status||'unavailable';
   return <article key={item.id} className={'ccx-surface flex min-w-0 flex-col gap-4 p-5 '+(item.width==='wide'?'md:col-span-2':'')} data-widget-id={item.id}>
    <div className="flex items-start justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Icon size={20} style={{color:'var(--cc-blue)'}}/>{widget.title}</h2>{editing&&<button type="button" className="ccx-secondary rounded-lg p-2" aria-label={'Remove '+widget.title} onClick={()=>toggle(item.id)} disabled={saving}><X size={16}/></button>}</div>
    {editing&&<div className="flex flex-wrap items-center gap-2">
     <button type="button" className="ccx-secondary rounded-lg p-2 disabled:opacity-40" aria-label={'Move '+widget.title+' up'} disabled={saving||index===0} onClick={()=>setDraft(value=>moveDashboardWidget(value,item.id,-1))}><ArrowUp size={17}/></button>
     <button type="button" className="ccx-secondary rounded-lg p-2 disabled:opacity-40" aria-label={'Move '+widget.title+' down'} disabled={saving||index===shown.length-1} onClick={()=>setDraft(value=>moveDashboardWidget(value,item.id,1))}><ArrowDown size={17}/></button>
     <label className="ml-auto flex items-center gap-2 text-xs">Width<select className={control} value={item.width} disabled={saving} onChange={event=>setDraft(value=>value.map(row=>row.id===item.id?{...row,width:event.target.value}:row))}><option value="normal">Normal</option><option value="wide">Wide</option></select></label>
    </div>}
    <p className="text-3xl font-semibold" aria-label={widget.title+': '+(ready?format(metric.value):'Not available')}>{ready?format(metric.value):'—'}</p>
    <p className="text-sm text-[#AABBD4]">{ready?(metric.subtitle||widget.description):(loading&&!snapshot&&!preview?'Loading…':ACCESS_LABELS[reason]||ACCESS_LABELS.unavailable)}</p>
    {ready&&Array.isArray(metric.items)&&metric.items.length>0&&<div className="space-y-2 border-t border-[#34445D] pt-3">{metric.items.map((entry,i)=><div className="flex flex-wrap justify-between gap-2 text-sm" key={entry.id||i}><span className="min-w-0 break-words">{entry.title}</span>{entry.at&&<time className="text-xs text-[#AABBD4]" dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>}</div>)}</div>}
    <button type="button" className="mt-auto self-start text-sm font-semibold text-[#FF8DD9] underline underline-offset-4" onClick={()=>navigate(reason==='verification_required'?'verification':reason==='membership_required'?'membership':widget.tab)}>{reason==='verification_required'?'Complete verification':reason==='membership_required'?'View membership':'Open '+widget.title.toLowerCase()}</button>
   </article>;
  })}</div>
  {snapshot?.checked_at&&<p className="text-xs text-[#9AA6BC]">Metrics checked {new Date(snapshot.checked_at).toLocaleString()}{loading?' · Refreshing…':''}. Only records you are authorized to access are included.</p>}
 </section>;
}
