import {supabase} from '@/api/supabaseClient';
export async function membershipCall(action,values={}){
 const {data,error}=await supabase.functions.invoke('membership-billing',{body:{action,...values}});
 if(error||data?.error){
  let message=data?.error||'Billing is temporarily unavailable';
  if(error?.context?.json)try{message=(await error.context.json())?.error||message;}catch{}
  throw Error(message);
 }
 return data;
}
