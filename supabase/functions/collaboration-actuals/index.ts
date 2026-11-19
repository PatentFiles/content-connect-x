/** Server-owned, member-scoped actual work statements. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createActualsHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL');
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!secret)throw Error('Server configuration unavailable');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createActualsHandler({
 authenticate:async(req:Request)=>{
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return null;
  const {data,error}=await admin.auth.getUser(bearer.slice(7));
  return error?null:data.user;
 },
 call:(args:Record<string,unknown>)=>admin.rpc('ccx_collaboration_actual_action',args)
}));
