/** Administrator-only diagnostics using existing MFA-protected aggregate endpoints.
 * Deliberately excludes personal records, medical data, credentials and raw logs.
 * Diagnostics are read-only: no unsafe automatic database repairs.
 */
import React,{useCallback,useEffect,useState} from 'react';
import {Activity,Download,RefreshCw,ExternalLink,ShieldAlert} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';

const quality='https://github.com/PatentFiles/content-connect-x/actions/workflows/frontend-quality.yml';
const security='https://github.com/PatentFiles/content-connect-x/actions/workflows/enterprise-security.yml';
const panel='ccx-surface rounded-2xl border border-[var(--cc-border)] p-5';
const button='ccx-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm disabled:opacity-50';

function reducedReport(ops,health){
 const services=Object.entries(health?.services||{}).map(([name,s])=>({name,configured:s?.configured===true,missing_count:s?.missing?.length||0}));
 return {version:1,platform:'Content Connect X',checked_at:new Date().toISOString(),
  operations:{safety:ops?.safety,notifications:ops?.notifications,recordings:ops?.recordings,
   contracts:ops?.contracts,testing:ops?.testing,ai:{latest_run_status:ops?.ai?.latest_run?.status||null},
   warnings:ops?.warnings||[]},
  integration_summary:{configured:services.filter(s=>s.configured).length,total:services.length,services},
  evidence:{quality_workflow:quality,security_workflow:security},
  note:'Aggregates only; no provider secrets, user messages, identity documents or raw error payloads.'};
}
export default function EnterpriseDiagnostics(){
 const [ops,setOps]=useState(null),[health,setHealth]=useState(null);
 const [loading,setLoading]=useState(false),[errors,setErrors]=useState([]);
 const scan=useCallback(async()=>{
  setLoading(true);setErrors([]);
  const results=await Promise.allSettled([
   supabase.functions.invoke('ccx-operations',{body:{action:'summary'}}),
   supabase.functions.invoke('integration-health',{body:{}})
  ]);
  const failures=[];
  for(let i=0;i<results.length;i++){
   const result=results[i];
   if(result.status==='rejected'||result.value?.error||result.value?.data?.error){
    failures.push((i===0?'Operational summary':'Integration health')+' could not be loaded. Check your administrator session and service status.');
   }else if(i===0)setOps(result.value.data);else setHealth(result.value.data);
  }
  setErrors(failures);setLoading(false);
 },[]);
 useEffect(()=>{void scan();},[scan]);
 const download=()=>{
  const report=reducedReport(ops,health);
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  link.href=url;link.download='content-connect-x-diagnostics.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const summary=[
  ['Unresolved safety cases',ops?.safety?.unresolved],
  ['Overdue safety cases',ops?.safety?.overdue],
  ['Pending notification deliveries',ops?.notifications?.email?.pending],
  ['Failed notification deliveries',ops?.notifications?.email?.failed],
  ['Failed meeting transcripts',ops?.recordings?.failed_transcripts],
  ['Pending contract signatures',ops?.contracts?.open_envelopes]
 ];
 return <section className="space-y-4" data-enterprise-diagnostics="content">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Activity size={20}/>Enterprise diagnostics</h2>
    <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Live operational aggregates and release-check links. No simulated passes or self-awarded security certifications.</p></div>
   <div className="flex flex-wrap gap-2">
    <button className={button} disabled={loading} onClick={()=>void scan()}><RefreshCw size={16}/>{loading?'Scanning…':'Run checks'}</button>
    <button className={button} disabled={!ops&&!health} onClick={download}><Download size={16}/>Export report</button>
   </div>
  </header>
  {errors.map(e=><p role="alert" key={e} className="rounded-xl border border-red-300 p-3 text-sm text-red-800">{e}</p>)}
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   {summary.map(([label,count])=><article key={label} className={panel}>
    <p className="text-xs text-[var(--cc-text-secondary)]">{label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{typeof count==='number'?count:'Unavailable'}</p>
   </article>)}
  </div>
  <div className={panel+' space-y-3'}>
   <h3 className="font-semibold">Provider readiness</h3>
   {!health?<p className="text-sm text-[var(--cc-text-secondary)]">Provider data not loaded.</p>:
    Object.entries(health.services||{}).map(([name,s])=><p key={name} className="flex items-center justify-between gap-3 border-t border-[var(--cc-border)] py-2 text-sm">
     <span className="capitalize">{name.replaceAll('_',' ')}</span><span>{s.configured?'Configured, not acceptance-tested':'Needs configuration'}</span>
    </p>)}
  </div>
  <div className={panel+' space-y-3'}>
   <h3 className="flex items-center gap-2 font-semibold"><ShieldAlert size={18}/>Automated security and test evidence</h3>
   <p className="text-sm text-[var(--cc-text-secondary)]">GitHub Actions retains full test output and downloadable scanner reports. These links show authoritative execution state; they are not cached or fabricated in the app.</p>
   <div className="flex flex-wrap gap-3">
    <a className={button} href={quality} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>UI, browser and release tests</a>
    <a className={button} href={security} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>OWASP, secrets and dependency scans</a>
   </div>
   <p className="text-xs text-[var(--cc-text-secondary)]">Automatic repairs for identity, contracts, payouts or permissions are disabled by design. Diagnose errors here and apply reviewed, tested fixes through controlled deployments.</p>
  </div>
 </section>;
}
