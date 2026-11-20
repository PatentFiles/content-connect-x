import {supabase} from '@/api/supabaseClient';
/** Single authenticated gateway. AI and media provider secrets remain server-side. */
export async function suiteAction(action,args={}){
 const {data,error}=await supabase.functions.invoke('collab-suite',{body:{action,...args}});
 if(error||data?.error){
  let message=data?.error||error?.message||'Collaboration service unavailable';
  if(error?.context?.json){try{const payload=await error.context.json();message=payload?.error||message;}catch{/* original error */}}
  throw new Error(message);
 }
 return data;
}