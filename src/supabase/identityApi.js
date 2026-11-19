import {supabase,supabaseConfiguration,requireSupabase} from '@/api/supabaseClient';
import {transferIdentityEvidence} from './identityTransfer.mjs';
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
/** Fixed endpoint allowlist and receipt validation live in the transport. The
 * normal browser publishable key and signed-in user's token are the only keys.
 * @param {{onProgress?: (progress: {phase:string,percent:number|null}) => void, signal?: AbortSignal}} options
 */
export function identityUploadTo(endpoint,sessionId,kind,file,options={}){
 const {onProgress,signal}=options;
 const client=requireSupabase();
 return transferIdentityEvidence({projectUrl:supabaseConfiguration.url,publicKey:supabaseConfiguration.key,
  getSession:()=>client.auth.getSession(),endpoint,sessionId,kind,file,onProgress,signal});
}
export function identityUpload(sessionId,kind,file,options={}){
 return identityUploadTo('identity-verification',sessionId,kind,file,options);
}
