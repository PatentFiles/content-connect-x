import {supabase} from '@/api/supabaseClient';
/** No worker credentials, file URLs or verification verdicts enter browser storage. */
export async function identityAction(action,values={}){
 const {data,error}=await supabase.functions.invoke('identity-verification',{body:{action,...values}});
 if(error||data?.error){
  let message=data?.error||'Identity verification could not be completed.';
  if(error?.context?.json)try{const result=await error.context.json();if(result?.error)message=result.error;}catch{}
  throw new Error(message);
 }
 return data;
}
export async function identityUpload(sessionId,kind,file){
 const body=new FormData();body.append('session_id',sessionId);body.append('kind',kind);body.append('file',file);
 const {data,error}=await supabase.functions.invoke('identity-verification',{body});
 if(error||data?.error){
  let message=data?.error||'The evidence upload could not be completed.';
  if(error?.context?.json)try{const result=await error.context.json();if(result?.error)message=result.error;}catch{}
  throw new Error(message);
 }
 return data;
}
