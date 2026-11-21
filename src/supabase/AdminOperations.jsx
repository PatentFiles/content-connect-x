/** Read-only operational scorecard, never a replacement for staff review.
 * Server returns aggregate counts only, with MFA-enforced admin access.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {Activity,RefreshCw,ShieldAlert,ShieldCheck,Mail,Video,FileSignature,TestTube,ShoppingBag,Bot,Plug} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const action='ccx-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50';
const groups=[
 {key:'safety',title:'Safety and reports',icon:ShieldAlert,route:'support-inbox',metric:s=>s?.safety?.overdue||0,
  summary:s=>`${s?.safety?.unresolved??0} unresolved cases; ${s?.safety?.overdue??0} overdue`,priority:'critical'},
 {key:'identity',title:'Identity verification',icon:ShieldCheck,route:'identity',metric:s=>s?.identity?.enabled?'Enabled':'Not live',
  summary:s=>s?.identity?.enabled?'Production gate active':'Production remains blocked until privacy, security and retention are approved',priority:'critical'},
 {key:'notifications',title:'Notifications',icon:Mail,route:'integrations',
  metric:s=>s?.notifications?.email?.failed??0,
  summary:s=>`${s?.notifications?.email?.pending??0} pending, ${s?.notifications?.email?.sent??0} provider accepted, ${s?.notifications?.failed_host_outbox??0} failed host alerts`},
 {key:'recordings',title:'Meeting transcripts',icon:Video,route:'video-provider',metric:s=>s?.recordings?.pending_transcripts??0,
  summary:s=>`${s?.recordings?.failed_transcripts??0} failed, ${s?.recordings?.pending_transcripts??0} pending transcription`},
 {key:'contracts',title:'Pending signatures',icon:FileSignature,route:'integrations',
  metric:s=>s?.contracts?.open_envelopes??0,
  summary:s=>'Provider signatures and signed copies must be reconciled before completion'},
 {key:'testing',title:'Professional testing',icon:TestTube,route:'testing',metric:s=>s?.testing?.pending_credentials??0,
  summary:s=>'Credential review queue; private medical files are not included in this summary'},
 {key:'ai',title:'AI safety agent',icon:Bot,route:'ai-safety',
  metric:s=>s?.ai?.latest_run?.status||'No run',
  summary:s=>s?.ai?.latest_run?'Latest scan '+new Date(s.ai.latest_run.started_at).toLocaleString():'No completed scan observed'},
 {key:'commerce',title:'Affiliate partners',icon:ShoppingBag,route:'integrations',
  metric:s=>s?.commerce?.tracked_partners??0,
  summary:s=>`${s?.commerce?.tracked_partners??0} of ${s?.commerce?.total_partners??0} partners have approved tracked links`},
 {key:'integrations',title:'Providers',icon:Plug,route:'integrations',
  metric:s=>Object.values(s?.integrations||{}).filter(x=>x?.enabled).length,
  summary:s=>`${Object.entries(s?.integrations||{}).filter(([,x])=>x.enabled).map(([name])=>name).join(', ')||'No optional providers enabled'}`}
];
export default function AdminOperations({onSelect=(target)=>{void target;}}){
 const [snapshot,setSnapshot]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('ccx-operations',{body:{action:'summary'}});
   if(failure||data?.error)throw Error(data?.error||'Operations data unavailable. Sign in with a two-factor-authenticated administrator session.');
   setSnapshot(data);
  }catch(e){setError(e.message||'Unable to load operations');}finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  void refresh();
  const tick=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},90000);
  const focus=()=>void refresh();window.addEventListener('focus',focus);
  return()=>{clearInterval(tick);window.removeEventListener('focus',focus);};
 },[refresh]);
 return <section className="space-y-5" data-admin-operations="true">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Activity size={20}/>Operational readiness</h2>
    <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Aggregate infrastructure and safety signals. No member case details are included.</p></div>
   <button type="button" className={action} disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15} className="mr-1 inline"/>{loading?'Refreshing…':'Refresh status'}</button>
  </header>
  {error&&<p role="alert" className="rounded-xl border border-red-300 p-4 text-sm text-red-800">{error}</p>}
  {snapshot&&<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {groups.map(item=>{const Icon=item.icon;return <article key={item.key} className="ccx-surface space-y-3 rounded-xl p-4">
     <div className="flex items-center gap-2"><Icon size={17} aria-hidden="true"/><h3 className="text-sm font-semibold">{item.title}</h3></div>
     <p className="text-2xl font-semibold tabular-nums">{item.metric(snapshot)}</p>
     <p className="min-h-[2.5rem] text-xs text-[var(--cc-text-secondary)]">{item.summary(snapshot)}</p>
     <button type="button" className={action} onClick={()=>onSelect(item.route)}>Open {item.title.toLowerCase()}</button>
    </article>})}
   </div>
   {snapshot.warnings?.length>0&&<section className="ccx-surface space-y-2 rounded-xl p-4" aria-label="Launch blockers">
    <h3 className="font-semibold">Outstanding launch controls</h3>
    <ul className="list-disc space-y-1 pl-5 text-sm">{snapshot.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
   </section>}
   <p className="text-xs text-[var(--cc-text-secondary)]">Last checked: {new Date(snapshot.checked_at).toLocaleString()}. Provider accepted means the external provider acknowledged a request, not guaranteed delivery or final approval. Manual release acceptance is still required.</p>
  </>}
 </section>;
}
