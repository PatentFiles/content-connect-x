/** Publicly visible production suitability: distinguish host declarations and verified permits. */
import React,{useEffect,useState} from 'react';
import {ShieldCheck,Camera} from 'lucide-react';
import {hostingProduction} from './hostingBusinessApi';
const card='rounded-xl border border-[#344862] bg-[#111D2E] p-4';
const input='w-full rounded-lg border border-[#415573] bg-[#071526] px-3 py-2 text-sm text-white';
const button='rounded-lg bg-[#547CF4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
export default function HostingSuitabilityManager({propertyId}){
 const [form,setForm]=useState({adult_production_permitted:false,privacy_level:'standard',soundproof_confirmed:false,parking_spaces:0,separate_dressing_rooms:0,noise_restrictions:''});
 const [verified,setVerified]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  if(!propertyId)return;
  hostingProduction('suitability_get',{property_id:propertyId}).then(r=>{
   if(r.item){setForm(v=>({...v,...r.item}));setVerified(Boolean(r.item.permits_verified));}
  }).catch(e=>setError(e.message));
 },[propertyId]);
 const save=async(e)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{const r=await hostingProduction('suitability_save',{property_id:propertyId,...form});
   setVerified(false);setNotice(r.note||'Suitability declarations updated.');}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <form className={card+' space-y-3 text-white'} onSubmit={save}>
  <h3 className="flex gap-2 items-center font-semibold"><Camera size={18}/>Production suitability and privacy</h3>
  <p className="text-xs text-[#9CB3CF]">Choose honest venue capabilities. Host-declared claims are not independently verified until reviewed by an authorized administrator.</p>
  {verified&&<p className="flex gap-2 text-xs text-emerald-300"><ShieldCheck size={15}/>Venue suitability independently reviewed</p>}
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-2 text-sm text-red-300">{error}</p>}
  {notice&&<p className="text-sm text-emerald-300">{notice}</p>}
  <label className="flex gap-2 text-xs items-center"><input type="checkbox" checked={form.adult_production_permitted}
    onChange={e=>setForm(v=>({...v,adult_production_permitted:e.target.checked}))}/>Adult-content production expressly permitted by property owner</label>
  <label className="flex gap-2 text-xs items-center"><input type="checkbox" checked={form.soundproof_confirmed}
    onChange={e=>setForm(v=>({...v,soundproof_confirmed:e.target.checked}))}/>Soundproofing available</label>
  <div className="grid grid-cols-2 gap-2">
   <label className="text-xs">Privacy setup<select className={input+' mt-1'} value={form.privacy_level} onChange={e=>setForm(v=>({...v,privacy_level:e.target.value}))}>
    <option value="standard">Standard</option><option value="private_entry">Private entrance</option><option value="closed_set">Closed-set production</option>
   </select></label>
   <label className="text-xs">Parking spaces<input className={input+' mt-1'} type="number" min={0} max={1000}
    value={form.parking_spaces} onChange={e=>setForm(v=>({...v,parking_spaces:Number(e.target.value)}))}/></label>
   <label className="text-xs">Separate dressing rooms<input className={input+' mt-1'} type="number" min={0} max={100}
    value={form.separate_dressing_rooms} onChange={e=>setForm(v=>({...v,separate_dressing_rooms:Number(e.target.value)}))}/></label>
  </div>
  <label className="text-xs block">Noise and privacy restrictions<textarea rows={2} maxLength={600} className={input+' mt-1'}
    value={form.noise_restrictions} onChange={e=>setForm(v=>({...v,noise_restrictions:e.target.value}))}/></label>
  <button className={button} disabled={busy}>Save suitability declarations</button>
 </form>;
}
