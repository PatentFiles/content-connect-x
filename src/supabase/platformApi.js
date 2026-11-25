import {supabase,liveSupabase} from '@/api/supabaseClient';
/** Availability and account eligibility are separate. Preserve the server's
 * explanation instead of presenting every failed prerequisite as a switch off. */
export async function platformAction(action,data={}){
 if(action==='get_feature_flags'){
  const {data:result,error}=await liveSupabase.rpc('ccx_member_feature_flags');
  if(error)throw new Error(error.message||'Unable to load module settings');
  if(!result?.flags||!result?.access||!result?.account)throw new Error('Module settings response was incomplete');
  return {...result,flags:{...result.flags,__ccxLoaded:true,__ccxAccess:result.access,__ccxAccount:result.account}};
 }
 const {data:result,error}=await supabase.functions.invoke('platform-extras',{body:{action,...data}});
 if(error||result?.error){
  let reason=result?.error||error?.message||'This feature is temporarily unavailable';
  if(error?.context?.json){try{const body=await error.context.json();if(typeof body?.error==='string')reason=body.error;}catch{/* retain original error */}}
  throw new Error(reason);
 }
 return result;
}
