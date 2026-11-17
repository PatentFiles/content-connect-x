/**
 * Complete creator profile editor. Sensitive orientation, identity and collaboration
 * preferences live in an owner-only table, never in public member_profiles.
 * Visibility flags default OFF; directory opt-in is independent of saving.
 */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {Camera,Image,Activity,User,Edit2,ShieldCheck} from 'lucide-react';
import MediaGallery from './MediaGallery';
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
export default function CreatorProfileEditor({user,profile,onSaved,approved=false,paid=false,isAdmin=false}){
 const [form,setForm]=useState({display_name:profile?.display_name||'',
  role_type:profile?.role_type||'creator',bio:profile?.bio||'',
  city:profile?.city||'',state:profile?.state||'',
  country:countryCode(profile?.country||'US')});
 const [prefs,setPrefs]=useState(initial);
 const [editing,setEditing]=useState(!profile?.profile_complete);
 const [activeTab,setActiveTab]=useState('profile');
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
   setEditing(false);
   if(onSaved)await onSaved();
  }catch(e){setError(e.message);}finally{setSaving(false);}
 };
 return <div className="min-h-screen pb-20 md:pb-8" style={{background:'var(--cc-bg)',color:'var(--cc-text-primary)'}}>
  {/* Original Base44 profile cover, avatar, role badge and editor header. */}
  <div className="relative">
   <div className="relative h-48 overflow-hidden md:h-64" style={{background:'linear-gradient(135deg,#0B0F14,#263248)'}}>
    {profile?.cover_url?.startsWith('https://')&&<img src={profile.cover_url}
     alt="Profile cover" className="h-full w-full object-cover"/>}
   </div>
   <div className="mx-auto max-w-4xl px-4">
    <div className="relative -mt-16 flex flex-col items-center gap-4 md:-mt-20">
     <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-full border-4 text-5xl font-bold md:h-40 md:w-40"
      style={{backgroundColor:'var(--cc-surface)',borderColor:'var(--cc-bg)',color:'var(--cc-blue)'}}>
      {profile?.avatar_path?.startsWith('https://')?<img src={profile.avatar_path} alt="" className="h-full w-full object-cover"/>:
        (form.display_name||'U').slice(0,1).toUpperCase()}
     </div>
     <div className="text-center">
      <h1 className="text-2xl font-bold">{form.display_name||'Set up your profile'}</h1>
      <div className="mt-2 flex items-center justify-center gap-2">
       <span className="rounded-full border px-3 py-1 text-xs capitalize"
        style={{borderColor:'var(--cc-border)'}}>{form.role_type.replaceAll('_',' ')}</span>
       {approved&&<span className="inline-flex items-center gap-1 rounded-full border border-emerald-700 px-3 py-1 text-xs text-emerald-300">
        <ShieldCheck size={13}/>Verified</span>}
      </div>
      <button type="button" onClick={()=>{setActiveTab('profile');setEditing(v=>!v);}}
       className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
       style={{background:'#4F8CFF'}}><Edit2 size={16}/>{editing?'Cancel editing':'Edit'}</button>
     </div>
    </div>
   </div>
  </div>
  <div className="mx-auto mt-6 max-w-4xl px-4">
   <div role="tablist" aria-label="Profile sections" className="mb-6 grid grid-cols-3 gap-2 border-b pb-2"
    style={{borderColor:'var(--cc-border)'}}>
    {[[ 'profile','Profile',User ],['galleries','Galleries',Image],['analytics','Analytics',Activity]].map(([key,name,Icon])=>
     <button type="button" key={key} role="tab" aria-selected={activeTab===key}
      className="flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium"
      style={{background:activeTab===key?'rgba(79,140,255,.12)':'transparent',
       color:activeTab===key?'var(--cc-blue)':'var(--cc-text-secondary)'}}
      onClick={()=>setActiveTab(key)}><Icon size={17}/>{name}</button>)}
   </div>
   {error&&<p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</p>}
   {notice&&<p role="status" className="mb-4 rounded-lg bg-emerald-950 p-3 text-emerald-200">{notice}</p>}
   {activeTab==='profile'&&(!editing?
    <div className="space-y-6">
     <section className={panel}>
      <h3 className="text-center text-lg font-semibold">Basic Information</h3>
      <div className="grid gap-4 sm:grid-cols-2">
       <div><p className="text-xs" style={{color:'var(--cc-text-muted)'}}>Display name</p>
        <p className="mt-1 font-medium">{form.display_name||'Not set'}</p></div>
       <div><p className="text-xs" style={{color:'var(--cc-text-muted)'}}>Role</p>
        <p className="mt-1 capitalize">{form.role_type.replaceAll('_',' ')}</p></div>
       <div><p className="text-xs" style={{color:'var(--cc-text-muted)'}}>Location</p>
        <p className="mt-1">{[form.city,form.state,countryName(form.country)].filter(Boolean).join(', ')}</p></div>
       <div><p className="text-xs" style={{color:'var(--cc-text-muted)'}}>Identity</p>
        <p className="mt-1">{prefs.gender_identity||'Private or not specified'}</p></div>
      </div>
      <p className="whitespace-pre-wrap text-sm" style={{color:'var(--cc-text-secondary)'}}>{form.bio}</p>
     </section>
     {form.role_type==='creator'&&<section className={panel}>
      <h3 className="text-lg font-semibold">Scene Pairings</h3>
      <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>{prefs.scene_pairings.length?prefs.scene_pairings.join(' · '):'Not set'}</p>
      <h3 className="mt-4 text-lg font-semibold">Content Categories</h3>
      <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>{prefs.content_categories.length?prefs.content_categories.join(' · '):'Not set'}</p>
     </section>}
     <section className={panel}>
      <h3 className="text-lg font-semibold">Availability & Travel</h3>
      <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>{prefs.available_to_travel?'Available for travel':'Travel not enabled'}</p>
     </section>
    </div>
    :<form className="space-y-5" onSubmit={save}>
  <div><h2 className="text-center text-lg font-semibold">Basic Information</h2>
  <p className="mt-1 text-center text-sm" style={{color:'var(--cc-text-secondary)'}}>Edit your profile information and preferences.</p></div>
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
 </form>)}
   {activeTab==='galleries'&&<MediaGallery userId={user.id} paid={paid} admin={isAdmin}/>}
   {activeTab==='analytics'&&<div className={panel}>
    <h3 className="text-lg font-semibold">Profile Analytics</h3>
    <p className="mt-2 text-sm" style={{color:'var(--cc-text-secondary)'}}>
     Profile-view analytics from the original Base44 application are not yet migrated.
     No visitor statistics are invented. Your original profile design remains preserved.</p>
   </div>}
  </div>
 </div>;
}
