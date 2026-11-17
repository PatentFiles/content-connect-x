import {supabase} from '@/api/supabaseClient';
import {functionErrorMessage} from './apiErrors.mjs';
export async function integrationAction(action,payload={}){
 const {data,error}=await supabase.functions.invoke('ccx-integrations',{body:{action,...payload}});
 if(error||data?.error)throw new Error(await functionErrorMessage(error,data,'Integration service unavailable'));
 return data;
}
