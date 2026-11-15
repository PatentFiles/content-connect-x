/** Dynamic pricing, seasonal/holiday ranges, promotions and safe public map area. */
import React,{useEffect,useState} from 'react';
import {Tags,CalendarDays,MapPin,Trash2,RefreshCw} from 'lucide-react';
import {hostingAdvanced} from './hostingBusinessApi';
const panel='rounded-xl border border-[#31465E] bg-[#0D1929] p-4';
const input='w-full rounded-lg border border-[#415672] bg-[#0A1626] px-3 py-2 text-sm text-white';
const button='rounded-lg bg-[#527BF3] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const subtle='rounded-lg border border-[#3A4F67] bg-[#21354C] px-3 py-2 text-xs text-white disabled:opacity-50';

export default function HostingPricingManager({property}){
 const [rules,setRules]=useState([]);
 const [discounts,setDiscounts]=useState([]);
 const [areas,setAreas]=useState([]);
 const [selectedArea,setSelectedArea]=useState(property?.public_area_id||'');
 const [settings,setSettings]=useState({
  weekend_bps:property?.weekend_bps||10000,holiday_bps:property?.holiday_bps||10000,
  overtime_bps:property?.overtime_bps||15000,min_notice_hours:property?.min_notice_hours||24,
  cleaning_fee_cents:property?.cleaning_fee_cents||0,preferred_cleaning_minutes:property?.preferred_cleaning_minutes||120,
  timezone:property?.timezone||'America/Los_Angeles'
 });
 const [rule,setRule]=useState({label:'',kind:'seasonal',starts_on:'',ends_on:'',multiplier_bps:12500});
 const [promo,setPromo]=useState({code:'',discount_bps:1000,max_redemptions:10,expires_at:''});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const load=async()=>{
  if(!property?.id)return;
  setBusy(true);setError('');
  try{
   const [a,b,c]=await Promise.all([
    hostingAdvanced('rate_rules_list',{property_id:property.id}),
    hostingAdvanced('discount_list',{property_id:property.id}),
    hostingAdvanced('areas_public')
   ]);
   setRules(a.items||[]);setDiscounts(b.items||[]);setAreas(c.items||[]);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 useEffect(()=>{load();},[property?.id]);
 const call=async(action,args,noticeText)=>{
  setBusy(true);setError('');setNotice('');
  try{
   const result=await hostingAdvanced(action,args);
   setNotice(noticeText||result.note||'Saved.');await load();return result;
  }catch(e){setError(e.message);return null;}finally{setBusy(false);}
 };
 const save=async(e)=>{
  e.preventDefault();
  await call('host_rate_settings',{property_id:property.id,...settings},'Future price calculations will use these settings. Existing bookings retain their original terms.');
 };
 const saveRule=async(e)=>{
  e.preventDefault();
  const result=await call('rate_rule_create',{property_id:property.id,...rule},'Date range pricing saved.');
  if(result)setRule({...rule,label:'',starts_on:'',ends_on:''});
 };
 const savePromo=async(e)=>{
  e.preventDefault();
  const result=await call('discount_create',{
    property_id:property.id,...promo,expires_at:promo.expires_at?new Date(promo.expires_at).toISOString():null
  },'Promotion created. The code itself is not stored—copy it for your intended guests.');
  if(result)setPromo({...promo,code:''});
 };
 const pickArea=async(e)=>{
  e.preventDefault();
  await call('host_set_area',{property_id:property.id,area_id:selectedArea},
   'Approximate public map area updated. No exact address was exposed.');
 };
 return <section className="space-y-4 text-white">
  <div><h3 className="text-lg font-semibold">Advanced hosting prices</h3><p className="mt-1 text-xs text-[#9CB3CF]">Prices use venue-local dates and 15-minute booking increments. Final quotes are always calculated by Supabase.</p></div>
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">{notice}</p>}
  <form onSubmit={save} className={panel+' space-y-3'}>
   <h4 className="font-semibold flex items-center gap-2"><Tags size={17}/>Date and overtime rules</h4>
   <div className="grid grid-cols-2 gap-3">
    {[
     ['weekend_bps','Weekend rate (% of base)'],
     ['holiday_bps','Holiday fallback rate (%)'],
     ['overtime_bps','Overtime rate (%)']
    ].map(([field,label])=><label key={field} className="text-xs">{label}<input type="number" min={field==='overtime_bps'?100:10}
      max={field==='overtime_bps'?500:400} className={input+' mt-1'}
      value={settings[field]/100}
      onChange={e=>setSettings(v=>({...v,[field]:Math.round(Number(e.target.value)*100)}))}/></label>)}
    <label className="text-xs">Minimum advance notice (hours)<input type="number" min={0} max={720} className={input+' mt-1'}
      value={settings.min_notice_hours} onChange={e=>setSettings(v=>({...v,min_notice_hours:Number(e.target.value)}))}/></label>
    <label className="text-xs">Fixed cleaning fee (USD)<input type="number" min={0} max={100000} step={0.01} className={input+' mt-1'}
      value={settings.cleaning_fee_cents/100} onChange={e=>setSettings(v=>({...v,cleaning_fee_cents:Math.round(Number(e.target.value)*100)}))}/></label>
    <label className="text-xs">Turnover target (minutes)<input type="number" min={0} max={1440} className={input+' mt-1'}
      value={settings.preferred_cleaning_minutes} onChange={e=>setSettings(v=>({...v,preferred_cleaning_minutes:Number(e.target.value)}))}/></label>
    <label className="text-xs col-span-2">Venue time zone (IANA)<input className={input+' mt-1'}
      value={settings.timezone} onChange={e=>setSettings(v=>({...v,timezone:e.target.value}))}
      placeholder="America/Los_Angeles"/></label>
   </div>
   <button className={button} disabled={busy}>Save pricing policy</button>
  </form>
  <form onSubmit={saveRule} className={panel+' space-y-3'}>
   <h4 className="font-semibold flex gap-2 items-center"><CalendarDays size={17}/>Seasonal, holiday and promotional dates</h4>
   <div className="grid grid-cols-2 gap-2">
    <label className="text-xs col-span-2">Rule name<input required minLength={3} className={input+' mt-1'} value={rule.label}
      onChange={e=>setRule(v=>({...v,label:e.target.value}))} placeholder="Holiday weekend"/></label>
    <label className="text-xs">Rule category<select className={input+' mt-1'} value={rule.kind} onChange={e=>setRule(v=>({...v,kind:e.target.value}))}>
      {['seasonal','holiday','promotion'].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    <label className="text-xs">Price multiplier (%)<input className={input+' mt-1'} type="number" min={10} max={400}
      value={rule.multiplier_bps/100} onChange={e=>setRule(v=>({...v,multiplier_bps:Math.round(Number(e.target.value)*100)}))}/></label>
    <label className="text-xs">From<input type="date" required className={input+' mt-1'} value={rule.starts_on}
      onChange={e=>setRule(v=>({...v,starts_on:e.target.value}))}/></label>
    <label className="text-xs">Through<input type="date" required className={input+' mt-1'} value={rule.ends_on}
      onChange={e=>setRule(v=>({...v,ends_on:e.target.value}))}/></label>
   </div>
   <button className={button} disabled={busy}>Add date-based rate</button>
   {rules.map(r=><div key={r.id} className="flex gap-3 items-center justify-between border-t border-[#30435D] pt-2 text-xs">
      <span><strong>{r.label}</strong> · {r.kind} · {r.starts_on}–{r.ends_on} · {r.multiplier_bps/100}%</span>
      <button className="text-red-300" type="button" disabled={busy} aria-label="Remove pricing rule"
       onClick={()=>call('rate_rule_delete',{id:r.id},'Rate rule removed.')}><Trash2 size={16}/></button>
   </div>)}
  </form>
  <form className={panel+' space-y-3'} onSubmit={savePromo}>
   <h4 className="font-semibold">Private discount codes</h4>
   <div className="grid grid-cols-2 gap-3">
    <label className="text-xs col-span-2">Code<input className={input+' mt-1'} required minLength={4} maxLength={40}
      value={promo.code} onChange={e=>setPromo(v=>({...v,code:e.target.value}))}/></label>
    <label className="text-xs">Discount percent<input className={input+' mt-1'} type="number" min={0.01} max={80} step={0.01}
      value={promo.discount_bps/100} onChange={e=>setPromo(v=>({...v,discount_bps:Math.round(Number(e.target.value)*100)}))}/></label>
    <label className="text-xs">Maximum redemptions<input className={input+' mt-1'} type="number" min={1} max={100000}
      value={promo.max_redemptions} onChange={e=>setPromo(v=>({...v,max_redemptions:Number(e.target.value)}))}/></label>
    <label className="text-xs col-span-2">Expires<input type="datetime-local" className={input+' mt-1'} value={promo.expires_at}
      onChange={e=>setPromo(v=>({...v,expires_at:e.target.value}))}/></label>
   </div>
   <button className={button} disabled={busy}>Create discount</button>
   {discounts.map(d=><div className="flex items-center justify-between gap-2 border-t border-[#30435D] pt-2 text-xs" key={d.id}>
      <span>{d.discount_bps/100}% · {d.redemptions}/{d.max_redemptions} used · {d.active?'Active':'Disabled'}</span>
      {d.active&&<button type="button" className="text-red-300" onClick={()=>call('discount_disable',{id:d.id},'Discount disabled.')}>Disable</button>}
   </div>)}
  </form>
  <form onSubmit={pickArea} className={panel+' space-y-3'}>
   <h4 className="flex items-center gap-2 font-semibold"><MapPin size={17}/>Approximate map location</h4>
   <p className="text-xs text-[#9CB3CF]">Choose an approved public area center—not your home's exact coordinates. Search pins will show only this broad area.</p>
   <select className={input} value={selectedArea} onChange={e=>setSelectedArea(e.target.value)} required>
    <option value="">Not mapped yet</option>{areas.map(a=><option key={a.id} value={a.id}>{a.city}, {a.region}, {a.country}</option>)}
   </select>
   <button className={button} disabled={busy||!selectedArea}>Save public map area</button>
  </form>
 </section>;
}
