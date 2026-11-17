import {supabase} from '@/api/supabaseClient';
/** Member navigation uses a small authenticated DB RPC. A failure is never
 * replaced with fabricated enabled flags. Privileged actions retain the Edge API. */
export async function platformAction(action,data={}){
 if(action==='get_feature_flags'){
  const {data:result,error}=await supabase.rpc('ccx_member_feature_flags');
  if(error)throw new Error(error.message||'Unable to load module settings');
  if(!result?.flags)throw new Error('Module settings response was incomplete');
  return result;
 }
 const {data:result,error}=await supabase.functions.invoke('platform-extras',{body:{action,...data}});
 if(error||result?.error){
  let reason=result?.error||error?.message||'This feature is temporarily unavailable';
  if(error?.context?.json){try{const body=await error.context.json();if(typeof body?.error==='string')reason=body.error;}catch{/* retain original error */}}
  throw new Error(reason);
 }
 return result;
}
