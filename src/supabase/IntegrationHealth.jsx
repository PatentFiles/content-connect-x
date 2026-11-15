import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';

const panel='rounded-xl border border-[#263248] bg-[#151D2B] p-5';
export default function IntegrationHealth(){
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    setBusy(true);setError('');
    try{
      const {data:result,error:invokeError}=await supabase.functions.invoke('integration-health',{body:{}});
      if(invokeError||result?.error)throw new Error(result?.error||invokeError?.message||'Unavailable');
      setData(result);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  return <div className="space-y-4">
    <div className="flex justify-between items-center gap-2"><div><h2 className="text-2xl font-semibold flex gap-2 items-center"><Activity size={22}/> Integration health</h2><p className="text-[#9AA6BC] text-sm mt-2">Credentials and service readiness, without exposing secrets. Configured does not mean tested.</p></div><button className="rounded-lg bg-[#4F8CFF] text-white px-3 py-2 text-sm" onClick={load} disabled={busy}><RefreshCw size={17}/></button></div>
    {error&&<p role="alert" className="rounded-lg bg-red-950 text-red-200 p-3 text-sm">{error}</p>}
    {data&&<><div className="grid gap-3 md:grid-cols-2">{Object.entries(data.services||{}).map(([name,service])=><article className={panel} key={name}>
      <div className="flex justify-between gap-3 items-center"><h3 className="font-semibold capitalize">{name.replaceAll('_',' ')}</h3><span className={'text-xs rounded-full px-2 py-1 '+(service.configured?'bg-emerald-900 text-emerald-200':'bg-amber-900 text-amber-200')}>{service.configured?'Credentials present':'Needs setup'}</span></div><p className="text-sm text-[#9AA6BC] mt-3">{service.note}</p>
    </article>)}</div>
    <div className={panel}><h3 className="font-semibold mb-2">Database signals</h3>{Object.entries(data.database||{}).map(([key,value])=><div key={key} className="flex justify-between border-b border-[#263248] py-1 text-sm"><span>{key.replaceAll('_',' ')}</span><strong>{String(value)}</strong></div>)}</div>
    <div className={panel}><h3 className="font-semibold">Client integrations</h3>{Object.entries(data.client_side_services||{}).map(([name,value])=><p className="text-sm text-[#9AA6BC] mt-2" key={name}><strong className="text-white capitalize">{name}</strong>: {value}</p>)}</div>
    <p className="text-sm text-[#9AA6BC]">{data.note}</p></>}
  </div>;
}
