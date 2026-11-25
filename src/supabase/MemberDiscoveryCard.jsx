/** One photo-led professional card shared by Discovery, Search and Favorites. */
import React,{useEffect,useState} from 'react';
import {Heart,MapPin,ShieldCheck} from 'lucide-react';
import {roleTitle} from './roleWorkspacePolicy.mjs';
export default function MemberDiscoveryCard({person,saved=false,busy=false,canFavorite=true,onFavorite,onClick}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>{setFailed(false);},[person.avatar_url]);
 const photo=typeof person.avatar_url==='string'&&(person.avatar_url.startsWith('https://')||person.avatar_url.startsWith('/demo-assets/'))?person.avatar_url:null;
 return <article className="ccx-surface overflow-hidden transition-colors hover:border-[var(--cc-border-hover)]">
  <div className="relative h-64 bg-[var(--cc-surface-subtle)]">
   <button type="button" className="absolute inset-0 block h-full w-full text-left" onClick={onClick} aria-label={'View profile of '+person.display_name}>
    {photo&&!failed?<img src={photo} alt={person.display_name} loading="lazy" onError={()=>setFailed(true)} className="h-full w-full object-cover"/>:<span className="flex h-full items-center justify-center"><span className="grid h-24 w-24 place-items-center rounded-full bg-white text-4xl text-[var(--cc-text-secondary)]">{(person.display_name||'?').slice(0,1).toUpperCase()}</span></span>}
    <span className="absolute left-3 top-3 rounded-md border border-[var(--cc-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--cc-text-primary)]">{roleTitle(person.role_type)}</span>
   </button>
   {canFavorite&&<button type="button" onClick={onFavorite} disabled={busy} aria-label={(saved?'Remove favorite: ':'Add favorite: ')+person.display_name} aria-pressed={saved} title={saved?'Remove from favorites':'Save to favorites'} className="absolute right-3 top-3 z-10 rounded-full border border-[var(--cc-border)] bg-white p-3 text-[var(--cc-text-primary)] disabled:opacity-50"><Heart size={19} fill={saved?'currentColor':'none'}/></button>}
  </div>
  <div className="space-y-3 p-5">
   <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{person.display_name}{Number.isFinite(person.profile_age)&&<span className="font-normal text-[var(--cc-text-secondary)]">, {person.profile_age}</span>}</h3>{person.age_verified&&<ShieldCheck size={17} className="shrink-0 text-emerald-800" aria-label="Age verified"/>}</div>
   <p className="flex items-start gap-1.5 text-sm text-[var(--cc-text-secondary)]"><MapPin size={15} className="mt-1 shrink-0"/>{[person.city,person.state,person.country].filter(Boolean).join(', ')||'Location not provided'}</p>
   {person.sexual_orientation&&<p className="text-xs font-medium capitalize text-[var(--cc-text-secondary)]">Orientation: {person.sexual_orientation}</p>}
    {person.bio&&<p className="line-clamp-2 text-sm text-[var(--cc-text-secondary)]">{person.bio}</p>}
   <button type="button" onClick={onClick} className="text-sm font-medium text-[var(--cc-link)] underline underline-offset-4">View public profile</button>
  </div>
 </article>;
}
