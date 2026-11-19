/** Single trusted Edge gateway for Connect Feed. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createConnectFeedHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!secret)throw Error('Connect Feed backend not configured');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createConnectFeedHandler({
 authenticate:async(req:Request)=>{
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return null;
  const {data,error}=await admin.auth.getUser(bearer.slice(7));
  return error?null:data.user;
 },
 db:admin,
 storage:admin.storage
}));