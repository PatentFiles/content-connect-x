import {supabase} from '@/api/supabaseClient';
/** One authenticated gateway for collaboration, conversation and community-group meetings. */
export async function meetingAction(action,scope,scope_id,params={}){
 const {data,error}=await supabase.functions.invoke('meeting-suite',{body:{action,scope,scope_id,...params}});
 if(error||data?.error){
  let message=data?.error||error?.message||'Meeting service unavailable';
  if(error?.context?.json)try{message=(await error.context.json())?.error||message;}catch{/* retain original */}
  throw Error(message);
 }
 return data;
}
