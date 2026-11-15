/** Authenticated integration administration; secrets are never cached locally. */
import {supabase} from '@/api/supabaseClient';
export async function integrationAction(action,values={}){
 const {data,error}=await supabase.functions.invoke('ccx-integrations',{body:{action,...values}});
 if(error||data?.error){
  let message=data?.error||error?.message||'Provider is not available';
  if(error?.context?.json)try{const v=await error.context.json();if(v?.error)message=v.error;}catch{}
  throw new Error(message);
 }
 return data;
}
