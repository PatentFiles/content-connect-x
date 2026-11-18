/** Original Base44 CreatorDetails edit sections; fields save to owner-only Supabase table.
 * These preferences are not consent, a public gallery, or health-test records.
 */
import React from 'react';
import {originalCreatorCatalog,creatorFieldLabels,friendlyChoice} from './originalCreatorCatalog';

const box='rounded-xl border p-5 md:p-6';
const field='w-full rounded-lg border px-3 py-2.5 text-sm';
const surface={borderColor:'var(--cc-border)',backgroundColor:'var(--cc-surface)'};
const control={borderColor:'var(--cc-border)',backgroundColor:'var(--cc-bg)',color:'var(--cc-text-primary)'};
const other={
 scene_pairings:'scene_pairings_other',
 standard_acts:'standard_acts_other',
 fetish_acts:'fetish_acts_other',
 kink_edge_acts:'kink_edge_acts_other'
};
function SetEditor({name,values=[],onChange}){
 const choices=originalCreatorCatalog[name]||[];
 const update=value=>onChange(values.includes(value)?values.filter(item=>item!==value):[...values,value]);
 return <section className={box} style={surface}>
  <h3 className="mb-4 text-lg font-semibold">{creatorFieldLabels[name]}</h3>
  <div className="flex flex-wrap gap-2">
   {choices.map(choice=>{
    const active=values.includes(choice);
    return <button type="button" key={choice} aria-pressed={active} onClick={()=>update(choice)}
     className="min-w-0 rounded-lg border px-3 py-2 text-sm leading-5 transition hover:-translate-y-0.5"
     style={{background:active?'var(--cc-surface-hover)':'transparent',
      borderColor:active?'var(--cc-link)':'var(--cc-border)',
      color:active?'var(--cc-blue)':'var(--cc-text-secondary)'}}>{friendlyChoice(choice)}</button>;
   })}
  </div>
 </section>;
}
export const initialCreatorPreferences={
 scene_pairings:[],scene_pairings_other:'',compensation_preferences:[],
 standard_acts:[],standard_acts_other:'',fetish_acts:[],fetish_acts_other:'',
 kink_edge_acts:[],kink_edge_acts_other:'',performance_positioning:[],
 looking_for_genders:[],physical_details:{},availability_type:'local_only',
 travel_regions:[],rates_text:'',socials:{},stats:{}
};
export default function OriginalCreatorPreferences({value=initialCreatorPreferences,genderIdentity='',onChange,onNavigate}){
 const update=(key,next)=>onChange({...value,[key]:next});
 const setObject=(key,field,next)=>update(key,{...(value[key]||{}),[field]:next});
 return <div className="space-y-6">
  {['scene_pairings','compensation_preferences','standard_acts',
    'fetish_acts','kink_edge_acts','performance_positioning',
    'looking_for_genders'].map(key=><React.Fragment key={key}>
     <SetEditor name={key} values={value[key]||[]} onChange={v=>update(key,v)}/>
     {other[key]&&(value[key]||[]).includes('other')&&
      <label className="block text-sm">Other {creatorFieldLabels[key]}
       <input className={field+' mt-2'} style={control}
        value={value[other[key]]||''} maxLength={250}
        onChange={e=>update(other[key],e.target.value)}/></label>}
    </React.Fragment>)}
  <section className={box} style={surface}>
   <h3 className="mb-4 text-center text-lg font-semibold">Physical Details</h3>
   <p className="mb-4 text-xs" style={{color:'var(--cc-text-muted)'}}>
    All physical information remains private to your account unless a separate authorized sharing flow is completed.</p>
   <div className="grid gap-3 sm:grid-cols-2">
    {[['height','Height'],['weight','Weight (lbs)'],['hair_color','Hair color'],['eye_color','Eye color'],
      ['measurements','Measurements']].map(([id,label])=>
      <label key={id} className="block text-sm">{label}
       <input className={field+' mt-2'} style={control} maxLength={100}
        value={(id==='height'||id==='weight'||id==='hair_color'||id==='eye_color'?
          value.stats?.[id]:value.physical_details?.[id])||''}
        onChange={e=>(id==='height'||id==='weight'||id==='hair_color'||id==='eye_color'?
          setObject('stats',id,e.target.value):setObject('physical_details',id,e.target.value))}/></label>)}
    {(genderIdentity==='woman'||genderIdentity==='trans_woman')&&[
      ['breast_size','Bust size'],['breast_natural','Breast type'],['hip_size','Hip size'],['dress_size','Dress size']
    ].map(([id,label])=>
      id==='breast_natural'?
      <label key={id} className="block text-sm">{label}
       <select className={field+' mt-2'} style={control}
        value={value.physical_details?.breast_natural||''}
        onChange={e=>setObject('physical_details','breast_natural',e.target.value)}>
        <option value="">Not specified</option><option value="natural">Natural</option>
        <option value="enhanced">Enhanced</option></select></label>:
      <label key={id} className="block text-sm">{label}
       <input className={field+' mt-2'} style={control} maxLength={100}
        value={value.physical_details?.[id]||''}
        onChange={e=>setObject('physical_details',id,e.target.value)}/></label>)}
    {(genderIdentity==='man'||genderIdentity==='trans_man')&&[
      ['endowment_size','Endowment (inches)']
    ].map(([id,label])=>
      <label key={id} className="block text-sm">{label}
       <input className={field+' mt-2'} style={control} maxLength={100}
        value={value.physical_details?.[id]||''}
        onChange={e=>setObject('physical_details',id,e.target.value)}/></label>)}
    {(genderIdentity==='man'||genderIdentity==='trans_man')&&<label className="block text-sm">Circumcision
     <select className={field+' mt-2'} style={control}
      value={value.physical_details?.circumcision_status||''}
      onChange={e=>setObject('physical_details','circumcision_status',e.target.value)}>
      <option value="">Not specified</option><option value="cut">Circumcised</option>
      <option value="uncut">Not circumcised</option></select></label>}
   </div>
  </section>
  <section className={box} style={surface}>
   <h3 className="mb-4 text-lg font-semibold">Collaboration Rate</h3>
   <textarea rows={3} className={field} style={control} maxLength={2000}
    value={value.rates_text||''} onChange={e=>update('rates_text',e.target.value)}
    placeholder="Rates and compensation terms are negotiated per collaboration"/>
  </section>
  <section className={box} style={surface}>
   <h3 className="mb-4 text-lg font-semibold">Availability & Travel</h3>
   <label className="block text-sm">Availability
    <select className={field+' mt-2'} style={control} value={value.availability_type||'local_only'}
     onChange={e=>update('availability_type',e.target.value)}>
     <option value="local_only">Local only</option>
     <option value="available_for_travel">Available for travel</option></select></label>
   <label className="mt-4 block text-sm">Travel regions (comma-separated)
    <input className={field+' mt-2'} style={control}
     value={(value.travel_regions||[]).join(', ')}
     onChange={e=>update('travel_regions',e.target.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,60))}/></label>
  </section>
  <section className={box} style={surface}>
   <h3 className="mb-4 text-lg font-semibold">Social Links</h3>
   <div className="grid gap-3 sm:grid-cols-2">
    {['onlyfans','fansly','twitter','instagram'].map(key=><label key={key} className="block text-sm">
     {friendlyChoice(key)}
     <input className={field+' mt-2'} style={control} maxLength={300}
      placeholder="https://" value={value.socials?.[key]||''}
      onChange={e=>setObject('socials',key,e.target.value)}/></label>)}
   </div>
  </section>
  <section className={box} style={surface}>
   <h3 className="mb-2 text-lg font-semibold">Health & Testing</h3>
   <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>
    Sensitive work-clearance records are controlled by the verified Trust & Readiness workflow, not saved in public profile fields.</p>
   <button type="button" className="mt-4 text-sm font-semibold" style={{color:'var(--cc-blue)'}}
    onClick={()=>onNavigate?.('testing')}>Manage testing and clearance</button>
  </section>
 </div>;
}
