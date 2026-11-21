/** Read-only preview of what eligible, verified members are allowed to see.
 * Backend filters every section by existing visibility and approval rules.
 * Owner account data, documents and restricted communications never render here.
 */
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ArrowLeft,MapPin,ShieldCheck,RefreshCw,UserRound,ExternalLink,CalendarDays,ChevronLeft,ChevronRight,Image as ImageIcon} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import ConnectFeed from './ConnectFeed';
const roleTitle=value=>String(value||'professional').replaceAll('_',' ');
const prettyDate=value=>value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
const titleCase=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,ch=>ch.toUpperCase());
const panel='ccx-surface space-y-3 rounded-2xl p-5';
const calendarDays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function TravelCalendarPreview({dates=[]}){
 const [month,setMonth]=useState(()=>new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),1)));
 const cells=useMemo(()=>{
  const year=month.getUTCFullYear(),mon=month.getUTCMonth(),first=new Date(Date.UTC(year,mon,1)).getUTCDay();
  const length=new Date(Date.UTC(year,mon+1,0)).getUTCDate();
  return Array.from({length:first+length},(_,n)=>{
   const day=n-first+1;if(day<1)return null;
   const timestamp=Date.UTC(year,mon,day);
   const active=dates.filter(t=>Date.parse(t.starts_at)<=timestamp+86400000-1&&Date.parse(t.ends_at)>=timestamp);
   return {day,active};
  });
 },[month,dates]);
 const change=delta=>setMonth(m=>new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+delta,1)));
 return <section className={panel} aria-label="Travel calendar">
  <header className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><CalendarDays size={17}/>Travel calendar</h3>
   <div className="flex items-center gap-2"><button className="ccx-secondary rounded-lg p-2" type="button" onClick={()=>change(-1)} aria-label="Previous travel month"><ChevronLeft size={17}/></button>
    <strong className="min-w-32 text-center text-sm">{month.toLocaleString(undefined,{month:'long',year:'numeric',timeZone:'UTC'})}</strong>
    <button className="ccx-secondary rounded-lg p-2" type="button" onClick={()=>change(1)} aria-label="Next travel month"><ChevronRight size={17}/></button></div>
  </header>
  <div className="grid grid-cols-7 gap-1 text-center text-xs">{calendarDays.map(day=><div className="p-1 font-semibold" key={day}>{day}</div>)}
   {cells.map((cell,i)=>cell?<div key={i} className={'min-h-11 rounded-lg border p-1 '+(cell.active.length?'border-blue-300 bg-blue-50 text-slate-900':'border-[var(--cc-border)]')}>
    <span className="font-semibold">{cell.day}</span>{cell.active.length>0&&<p className="truncate text-[10px]" title={cell.active.map(t=>t.city).join(', ')}>{cell.active[0].city||'Travel'}</p>}
   </div>:<div key={i}/>)}
  </div>
  {dates.length?<ul className="space-y-2">{dates.slice(0,12).map(t=><li key={t.id} className="text-sm">
   <strong>{[t.city,t.region,t.country].filter(Boolean).join(', ')}</strong> · {prettyDate(t.starts_at)} – {prettyDate(t.ends_at)}
  </li>)}</ul>:<p className="text-sm text-[var(--cc-text-secondary)]">No upcoming trips shared with verified members.</p>}
 </section>;
}
function ApprovedGallery({ownerId}){
 const [items,setItems]=useState([]),[opened,setOpened]=useState({}),[busy,setBusy]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!ownerId)return;let live=true;
  const load=async()=>{
   setError('');try{
    const {data,error:failure}=await supabase.functions.invoke('media-gateway',{body:{action:'gallery',owner_id:ownerId}});
    if(failure||data?.error)throw Error(data?.error||'Approved gallery is temporarily unavailable.');
    if(live)setItems(data?.items||[]);
   }catch(e){if(live)setError('Approved gallery could not be loaded. Try refreshing this profile.');}
  };
  void load();return()=>{live=false;};
 },[ownerId]);
 const reveal=async item=>{
  setBusy(item.id);setError('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('media-gateway',{body:{action:'view',id:item.id}});
   if(failure||data?.error||!data?.url)throw Error('Media unavailable');
   setOpened(old=>({...old,[item.id]:{url:data.url,mime_type:data.mime_type}}));
  }catch{setError('That media item cannot be opened. Access may have expired or been revoked.');}
  finally{setBusy('');}
 };
 return <section className={panel} aria-label="Approved galleries">
  <h3 className="flex items-center gap-2 font-semibold"><ImageIcon size={17}/>Galleries</h3>
  <p className="text-xs text-[var(--cc-text-secondary)]">Only approved media shared with verified members is listed. Media files remain in private storage.</p>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {!items.length&&!error&&<p className="text-sm text-[var(--cc-text-secondary)]">No approved gallery items shared yet.</p>}
  <div className="grid gap-3 sm:grid-cols-2">{items.map(item=><article key={item.id} className="rounded-xl border border-[var(--cc-border)] p-3">
   {opened[item.id]?(opened[item.id].mime_type?.startsWith('video/')?
    <video controls preload="metadata" src={opened[item.id].url} className="w-full rounded-lg" />:
    <img src={opened[item.id].url} alt={item.caption||'Approved professional gallery media'} className="w-full rounded-lg object-contain" />):
    <button type="button" className="ccx-secondary w-full rounded-lg p-5 text-sm" disabled={Boolean(busy)} onClick={()=>void reveal(item)}>
     {busy===item.id?'Opening…':'View approved '+(item.mime_type?.startsWith('video/')?'video':'photo')}
    </button>}
   <p className="mt-2 break-words text-sm">{item.caption||'Professional media'}</p>
  </article>)}</div>
 </section>;
}
export default function MemberPublicProfile({onNavigate}){
 const [profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('directory',{body:{action:'my_public_profile'}});
   if(failure||data?.error||!data?.item)throw Error(data?.error||failure?.message||'Profile preview unavailable');
   setProfile(data.item);
  }catch(e){setError(e.message||'Unable to load profile');setProfile(null);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 return <section className="mx-auto max-w-5xl space-y-5" data-member-public-profile="true">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><h1 className="text-2xl font-bold">View Profile</h1><p className="text-sm text-[var(--cc-text-secondary)]">Preview of the professional details you have chosen to share with eligible verified members.</p></div>
   <div className="flex flex-wrap gap-2"><button type="button" className="ccx-secondary rounded-xl px-4 py-2 text-sm" onClick={()=>void reload()} disabled={loading}><RefreshCw size={16} className="mr-1 inline"/>Refresh</button><button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" onClick={()=>onNavigate('profile')}><ArrowLeft size={16} className="mr-1 inline"/>Edit profile</button></div>
  </header>
  {loading&&<p role="status" className="ccx-surface rounded-xl p-5 text-sm">Loading your profile…</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {profile&&!loading&&<>
   <article className="ccx-surface overflow-hidden rounded-2xl">
    <div className="relative h-44 sm:h-60" style={{background:'var(--cc-surface-hover)'}}>
     {profile.cover_url&&<img alt="" src={profile.cover_url} className="h-full w-full object-cover"/>}
    </div>
    <div className="space-y-5 p-5 sm:p-7">
     <div className="-mt-14 flex flex-wrap items-end gap-4">
      <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[var(--cc-surface)] bg-[var(--cc-surface-hover)]">
       {profile.avatar_url?<img src={profile.avatar_url} alt={(profile.display_name||'Member')+' profile photo'} className="h-full w-full object-cover"/>:<UserRound size={36} aria-hidden="true"/>}
      </div>
      <div className="min-w-0 flex-1 pb-2"><h2 className="break-words text-xl font-bold">{profile.display_name||'Profile name not set'}</h2><p className="text-sm capitalize text-[var(--cc-text-secondary)]">{roleTitle(profile.role_type)}</p></div>
      {profile.age_verified&&<span className="inline-flex items-center gap-1 rounded-full border border-emerald-400 px-3 py-1 text-xs"><ShieldCheck size={14}/>Verified adult</span>}
     </div>
     <p className="flex items-center gap-2 text-sm text-[var(--cc-text-secondary)]"><MapPin size={16}/>{[profile.city,profile.state,profile.country].filter(Boolean).join(', ')||'Location not shared'}</p>
     <section><h3 className="mb-2 font-semibold">About</h3><p className="whitespace-pre-wrap break-words text-sm">{profile.bio||'No public bio yet.'}</p></section>
     {(profile.stage_name||profile.company_name)&&<section className="grid gap-3 text-sm sm:grid-cols-2" aria-label="Basic information">
      {profile.stage_name&&<div><strong>Professional name</strong><p>{profile.stage_name}</p></div>}
      {profile.company_name&&<div><strong>Company / studio</strong><p>{profile.company_name}</p></div>}
     </section>}
     {(profile.gender_identity||profile.pronouns||profile.sexual_orientation)&&<section className="space-y-2"><h3 className="font-semibold">Shared identity details</h3>
      {profile.gender_identity&&<p className="text-sm capitalize">Gender identity: {roleTitle(profile.gender_identity)}</p>}
      {profile.pronouns&&<p className="text-sm">Pronouns: {profile.pronouns}</p>}
      {profile.sexual_orientation&&<p className="text-sm capitalize">Orientation: {roleTitle(profile.sexual_orientation)}</p>}
     </section>}
     {!!profile.content_categories?.length&&<section><h3 className="mb-2 font-semibold">Collaboration categories</h3><div className="flex flex-wrap gap-2">{profile.content_categories.map(item=><span key={item} className="rounded-full border border-[var(--cc-border)] px-3 py-1 text-xs capitalize">{roleTitle(item)}</span>)}</div></section>}
     {!profile.profile_complete&&<p className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm">Your profile is not yet marked complete. Only the details you choose to share appear to eligible members.</p>}
    </div>
   </article>
   <div className="grid gap-5 lg:grid-cols-2">
    <section className={panel} aria-label="Production details"><h3 className="font-semibold">Production details</h3>
     {!!profile.specialties?.length&&<div><p className="text-xs font-semibold">Specialties</p><p className="text-sm">{profile.specialties.map(titleCase).join(', ')}</p></div>}
     {profile.production?.availability_type&&<p className="text-sm">Availability: {titleCase(profile.production.availability_type)}</p>}
     {!!profile.production?.scene_pairings?.length&&<div><p className="text-xs font-semibold">Shared production interests</p><p className="text-sm">{profile.production.scene_pairings.map(titleCase).join(', ')}</p></div>}
     {!!profile.production?.travel_regions?.length&&<p className="text-sm">Travel regions: {profile.production.travel_regions.join(', ')}</p>}
     {!profile.specialties?.length&&!profile.production?.availability_type&&!profile.production?.scene_pairings?.length&&!profile.production?.travel_regions?.length&&<p className="text-sm text-[var(--cc-text-secondary)]">No production details selected for sharing.</p>}
    </section>
    <section className={panel} aria-label="Representation"><h3 className="font-semibold">Representation</h3>
     {profile.representatives?.length?profile.representatives.map(item=><div key={item.id} className="rounded-lg border border-[var(--cc-border)] p-3 text-sm">
      <strong>{item.display_name}</strong><p className="text-[var(--cc-text-secondary)]">{item.relationship} · {titleCase(item.role_type)}</p>
     </div>):<p className="text-sm text-[var(--cc-text-secondary)]">No active mutually accepted representation to display.</p>}
    </section>
    <TravelCalendarPreview dates={profile.travel_dates||[]}/>
    <section className={panel} aria-label="Social links"><h3 className="font-semibold">Professional social links</h3>
     {profile.social_links?.length?profile.social_links.map(item=><a key={item.platform} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-sm text-[var(--cc-link)] underline"><ExternalLink size={15}/>{titleCase(item.platform)}</a>):<p className="text-sm text-[var(--cc-text-secondary)]">No links shared with verified Premium members.</p>}
    </section>
    <section className={panel} aria-label="Featured portfolio"><h3 className="font-semibold">Featured portfolio</h3>
     {profile.featured_portfolio?.length?profile.featured_portfolio.map(item=><article key={item.id} className="rounded-xl border border-[var(--cc-border)] p-3">
      <strong>{item.title||titleCase(item.kind)}</strong><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.description}</p>
      {item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--cc-link)] underline"><ExternalLink size={14}/>View portfolio link</a>}
     </article>):<p className="text-sm text-[var(--cc-text-secondary)]">No featured portfolio items shared.</p>}
    </section>
    <section className={panel+' lg:col-span-2'} aria-label="Profile posts">
     <h3 className="font-semibold">Profile posts and reposts</h3>
     <ConnectFeed key={profile.id} userId={profile.id} profileId={profile.id} paid={false} preview/>
    </section>
   </div>
   <ApprovedGallery ownerId={profile.id}/>
   {!!profile.sections_unavailable?.length&&<p role="status" className="text-sm text-amber-800">Some optional profile sections could not be refreshed. Try again shortly.</p>}
  </>}
 </section>;
}
