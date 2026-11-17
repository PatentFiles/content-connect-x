/**
 * Complete creator profile editor. Sensitive orientation, identity and collaboration
 * preferences live in an owner-only table, never in public member_profiles.
 * Visibility flags default OFF; directory opt-in is independent of saving.
 */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {countries,countryCode,countryName,regionOptions,roleOptions,
 genderOptions,orientationOptions,contentCategories,scenePairings,specialties} from './profileOptions';

const input='w-full rounded-xl bg-[#0F1520] border border-[#34445D] px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500';
const panel='ccx-surface space-y-4 p-5';
const initial={gender_identity:'',sexual_orientation:'',pronouns:'',gender_self_description:'',
 orientation_self_description:'',preferred_collaborators:[],content_categories:[],
 scene_pairings:[],specialties:[],available_to_travel:false,
 show_gender_in_discovery:false,show_categories_in_discovery:false};
function CheckList({label,options,selected,change}){
 return <fieldset><legend className="mb-2 text-sm font-semibold text-white">{label}</legend>
  <div className="grid gap-2 sm:grid-cols-2">{options.map(([value,name])=>
   <label key={value} className="flex items-center gap-2 rounded-lg border border-[#31425D] px-3 py-2 text-sm text-[#CED8ED]">
    <input type="checkbox" checked={selected.includes(value)}
     onChange={e=>change(e.target.checked?[...selected,value]:selected.filter(v=>v!==value))}/>
    {name}</label>)}</div></fieldset>;
}
export default function CreatorProfileEditor({user,profile,onSaved}){
 const [form,setForm]=useState({display_name:profile?.display_name||'',
  role_type:profile?.role_type||'creator',bio:profile?.bio||'',
  city:profile?.city||'',state:profile?.state||'',
  country:countryCode(profile?.country||'US')});
 const [prefs,setPrefs]=useState(initial);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const update=(key,value)=>setForm(old=>({...old,[key]:value}));
 const preference=(key,value)=>setPrefs(old=>({...old,[key]:value}));
 useEffect(()=>{
  let mounted=true;
  void (async()=>{
   try{
    const {data,error:readError}=await supabase.from('member_profile_preferences')
     .select('*').eq('user_id',user.id).maybeSingle();
    if(!mounted)return;
    if(readError)setError(readError.message);
    else if(data)setPrefs({...initial,...data});
   }catch(e){if(mounted)setError(e.message);}
   finally{if(mounted)setLoading(false);}
  })();
  return()=>{mounted=false;};
 },[user.id]);
 const save=async(event)=>{
  event.preventDefault();setSaving(true);setError('');setNotice('');
  try{
   const display_name=form.display_name.trim().slice(0,100);
   if(!display_name)throw Error('Enter a display name.');
   const profileData={id:user.id,display_name,role_type:form.role_type,
    bio:form.bio.trim().slice(0,2000),city:form.city.trim().slice(0,100),
    state:form.state.trim().slice(0,100),country:countryName(form.country),
    updated_at:new Date().toISOString(),profile_complete:true};
   const {error:profileError}=await supabase.from('member_profiles').upsert(profileData,{onConflict:'id'});
   if(profileError)throw profileError;
   const details={user_id:user.id,gender_identity:prefs.gender_identity,
    sexual_orientation:prefs.sexual_orientation,pronouns:prefs.pronouns.trim().slice(0,80),
    gender_self_description:prefs.gender_identity==='self_describe'?prefs.gender_self_description.trim().slice(0,80):'',
    orientation_self_description:prefs.sexual_orientation==='self_describe'?prefs.orientation_self_description.trim().slice(0,80):'',
    preferred_collaborators:prefs.preferred_collaborators,
    content_categories:prefs.content_categories,scene_pairings:prefs.scene_pairings,
    specialties:prefs.specialties,available_to_travel:Boolean(prefs.available_to_travel),
    show_gender_in_discovery:Boolean(prefs.show_gender_in_discovery),
    show_categories_in_discovery:Boolean(prefs.show_categories_in_discovery),
    updated_at:new Date().toISOString()};
   const {error:detailsError}=await supabase.from('member_profile_preferences').upsert(details,{onConflict:'user_id'});
   if(detailsError)throw detailsError;
   setNotice('Your profile and private preferences were saved.');
   if(onSaved)await onSaved();
  }catch(e){setError(e.message);}finally{setSaving(false);}
 };
 return <form className="mx-auto max-w-4xl space-y-5" onSubmit={save}>
  <div><h2 className="text-2xl font-bold">My profile</h2>
   <p className="mt-1 text-sm text-[#AABBD4]">Build your creator profile, choose collaborations and decide what others can discover.</p></div>
  {error&&<p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-lg bg-emerald-950 p-3 text-emerald-200">{notice}</p>}
  <section className={panel}><h3 className="text-lg font-semibold">Professional details</h3>
   <label className="block text-sm">Display name<input className={input+' mt-2'} value={form.display_name} maxLength={100}
    onChange={e=>update('display_name',e.target.value)} required/></label>
   <label className="block text-sm">Creator / professional type
    <select className={input+' mt-2'} value={form.role_type} onChange={e=>update('role_type',e.target.value)}>
     {roleOptions.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
   <label className="block text-sm">About you<textarea className={input+' mt-2'} rows={5} maxLength={2000}
    value={form.bio} onChange={e=>update('bio',e.target.value)}
    placeholder="Introduce your work, experience and what you're looking to create."/></label>
  </section>
  <section className={panel}><h3 className="text-lg font-semibold">Location</h3>
   <p className="text-xs text-[#AABBD4]">Only city, state or region, and country are shared in discovery. Never enter your exact address here.</p>
   <div className="grid gap-3 sm:grid-cols-3">
    <label className="block text-sm">Country
     <select className={input+' mt-2'} value={form.country}
      onChange={e=>setForm(old=>({...old,country:e.target.value,state:'',city:''}))}>
      {countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
    <label className="block text-sm">State / province / region
     {regionOptions[form.country]?<select className={input+' mt-2'} value={form.state}
      onChange={e=>setForm(old=>({...old,state:e.target.value,city:''}))}>
       <option value="">Select region</option>
       {regionOptions[form.country].map(s=><option key={s} value={s}>{s}</option>)}
      </select>:<input className={input+' mt-2'} value={form.state} onChange={e=>update('state',e.target.value)}
       placeholder="State / region" maxLength={100}/>}</label>
    <label className="block text-sm">City<input className={input+' mt-2'} value={form.city}
     onChange={e=>update('city',e.target.value)} maxLength={100} placeholder="City"/></label>
   </div>
  </section>
  <section className={panel}><h3 className="text-lg font-semibold">Personal identity</h3>
   <p className="text-sm text-[#AABBD4]">All fields are optional. Identity and orientation are private by default and never required to register.</p>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm">Gender identity<select className={input+' mt-2'} value={prefs.gender_identity}
      onChange={e=>preference('gender_identity',e.target.value)}>
      {genderOptions.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <label className="block text-sm">Sexual orientation<select className={input+' mt-2'} value={prefs.sexual_orientation}
      onChange={e=>preference('sexual_orientation',e.target.value)}>
      {orientationOptions.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    {prefs.gender_identity==='self_describe'&&<label className="block text-sm">Describe your gender<input className={input+' mt-2'}
     maxLength={80} value={prefs.gender_self_description} onChange={e=>preference('gender_self_description',e.target.value)}/></label>}
    {prefs.sexual_orientation==='self_describe'&&<label className="block text-sm">Describe your orientation<input className={input+' mt-2'}
     maxLength={80} value={prefs.orientation_self_description} onChange={e=>preference('orientation_self_description',e.target.value)}/></label>}
    <label className="block text-sm">Pronouns (optional)<input className={input+' mt-2'}
     maxLength={80} value={prefs.pronouns} onChange={e=>preference('pronouns',e.target.value)}
     placeholder="e.g. they/them"/></label>
   </div>
  </section>
  <section className={panel}><h3 className="text-lg font-semibold">Collaboration preferences</h3>
   <p className="text-sm text-[#AABBD4]">Selections indicate interest only. They are not consent to any activity or booking.</p>
   <CheckList label="Preferred collaborators" options={genderOptions.filter(([v])=>v&&v!=='self_describe')}
    selected={prefs.preferred_collaborators} change={v=>preference('preferred_collaborators',v)}/>
   <CheckList label="Content categories" options={contentCategories}
    selected={prefs.content_categories} change={v=>preference('content_categories',v)}/>
   <CheckList label="Scene / creative formats" options={scenePairings}
    selected={prefs.scene_pairings} change={v=>preference('scene_pairings',v)}/>
   <CheckList label="Professional specialties" options={specialties}
    selected={prefs.specialties} change={v=>preference('specialties',v)}/>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.available_to_travel}
    onChange={e=>preference('available_to_travel',e.target.checked)}/>Available to travel for collaborations</label>
  </section>
  <section className={panel}><h3 className="text-lg font-semibold">Discoverability & privacy</h3>
   <p className="text-sm text-[#AABBD4]">Your name, professional role and general location appear only to eligible verified members. Sensitive matching details are never exposed unless you choose to share them.</p>
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={prefs.show_gender_in_discovery}
    onChange={e=>preference('show_gender_in_discovery',e.target.checked)}/>
    Show my gender identity in verified creator searches</label>
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={prefs.show_categories_in_discovery}
    onChange={e=>preference('show_categories_in_discovery',e.target.checked)}/>
    Show my content categories and specialties in verified creator searches</label>
   <p className="text-xs text-[#93A4BE]">Your sexual orientation, self-descriptions and collaborator preferences are not published in discovery.</p>
  </section>
  <button type="submit" disabled={saving||loading} className="ccx-primary rounded-xl px-6 py-3 font-semibold disabled:opacity-50">
   {saving?'Saving…':loading?'Loading profile…':'Save complete profile'}</button>
 </form>;
}
