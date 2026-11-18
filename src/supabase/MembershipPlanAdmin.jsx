/** Admitted administrator edits the persisted role/agency monthly catalog. */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
export default function MembershipPlanAdmin(){
 const [items,setItems]=useState([]),[edit,setEdit]=useState({}),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{
  const {data,error:e}=await supabase.from('membership_plan_catalog')
   .select('plan_code,role_type,label,monthly_cents,roster_seats,active,display_order')
   .order('display_order');
  if(e)throw e;setItems(data||[]);
 };
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 const save=async plan=>{
  setBusy(true);setError('');setNotice('');
  try{
   const amount=edit[plan.plan_code]??(plan.monthly_cents/100).toFixed(2);
   if(!/^\d{1,5}(\.\d{1,2})?$/.test(String(amount)))throw Error('Enter a valid USD monthly amount.');
   const monthly_cents=Math.round(Number(amount)*100);
   const {data,error:e}=await supabase.functions.invoke('membership-admin',{
    body:{action:'set_price',plan_code:plan.plan_code,monthly_cents}
   });
   if(e||data?.error)throw Error(data?.error||e?.message||'Unable to save price');
   await load();setNotice('Monthly price saved. This does not activate payments.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <div className="space-y-4">
  <div><h2 className="text-xl font-semibold">Professional memberships</h2>
   <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">Configure flat monthly prices without charging users. Provider activation and verified billing webhooks are separate release controls.</p></div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
  <div className="grid gap-3 md:grid-cols-2">
   {items.map(plan=><article key={plan.plan_code} className="ccx-surface space-y-3 p-4">
    <div><h3 className="font-semibold">{plan.label}</h3>
     <p className="text-xs capitalize text-[var(--cc-text-secondary)]">{plan.role_type.replaceAll('_',' ')} · Monthly USD</p></div>
    <label className="block text-sm">Monthly price (USD)
     <input className="mt-1 w-full rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5"
      inputMode="decimal" value={edit[plan.plan_code]??(plan.monthly_cents/100).toFixed(2)}
      onChange={e=>setEdit(v=>({...v,[plan.plan_code]:e.target.value}))}/></label>
    <button type="button" onClick={()=>save(plan)} disabled={busy}
     className="ccx-primary rounded-xl px-4 py-2.5 text-sm">Save monthly price</button>
   </article>)}
  </div>
 </div>;
}
