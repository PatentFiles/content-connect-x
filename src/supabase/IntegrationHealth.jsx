/** Administrative release console. Credentials are deliberately never returned. */
import React,{useCallback,useEffect,useState} from 'react';
import {Activity,RefreshCw,AlertTriangle,CheckCircle2,ShieldAlert} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import IntegrationSettings from './IntegrationSettings';
const panel='ccx-surface p-5';
const readable=label=>label.replaceAll('_',' ');
export default function IntegrationHealth(){
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{
      const {data:result,error:invokeError}=await supabase.functions.invoke('integration-health',{body:{}});
      if(invokeError||result?.error)throw new Error(result?.error||invokeError?.message||'Unavailable');
      setData(result);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const configured=Object.values(data?.services||{}).filter(service=>service.configured).length;
  const total=Object.keys(data?.services||{}).length;
  return <div className="space-y-4">
    <header className="flex flex-wrap justify-between items-center gap-3">
      <div><h2 className="text-2xl font-semibold flex items-center gap-2"><Activity size={22}/> Integration and release health</h2>
        <p className="mt-2 text-[var(--cc-text-secondary)] text-sm">Real backend configuration, not a simulated green dashboard. No secret values are displayed.</p>
      </div>
      <button className="rounded-lg ccx-action-primary text-[var(--cc-text-primary)] px-3 py-2 text-sm" onClick={load} disabled={busy}
        aria-label="Refresh integration diagnostics"><RefreshCw size={17} className={busy?'animate-spin':''}/></button>
    </header>
    {error&&<p role="alert" className="rounded-lg bg-red-50 text-red-800 p-3 text-sm">{error}</p>}
    {data&&<>
      <section className={panel+' space-y-2'} role="status">
        <h3 className="flex items-center gap-2 font-semibold text-amber-800"><ShieldAlert size={19}/> Production release is not yet approved</h3>
        <p className="text-sm text-[var(--cc-text-secondary)]">{configured} of {total} integration configurations are present. Even a configured integration still needs real sandbox acceptance and authorization tests.</p>
        <p className="text-xs text-[var(--cc-link)]">Last checked: {new Date(data.checked_at).toLocaleString()}</p>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(data.services||{}).map(([name,service])=><article className={panel+' space-y-2'} key={name}>
          <div className="flex flex-wrap justify-between gap-2 items-center">
            <h3 className="font-semibold capitalize">{readable(name)}</h3>
            <span className={'text-xs rounded-full px-2 py-1 flex items-center gap-1 '+
              (service.configured?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800')}>
              {service.configured?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>}
              {service.configured?'Configured — not tested':'Configuration incomplete'}
            </span>
          </div>
          <p className="text-sm text-[var(--cc-text-secondary)]">{service.note}</p>
          {!!service.missing?.length&&<div className="text-xs text-[var(--cc-text-secondary)]">
            <strong>Missing setup:</strong>
            <ul className="mt-1 space-y-1 list-disc pl-5">{service.missing.map(item=><li key={item} className="break-words">{readable(item)}</li>)}</ul>
          </div>}
        </article>)}
      </div>
      <div className={panel}>
        <h3 className="font-semibold mb-2">Live database indicators</h3>
        {Object.entries(data.database||{}).map(([key,value])=><div key={key}
          className="flex justify-between gap-3 border-b border-[var(--cc-border)] py-2 text-sm">
          <span className="capitalize">{readable(key)}</span><strong>{value===null?'Unavailable':String(value)}</strong>
        </div>)}
        <p className="mt-3 text-xs text-[var(--cc-text-secondary)]">Counts are operational indicators. They do not establish verified participants or complete release tests.</p>
      </div>
      <div className={panel+' space-y-3'}>
        <h3 className="font-semibold">Mandatory acceptance evidence</h3>
        {(data.release_tests||[]).map(check=><div className="flex items-start gap-2 text-sm" key={check.name}>
          <AlertTriangle className="text-amber-800 mt-0.5 shrink-0" size={16}/>
          <div><strong>{check.name}</strong><p className="text-[var(--cc-text-secondary)] text-xs">Not yet independently verified</p></div>
        </div>)}
        <p className="text-xs text-[var(--cc-text-secondary)]">See ops/AT_HOME_TEST_MATRIX.md and ops/ENTERPRISE_RELEASE_RUNBOOK.md in GitHub for the exact test order and signoff requirements.</p>
      </div>
      <div className={panel}>
        <h3 className="font-semibold">Client-side integration configuration</h3>
        {Object.entries(data.client_side_services||{}).map(([name,value])=><p className="text-sm text-[var(--cc-text-secondary)] mt-2" key={name}>
          <strong className="capitalize text-[var(--cc-text-primary)]">{readable(name)}:</strong> {value}
        </p>)}
      </div>
      <p className="text-sm text-[var(--cc-text-secondary)]">{data.note}</p>
    </>}
    <div className="mt-8 border-t border-[var(--cc-border)] pt-6"><IntegrationSettings/></div>
  </div>;
}
