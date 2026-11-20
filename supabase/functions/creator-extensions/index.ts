/** JWT-authenticated gateway. No service key or clinical evidence enters Bolt. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createCreatorExtensionsHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL');
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!secret)throw Error('Creator extensions not configured');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createCreatorExtensionsHandler({
 authenticate:async(req:Request)=>{
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return null;
  const {data,error}=await admin.auth.getUser(bearer.slice(7));
  return error?null:data.user;
 },
 db:admin
}));