/** Privacy-preserving real profile-open metrics; 0 is real, never fabricated. */
import React,{useCallback,useEffect,useState} from 'react';
import {Activity,RefreshCw,Users,Eye} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const fmt=value=>new Intl.NumberFormat().format(Number(value)||0);
export default function ProfileAnalytics(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:result,error:invokeError}=await supabase.functions.invoke('profile-analytics',{body:{action:'summary'}});
   if(invokeError||result?.error)throw new Error(result?.error||invokeError?.message||'Analytics unavailable');
   setData(result);
  }catch(e){setError(e.message);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const days=Array.isArray(data?.daily_14d)?data.daily_14d:[];
 const max=Math.max(1,...days.map(day=>Number(day.views)||0));
 const cards=[['Last 7 days',data?.views_7d,Eye],['Last 30 days',data?.views_30d,Activity],
  ['Unique visitors · 30d',data?.unique_viewers_30d,Users],['Total recorded',data?.total_views,Eye]];
 return <section className="ccx-surface space-y-5 p-5" aria-label="Private profile analytics">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="text-lg font-semibold">Profile Analytics</h3>
    <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">Real profile opens by independently verified members, starting when tracking was activated.</p></div>
   <button type="button" className="ccx-secondary rounded-lg p-2.5" onClick={load} disabled={loading} aria-label="Refresh profile analytics">
    <RefreshCw size={18} className={loading?'animate-spin':''}/></button>
  </div>
  {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
  {loading&&!data?<p className="text-sm text-[var(--cc-text-secondary)]">Loading profile activity…</p>:null}
  {data&&<>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {cards.map(([label,value,Icon])=><div key={label} className="rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-4">
     <div className="flex items-center gap-2 text-[var(--cc-text-secondary)]"><Icon size={16}/><span className="text-xs">{label}</span></div>
     <strong className="mt-2 block text-2xl font-semibold">{fmt(value)}</strong>
    </div>)}
   </div>
   <div className="space-y-3">
    <h4 className="text-sm font-semibold">Daily profile views · last 14 days</h4>
    <div className="flex h-32 items-end gap-1.5" role="img"
      aria-label={days.map(day=>day.date+': '+day.views+' views').join(', ')}>
     {days.map(day=><div key={day.date} className="group flex min-w-0 flex-1 flex-col justify-end gap-1">
      <div title={day.date+' · '+day.views+' views'} className="w-full rounded-t-md bg-[var(--cc-surface-subtle)]  to-[#4F8CFF]"
       style={{height:Math.max(3,(Number(day.views)||0)/max*108)+'px'}}/>
     </div>)}
    </div>
    <p className="text-xs text-[var(--cc-text-secondary)]">One view per verified member per day. Your own visits, previews and anonymous traffic are not counted.</p>
   </div>
  </>}
 </section>;
}
