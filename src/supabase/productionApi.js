import { supabase } from '@/api/supabaseClient';

/** All actions are authorized on the server; UI controls never grant access. */
export async function productionAction(action, args={}) {
  const {data,error}=await supabase.functions.invoke('production-manager',{body:{action,...args}});
  if(error||data?.error) {
    let message=data?.error||error?.message||'Production service unavailable';
    if(error?.context?.json) {
      try {
        const body=await error.context.json();
        if(typeof body?.error==='string')message=body.error;
      }catch { /* preserve the original error */ }
    }
    throw new Error(message);
  }
  return data;
}
