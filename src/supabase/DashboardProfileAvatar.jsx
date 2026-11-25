/** Resolve the signed-in member's private avatar without exposing storage paths. */
import React,{useEffect,useState} from 'react';
import {supabase} from '@/api/supabaseClient';

export default function DashboardProfileAvatar({profile,userId,className='h-14 w-14'}){
 const path=profile?.avatar_path||profile?.avatar_url||'';
 const [url,setUrl]=useState('');
 useEffect(()=>{
  let active=true;setUrl('');
  if(!path)return ()=>{active=false;};
  if(/^https:\/\//.test(path)||(profile?.demo===true&&path.startsWith('/demo-assets/'))){setUrl(path);return ()=>{active=false;};}
  if(!userId||!path.startsWith(userId+'/profile/'))return ()=>{active=false;};
  void supabase.storage.from('member-private').createSignedUrl(path,600).then(({data,error})=>{
   if(active&&!error)setUrl(data?.signedUrl||'');
  }).catch(()=>{if(active)setUrl('');});
  return ()=>{active=false;};
 },[path,userId,profile?.demo]);
 return <span className={'grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--cc-border)] bg-[var(--cc-surface-hover)] text-lg font-bold text-[var(--cc-blue)] '+className}>
  {url?<img src={url} alt="" className="h-full w-full object-cover"/>:
   (profile?.display_name||'U').trim().slice(0,1).toUpperCase()}
 </span>;
}
