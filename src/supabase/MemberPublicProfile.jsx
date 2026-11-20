/** Owner-only, read-only version of the same publicly shareable profile fields used by Discovery. */
import React,{useCallback,useEffect,useState} from 'react';
import {ArrowLeft,MapPin,ShieldCheck,RefreshCw,UserRound} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
const roleTitle=v=>String(v||'professional').replaceAll('_',' ');
export default function MemberPublicProfile({onNavigate}){
 const [profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('directory',{body:{action:'my_public_profile'}});
   if(failure||data?.error||!data?.item)throw Error(data?.error||failure?.message||'Public profile preview unavailable');
   setProfile(data.item);
  }catch(e){setError(e.message||'Unable to load profile');setProfile(null);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 return <section className="mx-auto max-w-4xl space-y-5" data-member-public-profile="true">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><h1 className="text-2xl font-bold">Your public profile</h1><p className="text-sm text-[var(--cc-text-secondary)]">This is the information verified members can see in Discovery.</p></div>
   <div className="flex flex-wrap gap-2"><button type="button" className="ccx-secondary rounded-xl px-4 py-2 text-sm" onClick={()=>void reload()} disabled={loading}><RefreshCw size={16} className="mr-1 inline"/>Refresh</button><button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" onClick={()=>onNavigate('profile')}><ArrowLeft size={16} className="mr-1 inline"/>Edit my profile</button></div>
  </header>
  {loading&&<p role="status" className="ccx-surface rounded-xl p-5 text-sm">Loading your public profile…</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {profile&&!loading&&<article className="ccx-surface overflow-hidden rounded-2xl">
   <div className="relative h-44 sm:h-60" style={{background:'var(--cc-surface-hover)'}}>
    {profile.cover_url&&<img alt="" src={profile.cover_url} className="h-full w-full object-cover"/>}
   </div>
   <div className="space-y-5 p-5 sm:p-7">
    <div className="-mt-14 flex flex-wrap items-end gap-4">
     <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[var(--cc-surface)] bg-[var(--cc-surface-hover)]">
      {profile.avatar_url?<img src={profile.avatar_url} alt={profile.display_name+' profile photo'} className="h-full w-full object-cover"/>:<UserRound size={36} aria-hidden="true"/>}
     </div>
     <div className="min-w-0 flex-1 pb-2"><h2 className="break-words text-xl font-bold">{profile.display_name||'Profile name not set'}</h2><p className="text-sm capitalize text-[var(--cc-text-secondary)]">{roleTitle(profile.role_type)}</p></div>
     {profile.age_verified&&<span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 px-3 py-1 text-xs"><ShieldCheck size={14}/>Verified adult</span>}
    </div>
    <p className="flex items-center gap-2 text-sm text-[var(--cc-text-secondary)]"><MapPin size={16}/>{[profile.city,profile.state,profile.country].filter(Boolean).join(', ')||'Location not shared'}</p>
    <section><h3 className="mb-2 font-semibold">About</h3><p className="whitespace-pre-wrap break-words text-sm">{profile.bio||'No public bio yet.'}</p></section>
    {(profile.gender_identity||profile.sexual_orientation)&&<section className="space-y-2"><h3 className="font-semibold">Shared identity details</h3>
     {profile.gender_identity&&<p className="text-sm capitalize">Gender identity: {profile.gender_identity.replaceAll('_',' ')}</p>}
     {profile.sexual_orientation&&<p className="text-sm capitalize">Orientation: {profile.sexual_orientation.replaceAll('_',' ')}</p>}
    </section>}
    {!!profile.content_categories?.length&&<section><h3 className="mb-2 font-semibold">Public collaboration categories</h3><div className="flex flex-wrap gap-2">{profile.content_categories.map(category=><span key={category} className="rounded-full border border-[var(--cc-border)] px-3 py-1 text-xs capitalize">{String(category).replaceAll('_',' ')}</span>)}</div></section>}
    {!profile.profile_complete&&<p className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm">Your profile is not marked complete yet. Only fields you choose to make visible will be shown in public discovery when eligible.</p>}
   </div>
  </article>}
 </section>;
}
