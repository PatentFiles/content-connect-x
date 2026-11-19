/** Private collaboration check-ins; no staff dispatch or GPS tracking.
 * Each call validates the supplied Supabase JWT and an independent DB policy.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createSafetyHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL');
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!service)throw Error('Server configuration unavailable');
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createSafetyHandler({
 authenticate:async(req:Request)=>{
  const bearer=req.headers.get('Authorization')||'';
  if(!bearer.startsWith('Bearer '))return null;
  const {data,error}=await admin.auth.getUser(bearer.slice(7));
  return error?null:data.user;
 },
 act:(userId:string,collaborationId:string,action:string,contactInformed:boolean)=>admin.rpc('ccx_collaboration_safety_action',{
  p_actor:userId,p_collaboration:collaborationId,p_action:action,p_contact_informed:contactInformed
 })
}));
