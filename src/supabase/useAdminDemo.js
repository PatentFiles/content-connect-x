/** Administrator-authorized, session-only demo. Real authorization is revalidated
 * independently of the mocked data client; demo success never grants account access.
 */
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {liveSupabase} from '@/api/supabaseClient';
import assets from '../demo/approvedAssets.json';
import {startDemo,stopDemo,demoSnapshot,subscribeDemo,demoOwner} from '../demo/demoRuntime.mjs';
export function useAdminDemo(userId,allowed){
 const [record,setRecord]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [,setVersion]=useState(0),generation=useRef(0),permitted=useRef({userId,allowed});
 permitted.current={userId,allowed};
 const enabled=Boolean(allowed&&userId&&record?.owner===userId&&demoOwner()===userId);
 const stop=useCallback(()=>{generation.current++;stopDemo();setRecord(null);setBusy(false);setError('');},[]);
 useLayoutEffect(()=>{stop();return()=>{generation.current++;stopDemo();};},[userId,allowed,stop]);
 useEffect(()=>subscribeDemo(()=>setVersion(v=>v+1)),[]);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false;
  const validate=async()=>{try{
   const r=await liveSupabase.functions.invoke('admin-demo-data',{body:{action:'snapshot'}});
   if(!cancelled&&(r.error||r.data?.demo!==true||r.data?.read_only!==true))stop();
  }catch{if(!cancelled)stop();}};
  const timer=window.setInterval(validate,60000);
  return()=>{cancelled=true;window.clearInterval(timer);};
 },[enabled,userId,stop]);
 const toggle=async()=>{
  if(enabled){stop();return;}
  if(!allowed||!userId||busy)return;
  const request=++generation.current;setBusy(true);setError('');
  try{
   const {data,error:failure}=await liveSupabase.functions.invoke('admin-demo-data',{body:{action:'snapshot'}});
   if(failure||data?.demo!==true||data?.read_only!==true)throw Error('Administrator demo access could not be confirmed.');
   if(request===generation.current&&permitted.current.allowed&&permitted.current.userId===userId){
    startDemo(userId,assets);setRecord({owner:userId});
   }
  }catch(e){if(request===generation.current)setError(e.message);}
  finally{if(request===generation.current)setBusy(false);}
 };
 return {enabled,busy,error,toggle,data:enabled?demoSnapshot():null,stop};
}
