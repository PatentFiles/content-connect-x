/** Per-session demo state: no persistent browser cache, no real writes. */
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/api/supabaseClient';
export function useAdminDemo(userId,allowed){
 const [record,setRecord]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 const permitted=useRef({userId,allowed});permitted.current={userId,allowed};
 const enabled=Boolean(allowed&&userId&&record?.owner===userId);
 const stop=()=>{generation.current++;setRecord(null);setBusy(false);setError('');};
 useEffect(()=>{stop();},[userId,allowed]);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false;
  const id=window.setInterval(async()=>{
   try{
    const r=await supabase.functions.invoke('admin-demo-data',{body:{action:'snapshot'}});
    if(!cancelled&&(r.error||r.data?.demo!==true))stop();
   }catch{if(!cancelled)stop();}
  },60000);
  return()=>{cancelled=true;window.clearInterval(id);};
 },[enabled,userId]);
 const toggle=async()=>{
  if(enabled){stop();return;}
  if(!allowed||!userId||busy)return;
  const request=++generation.current;setBusy(true);setError('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('admin-demo-data',{body:{action:'snapshot'}});
   if(failure||data?.demo!==true||data?.read_only!==true||!Array.isArray(data.properties)||!Array.isArray(data.profiles))throw Error('Administrator demo data is unavailable.');
   if(request===generation.current&&permitted.current.allowed&&permitted.current.userId===userId)setRecord({owner:userId,data});
  }catch(e){if(request===generation.current)setError(e.message);}
  finally{if(request===generation.current)setBusy(false);}
 };
 return {enabled,busy,error,toggle,data:enabled?record.data:null,stop};
}
