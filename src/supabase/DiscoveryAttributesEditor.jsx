/** Opt-in, owner-readable discovery metadata. Never stores document age or health records.
 * Directory searches consume only opted-in rows through the server; other users
 * cannot SELECT these rows through the browser's Supabase client.
 */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {genderOptions,orientationOptions} from './profileOptions';

const shell='rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5';
const field='mt-1 min-h-11 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-3 py-2.5 text-sm';
const initial={age_years:'',height_cm:'',weight_kg:'',ethnicity:'',penis_inches:'',circumcision:'',breast_size:'',visible_in_discovery:false};
const genders=new Set(['man','woman','trans_man','trans_woman','nonbinary','genderfluid','self_describe','']);
const enumEthnicity=[['','Prefer not to say'],['black','Black'],['white','White'],['asian','Asian'],['hispanic_latino','Hispanic / Latino'],['middle_eastern','Middle Eastern / North African'],['native_indigenous','Native / Indigenous'],['mixed','Mixed'],['other','Other self-description']];
const cups=['AA','A','B','C','D','DD','DDD','E','F','G','H','I','J','K+'];
const toNumber=(value,min,max)=>{if(value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error('A measurement is outside its valid range.');return n;};
export default function DiscoveryAttributesEditor({userId,genderIdentity='',professional=false}){
 const [values,setValues]=useState(initial),[identity,setIdentity]=useState({gender_identity:'',sexual_orientation:'',show_gender_in_discovery:false,show_orientation_in_discovery:false});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
 const gender=professional?identity.gender_identity:genderIdentity;
 const set=(key,value)=>setValues(old=>({...old,[key]:value}));
 const setPreference=(key,value)=>setIdentity(old=>({...old,[key]:value}));
 useEffect(()=>{let active=true;(async()=>{
  const [attributes,preferences]=await Promise.all([
   supabase.from('member_discovery_attributes').select('*').eq('user_id',userId).maybeSingle(),
   professional?supabase.from('member_profile_preferences').select('gender_identity,sexual_orientation,show_gender_in_discovery,show_orientation_in_discovery').eq('user_id',userId).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  if(!active)return;
  if(attributes.error||preferences.error)throw attributes.error||preferences.error;
  if(attributes.data)setValues({...initial,...Object.fromEntries(Object.entries(initial).map(([key])=>[key,attributes.data[key]??(key==='visible_in_discovery'?false:'')]))});
  if(preferences.data)setIdentity({gender_identity:preferences.data.gender_identity||'',sexual_orientation:preferences.data.sexual_orientation||'',show_gender_in_discovery:preferences.data.show_gender_in_discovery===true,show_orientation_in_discovery:preferences.data.show_orientation_in_discovery===true});
 })().catch(e=>{if(active)setError(e.message||'Discovery profile could not load');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[userId,professional]);
 const submit=async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   if(!genders.has(gender))throw Error('Select a valid gender identity.');
   if(professional){
    const preferences={user_id:userId,...identity,updated_at:new Date().toISOString()};
    const {error:saveIdentityError}=await supabase.from('member_profile_preferences').upsert(preferences,{onConflict:'user_id'});
    if(saveIdentityError)throw saveIdentityError;
   }
   const anatomy=['man','trans_woman'].includes(gender)?{penis_inches:toNumber(values.penis_inches,1,16),circumcision:values.circumcision||null,breast_size:null}:
    gender==='woman'?{penis_inches:null,circumcision:null,breast_size:values.breast_size||null}:
    {penis_inches:null,circumcision:null,breast_size:null};
   const record={user_id:userId,age_years:toNumber(values.age_years,18,100),height_cm:toNumber(values.height_cm,100,250),
    weight_kg:toNumber(values.weight_kg,25,350),ethnicity:values.ethnicity||null,
    ...anatomy,visible_in_discovery:values.visible_in_discovery===true,updated_at:new Date().toISOString()};
   const {error:saveError}=await supabase.from('member_discovery_attributes').upsert(record,{onConflict:'user_id'});
   if(saveError)throw saveError;
   setMessage(record.visible_in_discovery?'Discovery details saved. Other verified members may now match these voluntary fields.':'Details saved privately; advanced search will not match your measurements.');
  }catch(e){setError(e.message||'Could not save discovery details');}
  finally{setBusy(false);}
 };
 const number=(key,label,min,max,step=1)=> <label className="block text-sm" key={key}>{label}<input className={field} type="number" min={min} max={max} step={step} value={values[key]} onChange={e=>set(key,e.target.value)} placeholder="Optional"/></label>;
 return <section className={shell+' space-y-4'} aria-label="Discovery characteristics">
  <h2 className="text-lg font-semibold">Optional discovery characteristics</h2>
  <p className="text-sm text-[var(--cc-text-secondary)]">Only you can read or edit these values. They are self-reported, not taken from your government ID. Verified members can filter by the fields you choose to share. Sharing starts off.</p>
  {loading?<p role="status">Loading private profile options…</p>:<form className="space-y-4" onSubmit={submit}>
   {professional&&<div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm">Gender identity<select className={field} value={identity.gender_identity} onChange={e=>setPreference('gender_identity',e.target.value)}>{genderOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <label className="block text-sm">Sexual orientation<select className={field} value={identity.sexual_orientation} onChange={e=>setPreference('sexual_orientation',e.target.value)}>{orientationOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={identity.show_gender_in_discovery} onChange={e=>setPreference('show_gender_in_discovery',e.target.checked)}/>Show gender in verified-member searches</label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={identity.show_orientation_in_discovery} onChange={e=>setPreference('show_orientation_in_discovery',e.target.checked)}/>Show orientation to verified members</label>
   </div>}
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {number('age_years','Age (years)',18,100)}
    {number('height_cm','Height (cm)',100,250)}
    {number('weight_kg','Weight (kg)',25,350,.1)}
    <label className="block text-sm">Ethnicity (self-described)<select className={field} value={values.ethnicity} onChange={e=>set('ethnicity',e.target.value)}>{enumEthnicity.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    {['man','trans_woman'].includes(gender)&&<>
     {number('penis_inches','Penis length (inches)',1,16,.5)}
     <label className="block text-sm">Circumcision<select className={field} value={values.circumcision} onChange={e=>set('circumcision',e.target.value)}><option value="">Prefer not to say</option><option value="circumcised">Circumcised</option><option value="uncircumcised">Uncircumcised</option></select></label>
    </>}
    {gender==='woman'&&<label className="block text-sm">Breast size<select className={field} value={values.breast_size} onChange={e=>set('breast_size',e.target.value)}><option value="">Prefer not to say</option>{cups.map(size=><option value={size} key={size}>{size}</option>)}</select></label>}
   </div>
   <label className="flex gap-3 rounded-xl border border-[var(--cc-border)] p-3 text-sm"><input type="checkbox" checked={values.visible_in_discovery} onChange={e=>set('visible_in_discovery',e.target.checked)}/><span><strong>Allow verified members to find me using these details</strong><span className="mt-1 block text-xs text-[var(--cc-text-secondary)]">Off by default. Turning it off excludes these values from new searches.</span></span></label>
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm text-[var(--cc-text-primary)]">{message}</p>}
   <button type="submit" disabled={busy} className="ccx-primary min-h-11 rounded-xl px-5 py-2.5 text-sm font-semibold">{busy?'Saving…':'Save discovery preferences'}</button>
  </form>}
 </section>;
}
