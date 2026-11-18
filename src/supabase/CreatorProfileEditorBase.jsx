/**
 * Complete creator profile editor. Sensitive orientation, identity and collaboration
 * preferences live in an owner-only table, never in public member_profiles.
 * Visibility flags default OFF; directory opt-in is independent of saving.
 */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
import {Image,Activity,User,Edit2,ShieldCheck,Upload,Heart,Users,Clapperboard,Stethoscope,Lock,ChevronDown} from 'lucide-react';
import MediaGallery from './MediaGallery';
import MemberSocialLinks from './MemberSocialLinks';
import ProfileAnalytics from './ProfileAnalytics';
import OriginalCreatorPreferences,{initialCreatorPreferences} from './OriginalCreatorPreferences';
import {originalUSCities,originalUSStateCodes} from './originalLocationData';
import {countries,countryCode,countryName,regionOptions,roleOptions,
 genderOptions,orientationOptions,contentCategories,scenePairings,specialties} from './profileOptions';

const input='w-full min-w-0 rounded-xl bg-[var(--cc-surface-subtle)] border border-[var(--cc-border)] px-3 py-2.5 text-[var(--cc-text-primary)] focus:outline-none focus:ring-2 focus:ring-fuchsia-500';
const panel='ccx-surface space-y-4 p-5';
const initial={gender_identity:'',sexual_orientation:'',pronouns:'',gender_self_description:'',
 orientation_self_description:'',preferred_collaborators:[],content_categories:[],
 scene_pairings:[],specialties:[],available_to_travel:false,
 show_gender_in_discovery:false,show_categories_in_discovery:false};
