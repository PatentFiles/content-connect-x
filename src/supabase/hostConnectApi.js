/**
 * Content Connect X -> canonical Host Connect X marketplace.
 * No shared credentials and no copied inventory. Authenticated CCX tokens
 * are validated by the Host Edge function using CCX Auth + its own RLS.
 * The Host project service-role credential NEVER enters this browser bundle.
 */
import {supabase} from '@/api/supabaseClient';
export const HOST_CONNECT_API='https://szfdoqkfewwpdkapqptp.supabase.co/functions/v1/host-marketplace';
export async function hostConnectAction(action,args={}){
 const {data:{session},error:sessionError}=await supabase.auth.getSession();
 if(sessionError)throw Error('Could not verify your Content Connect X session.');
 const response=await fetch(HOST_CONNECT_API,{
  method:'POST',headers:{'content-type':'application/json',...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{})},
  body:JSON.stringify({action,...args}),signal:AbortSignal.timeout(15000)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data||data.error)throw Error(data?.error||'Host Connect X is temporarily unavailable. Refresh the availability calendar and retry.');
 return data;
}

/** A CCX member may review their own HCX booking, never HCX administrator
 * settings. The independent Host backend validates this exact CCX session.
 */
export async function hostRentalAgreementAction(action,args={}){
 const {data:{session},error}=await supabase.auth.getSession();
 if(error||!session?.access_token)throw Error('Sign in to view your rental agreement.');
 const response=await fetch('https://szfdoqkfewwpdkapqptp.supabase.co/functions/v1/host-rental-agreements',{
  method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+session.access_token},
  body:JSON.stringify({action,...args}),signal:AbortSignal.timeout(90000)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data||data.error)throw Error(data?.error||'Host Connect X agreement service unavailable.');
 return data;
}
