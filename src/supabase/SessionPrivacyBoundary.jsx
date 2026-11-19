import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
/** Clear in-memory private views when the account changes. Token refresh alone
 * does not reset unsaved work. Staff case views also clear when hidden or idle.
 */
export default function SessionPrivacyBoundary({children}){
 const [epoch,setEpoch]=useState(0),lastAccount=useRef(undefined);
 useEffect(()=>{
  if(!supabase)return;
  const {data}=supabase.auth.onAuthStateChange((event,session)=>{
   const next=session?.user?.id||null;
   if(event==='SIGNED_OUT'||lastAccount.current!==undefined&&lastAccount.current!==next)setEpoch(v=>v+1);
   lastAccount.current=next;
  });
  return()=>data?.subscription?.unsubscribe();
 },[]);
 useEffect(()=>{
  if(window.location.pathname.replace(/\/+$/,'')!=='/trust/review')return;
  let timer;
  const clearView=()=>setEpoch(v=>v+1);
  const touch=()=>{window.clearTimeout(timer);timer=window.setTimeout(clearView,600000);};
  const hidden=()=>{if(document.hidden)clearView();};
  touch();window.addEventListener('pointerdown',touch);window.addEventListener('keydown',touch);document.addEventListener('visibilitychange',hidden);
  return()=>{window.clearTimeout(timer);window.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',touch);document.removeEventListener('visibilitychange',hidden);};
 },[]);
 return <React.Fragment key={epoch}>{children}</React.Fragment>;
}