function CheckList({label,options,selected,change}){
 const toggle=value=>change(selected.includes(value)?selected.filter(item=>item!==value):[...selected,value]);
 return <fieldset><legend className="mb-2 text-sm font-semibold text-[var(--cc-text-primary)]">{label}</legend>
  <div className="flex flex-wrap gap-2">{options.map(([value,name])=>{
   const active=selected.includes(value);
   return <button type="button" key={value} aria-pressed={active} onClick={()=>toggle(value)}
    className="rounded-lg border px-3 py-2 text-sm leading-5 transition hover:-translate-y-0.5"
    style={{background:active?'var(--cc-surface-hover)':'transparent',borderColor:active?'var(--cc-link)':'var(--cc-border)',color:active?'var(--cc-blue)':'var(--cc-text-secondary)'}}>{name}</button>;
  })}</div></fieldset>;
}
export default function CreatorProfileEditor({user,profile,onSaved,approved=false,paid=false,isAdmin=false,onNavigate}){
 const [form,setForm]=useState({display_name:profile?.display_name||'',
  role_type:profile?.role_type||'creator',real_name:profile?.real_name||'',stage_name:profile?.stage_name||'',
  company_name:profile?.company_name||'',representative_name:profile?.representative_name||'',bio:profile?.bio||'',
  city:profile?.city||'',state:profile?.state||'',
  country:countryCode(profile?.country||'US')});
 const [prefs,setPrefs]=useState(initial);
 const [creatorPrefs,setCreatorPrefs]=useState(initialCreatorPreferences);
 const [editing,setEditing]=useState(true);
 const [activeTab,setActiveTab]=useState('profile');
 const [openSection,setOpenSection]=useState(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [uploading,setUploading]=useState('');
 const [assetPreview,setAssetPreview]=useState({avatar:profile?.avatar_path?.startsWith('https://')?profile.avatar_path:'',cover:profile?.cover_url?.startsWith('https://')?profile.cover_url:''});
 const update=(key,value)=>setForm(old=>({...old,[key]:value}));
 const preference=(key,value)=>setPrefs(old=>({...old,[key]:value}));
 const uploadProfileAsset=async(kind,event)=>{
  const file=event.target.files?.[0];if(!file)return;
  setUploading(kind);setError('');setNotice('');
  try{
   if(file.size>10*1024*1024)throw new Error('Profile images must be 10 MB or smaller.');
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a JPEG, PNG, or WEBP image.');
   const extension=file.type.split('/')[1];
   const path=`${user.id}/profile/${kind}-${crypto.randomUUID()}.${extension}`;
   const {error:storageError}=await supabase.storage.from('member-private').upload(path,file,{contentType:file.type,upsert:false});
   if(storageError)throw storageError;
   const {data:signed,error:signedError}=await supabase.storage.from('member-private').createSignedUrl(path,3600);
   if(signedError||!signed?.signedUrl)throw signedError||new Error('Image preview unavailable.');
   const column=kind==='avatar'?'avatar_path':'cover_path';
   const {error:profileError}=await supabase.from('member_profiles').update({[column]:path,updated_at:new Date().toISOString()}).eq('id',user.id);
   if(profileError)throw profileError;
   setAssetPreview(old=>({...old,[kind]:signed.signedUrl}));setNotice(`${kind==='avatar'?'Profile photo':'Profile banner'} updated.`);
   if(onSaved)await onSaved();
  }catch(e){setError('Could not update this profile image.');console.error('profile image upload failed',e);}
  finally{setUploading('');event.target.value='';}
 };
 useEffect(()=>{
  let mounted=true;
  void (async()=>{
   try{
    const [profilePreferences,creatorPreferences]=await Promise.all([
     supabase.from('member_profile_preferences').select('*').eq('user_id',user.id).maybeSingle(),
     supabase.from('creator_production_preferences').select('*').eq('user_id',user.id).maybeSingle()
    ]);
    if(!mounted)return;
    if(profilePreferences.error||creatorPreferences.error)
     setError(profilePreferences.error?.message||creatorPreferences.error?.message);
    else{
     if(profilePreferences.data)setPrefs({...initial,...profilePreferences.data});
     if(creatorPreferences.data)setCreatorPrefs({...initialCreatorPreferences,...creatorPreferences.data});
    }
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
    real_name:form.real_name.trim().slice(0,120),stage_name:form.stage_name.trim().slice(0,120),
    company_name:form.company_name.trim().slice(0,120),representative_name:form.representative_name.trim().slice(0,120),
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
   if(form.role_type==='creator'){
    const creatorDetails={user_id:user.id,
     ...Object.fromEntries(Object.keys(initialCreatorPreferences).map(key=>[key,creatorPrefs[key]??initialCreatorPreferences[key]])),
     updated_at:new Date().toISOString()};
    const {error:creatorError}=await supabase.from('creator_production_preferences')
     .upsert(creatorDetails,{onConflict:'user_id'});
    if(creatorError)throw creatorError;
   }
   setNotice('Your profile and private preferences were saved.');
   setEditing(false);
   if(onSaved)await onSaved();
  }catch(e){setError(e.message);}finally{setSaving(false);}
 };
 return <div className="min-h-screen pb-20 md:pb-8" style={{background:'var(--cc-bg)',color:'var(--cc-text-primary)'}}>
  <div className="relative">
   <label className="group relative block h-48 cursor-pointer overflow-hidden md:h-64" style={{background:'var(--cc-surface-subtle)'}}>
    {assetPreview.cover&&<img src={assetPreview.cover} alt="Profile banner" className="h-full w-full object-cover"/>}
    <span className="absolute inset-0 grid place-items-center bg-black/45 text-sm text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"><span className="flex items-center gap-2"><Upload size={16}/>{uploading==='cover'?'Uploading…':'Change banner'}</span></span>
    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>uploadProfileAsset('cover',e)} disabled={Boolean(uploading)}/>
   </label>
   <div className="mx-auto max-w-4xl px-4">
    <div className="relative -mt-16 flex flex-col items-center gap-4 md:-mt-20">
     <label className="group relative grid h-32 w-32 cursor-pointer place-items-center overflow-hidden rounded-full border-4 text-5xl font-bold md:h-40 md:w-40"
      style={{backgroundColor:'var(--cc-surface)',borderColor:'var(--cc-bg)',color:'var(--cc-blue)'}}>
      {assetPreview.avatar?<img src={assetPreview.avatar} alt="Profile photo" className="h-full w-full object-cover"/>:
        (form.display_name||'U').slice(0,1).toUpperCase()}
      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
       <span className="flex items-center gap-2 text-sm"><Upload size={16}/>{uploading==='avatar'?'Uploading…':'Change photo'}</span>
      </span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>uploadProfileAsset('avatar',e)} disabled={Boolean(uploading)}/>
     </label>
     <div className="text-center">
      <h1 className="text-2xl font-bold">{form.display_name||'Set up your profile'}</h1>
      <div className="mt-2 flex items-center justify-center gap-2">
       <span className="rounded-full border px-3 py-1 text-xs capitalize"
        style={{borderColor:'var(--cc-border)'}}>{form.role_type.replaceAll('_',' ')}</span>
       {approved&&<span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-800">
        <ShieldCheck size={13}/>Verified</span>}
      </div>
      <button type="button" onClick={()=>setOpenSection('basic')}
       className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--cc-text-primary)]"
       style={{background:'var(--cc-action)',color:'var(--cc-on-action)'}}><Edit2 size={16}/>Edit profile</button>
     </div>
    </div>
   </div>
  </div>
  <div className="mx-auto mt-6 max-w-4xl px-4">
   <div role="tablist" aria-label="Profile sections" className="mb-6 grid grid-cols-3 gap-2 border-b pb-2"
    style={{borderColor:'var(--cc-border)'}}>
    {[{key:'profile',name:'Profile',Icon:User},{key:'galleries',name:'Galleries',Icon:Image},
      {key:'analytics',name:'Analytics',Icon:Activity}].map(({key,name,Icon})=>
     <button type="button" key={key} role="tab" aria-selected={activeTab===key}
      className="flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium"
      style={{background:activeTab===key?'var(--cc-surface-hover)':'transparent',
       color:activeTab===key?'var(--cc-blue)':'var(--cc-text-secondary)'}}
      onClick={()=>setActiveTab(key)}><Icon size={17}/>{name}</button>)}
   </div>
   {error&&<p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>}
   {notice&&<p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
   {activeTab==='profile'&&<form className="space-y-4" onSubmit={save}>
   {[
     {id:'basic',title:'Basic information',description:'Name, role, location',Icon:User,color:'var(--cc-link)',bg:'var(--cc-surface-hover)'},
     {id:'identity',title:'Personal identity',description:'Identity and privacy',Icon:Heart,color:'var(--cc-text-secondary)',bg:'rgba(255,138,222,0.12)'},
     {id:'collaboration',title:'Collaboration',description:'Matching and travel',Icon:Users,color:'#10B981',bg:'rgba(16,185,129,0.12)'},
     {id:'production',title:'Production details',description:'Acts, positioning and rates',Icon:Clapperboard,color:'#F59E0B',bg:'rgba(245,158,11,0.12)'},
     {id:'health',title:'Health & testing',description:'Private clearance records',Icon:Stethoscope,color:'#EF4444',bg:'rgba(239,68,68,0.12)'},
     {id:'privacy',title:'Discoverability',description:'Visibility controls',Icon:Lock,color:'#14B8A6',bg:'rgba(20,184,166,0.12)'}
   ].filter(card=>!(card.id==='collaboration'&&form.role_type==='host')).map(({id,title,description,Icon,color,bg})=>{
    const isOpen=openSection===id;
    return <div key={id} className="overflow-hidden rounded-2xl border" style={{borderColor:isOpen?color:'var(--cc-border)',background:'var(--cc-surface)',transition:'border-color 0.2s'}}>
     <button type="button" onClick={()=>setOpenSection(isOpen?null:id)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={isOpen}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{backgroundColor:bg,color}}><Icon size={20}/></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold" style={{color:'var(--cc-text-primary)'}}>{title}</span><span className="mt-0.5 block text-xs leading-5" style={{color:'var(--cc-text-secondary)'}}>{description}</span></span>
      <ChevronDown size={20} className="shrink-0 transition-transform duration-200" style={{color:'var(--cc-text-secondary)',transform:isOpen?'rotate(180deg)':'rotate(0deg)'}}/>
     </button>
     {isOpen&&<div className="space-y-5 border-t px-5 pb-5 pt-4" style={{borderColor:'var(--cc-border)'}}>
      {id==='basic'&&<>
        <section className={panel}><h3 className="text-lg font-semibold">Professional details</h3>
         <label className="block text-sm">Professional role
          <select className={input+' mt-2'} value={form.role_type} onChange={e=>update('role_type',e.target.value)}>
           {roleOptions.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
         {form.role_type==='creator'&&<>
          <label className="block text-sm">Real name<input className={input+' mt-2'} value={form.real_name} maxLength={120} onChange={e=>update('real_name',e.target.value)} required/></label>
          <label className="block text-sm">Stage name<input className={input+' mt-2'} value={form.stage_name} maxLength={120} onChange={e=>update('stage_name',e.target.value)}/></label>
         </>}
         {form.role_type==='studio'&&<>
          <label className="block text-sm">Studio name<input className={input+' mt-2'} value={form.company_name} maxLength={120} onChange={e=>update('company_name',e.target.value)} required/></label>
          <label className="block text-sm">Studio representative<input className={input+' mt-2'} value={form.representative_name} maxLength={120} onChange={e=>update('representative_name',e.target.value)} required/></label>
         </>}
         {form.role_type!=='creator'&&form.role_type!=='studio'&&<>
          <label className="block text-sm">Company name (optional)<input className={input+' mt-2'} value={form.company_name} maxLength={120} onChange={e=>update('company_name',e.target.value)}/></label>
          <label className="block text-sm">Real name<input className={input+' mt-2'} value={form.real_name} maxLength={120} onChange={e=>update('real_name',e.target.value)} required/></label>
         </>}
         <label className="block text-sm">Professional display name<input className={input+' mt-2'} value={form.display_name} maxLength={100}
          onChange={e=>update('display_name',e.target.value)} required/></label>
         <label className="block text-sm">About you<textarea className={input+' mt-2'} rows={5} maxLength={2000}
          value={form.bio} onChange={e=>update('bio',e.target.value)}
          placeholder="Introduce your work, experience and what you're looking to create."/></label>
        </section>
        <section className={panel}><h3 className="text-lg font-semibold">Location</h3>
         <p className="text-xs text-[var(--cc-text-secondary)]">Only city, state or region, and country are shared in discovery. Never enter your exact address here.</p>
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
          <label className="block text-sm">City
           {form.country==='US'&&originalUSCities[originalUSStateCodes[form.state]]?.length>0&&
            <select className={input+' mt-2'} value={originalUSCities[originalUSStateCodes[form.state]].includes(form.city)?form.city:''}
             onChange={e=>update('city',e.target.value)}>
             <option value="">Select a city or enter another below</option>
             {originalUSCities[originalUSStateCodes[form.state]].map(city=><option key={city} value={city}>{city}</option>)}
            </select>}
           <input className={input+' mt-2'} value={form.city}
            onChange={e=>update('city',e.target.value)} maxLength={100} placeholder="City or other city"/>
          </label>
         </div>
        </section>
      </>}
      {id==='identity'&&<section className={panel}><h3 className="text-lg font-semibold">Personal identity</h3>
       <p className="text-sm text-[var(--cc-text-secondary)]">All fields are optional. Identity and orientation are private by default and never required to register.</p>
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
      </section>}
      {id==='collaboration'&&form.role_type!=='host'&&<section className={panel}><h3 className="text-lg font-semibold">Collaboration preferences</h3>
       <p className="text-sm text-[var(--cc-text-secondary)]">Selections indicate interest only. They are not consent to any activity or booking.</p>
       <CheckList label="Preferred collaborators" options={genderOptions.filter(([v])=>v&&v!=='self_describe')}
        selected={prefs.preferred_collaborators} change={v=>preference('preferred_collaborators',v)}/>
       <CheckList label="Content categories" options={contentCategories}
        selected={prefs.content_categories} change={v=>preference('content_categories',v)}/>
       {form.role_type!=='creator'&&form.role_type!=='host'&&<CheckList label="Scene / creative formats" options={scenePairings}
        selected={prefs.scene_pairings} change={v=>preference('scene_pairings',v)}/>}
       <CheckList label="Professional specialties" options={specialties}
        selected={prefs.specialties} change={v=>preference('specialties',v)}/>
       <button type="button" aria-pressed={prefs.available_to_travel} onClick={()=>preference('available_to_travel',!prefs.available_to_travel)}
        className="rounded-lg border px-3 py-2 text-left text-sm transition"
        style={{background:prefs.available_to_travel?'rgba(16,185,129,.15)':'transparent',borderColor:prefs.available_to_travel?'#10B981':'var(--cc-border)',color:prefs.available_to_travel?'var(--cc-success)':'var(--cc-text-secondary)'}}>Available to travel for collaborations</button>
      </section>}
      {id==='production'&&form.role_type==='creator'&&<OriginalCreatorPreferences value={creatorPrefs}
        genderIdentity={prefs.gender_identity} onChange={setCreatorPrefs} onNavigate={onNavigate}/>}
      {id==='production'&&form.role_type!=='creator'&&<section className={panel}><h3 className="text-lg font-semibold">Professional details</h3><p className="text-sm text-[var(--cc-text-secondary)]">Add the specialties and services that describe your {form.role_type.replaceAll('_',' ')} role.</p><CheckList label="Professional specialties" options={specialties} selected={prefs.specialties} change={v=>preference('specialties',v)}/></section>}
      {id==='health'&&<section className={panel}><h3 className="text-lg font-semibold">Health & testing</h3>
       <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>Sensitive work-clearance records are controlled by the verified Trust & Readiness workflow, not saved in public profile fields.</p>
       <button type="button" className="mt-2 text-sm font-semibold" style={{color:'var(--cc-blue)'}}
        onClick={()=>onNavigate?.('testing')}>Manage testing and clearance</button>
      </section>}
      {id==='privacy'&&<section className={panel}><h3 className="text-lg font-semibold">Discoverability & privacy</h3>
       <p className="text-sm text-[var(--cc-text-secondary)]">Your name, professional role and general location appear only to eligible verified members. Sensitive matching details are never exposed unless you choose to share them.</p>
       <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={prefs.show_gender_in_discovery} onClick={()=>preference('show_gender_in_discovery',!prefs.show_gender_in_discovery)}
         className="rounded-lg border px-3 py-2 text-left text-sm transition"
         style={{background:prefs.show_gender_in_discovery?'rgba(20,184,166,.15)':'transparent',borderColor:prefs.show_gender_in_discovery?'#14B8A6':'var(--cc-border)',color:prefs.show_gender_in_discovery?'var(--cc-success)':'var(--cc-text-secondary)'}}>Show my gender identity in verified creator searches</button>
        <button type="button" aria-pressed={prefs.show_categories_in_discovery} onClick={()=>preference('show_categories_in_discovery',!prefs.show_categories_in_discovery)}
         className="rounded-lg border px-3 py-2 text-left text-sm transition"
         style={{background:prefs.show_categories_in_discovery?'rgba(20,184,166,.15)':'transparent',borderColor:prefs.show_categories_in_discovery?'#14B8A6':'var(--cc-border)',color:prefs.show_categories_in_discovery?'var(--cc-success)':'var(--cc-text-secondary)'}}>Show my content categories and specialties in verified creator searches</button>
       </div>
       <p className="text-xs text-[var(--cc-text-secondary)]">Your sexual orientation, self-descriptions and collaborator preferences are not published in discovery.</p>
      </section>}
     </div>}
    </div>;
   })}
   <div className="flex justify-center pt-2">
    <button id="profile-save" type="submit" disabled={saving||loading} className="ccx-primary rounded-xl px-8 py-3 font-semibold shadow-lg disabled:opacity-50">
     {saving?'Saving…':loading?'Loading profile…':'Save profile changes'}</button>
   </div>
  </form>}
   {activeTab==='galleries'&&<MediaGallery userId={user.id} paid={paid} admin={isAdmin}/>}
   {activeTab==='analytics'&&<ProfileAnalytics/>}
   {activeTab==='profile'&&<div className="mt-5"><MemberSocialLinks userId={user.id}/></div>}
  </div>
 </div>;
}
