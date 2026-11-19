/** Connect Groups: authenticated, MFA-gated platform moderation. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createGroupHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!secret)throw Error('Groups are not configured');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createGroupHandler({
 authenticate:async(req:Request)=>{
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return null;
  const {data,error}=await admin.auth.getUser(bearer.slice(7));
  return error?null:data.user;
 },
 assurance:async(req:Request)=>{
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return null;
  const {data,error}=await admin.auth.mfa.getAuthenticatorAssuranceLevel(bearer.slice(7));
  return error?null:data?.currentLevel;
 },
 db:admin
}));