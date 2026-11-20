/** OpenAI calls go through the authenticated Edge gateway. No API key in Bolt. */
import {supabase} from '@/api/supabaseClient';
export async function creatorAi(action,body={}){
 const {data,error}=await supabase.functions.invoke('creator-ai',{body:{action,...body}});
 if(error||data?.error){
  let message=data?.error||'AI feature temporarily unavailable';
  if(error?.context?.json)try{message=(await error.context.json())?.error||message;}catch{}
  throw Error(message);
 }
 return data;
}
