/** One portrait card shared by Discovery, city Search and Favorites. */
import React,{useEffect,useState} from 'react';
import {Heart,MapPin,ShieldCheck} from 'lucide-react';
import {roleTitle} from './roleWorkspacePolicy.mjs';
export default function MemberDiscoveryCard({person,saved=false,busy=false,canFavorite=true,onFavorite,onClick}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>{setFailed(false);},[person.avatar_url]);
 const photo=typeof person.avatar_url==='string'&&person.avatar_url.startsWith('https://')?person.avatar_url:null;
 return <article className="ccx-surface overflow-hidden transition-colors hover:border-[#4F8CFF]">
  <div className="relative h-80 bg-gradient-to-br from-[#4F8CFF]/30 to-[#FF2DAA]/30">
   <button type="button" className="absolute inset-0 block h-full w-full text-left" onClick={onClick} aria-label={'View profile of '+person.display_name}>
    {photo&&!failed?<img src={photo} alt={person.display_name} loading="lazy" onError={()=>setFailed(true)} className="h-full w-full object-cover"/>:<span className="flex h-full items-center justify-center"><span className="grid h-24 w-24 place-items-center rounded-full bg-[#263248] text-4xl text-[#9AA6BC]">{(person.display_name||'?').slice(0,1).toUpperCase()}</span></span>}
    <span className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/30 to-transparent"/>
    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-[#E8EEF9] backdrop-blur-sm">{roleTitle(person.role_type)}</span>
    <span className="absolute inset-x-0 bottom-0 space-y-2 p-4"><span className="flex items-center gap-2">{person.age_verified&&<ShieldCheck size={19} className="shrink-0 text-[#4F8CFF]"/>}<span className="text-lg font-bold text-white">{person.display_name}</span></span><span className="flex items-center gap-1.5 text-sm text-white/90"><MapPin size={14}/>{[person.city,person.state,person.country].filter(Boolean).join(', ')||'Location not provided'}</span></span>
   </button>
   {canFavorite&&<button type="button" onClick={onFavorite} disabled={busy} aria-label={(saved?'Remove favorite: ':'Add favorite: ')+person.display_name} aria-pressed={saved} title={saved?'Remove from favorites':'Save to favorites'} className="absolute right-3 top-3 z-10 rounded-full border border-white/20 bg-black/70 p-3 text-white backdrop-blur-sm disabled:opacity-50"><Heart size={19} fill={saved?'currentColor':'none'} className={saved?'text-[#FF81D4]':''}/></button>}
  </div>
  <div className="space-y-3 p-4">{person.bio&&<p className="line-clamp-2 text-sm text-[#B4C5DC]">{person.bio}</p>}<button type="button" onClick={onClick} className="text-sm font-medium text-[#4F8CFF] underline underline-offset-4">View public profile</button></div>
 </article>;
}
