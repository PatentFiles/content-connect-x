/** Trusted Edge integration. Set OPENAI_API_KEY in Supabase Secrets only. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createCreatorAiHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!key)throw Error('Server configuration missing');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createCreatorAiHandler({
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
 db:admin,
 env:{OPENAI_API_KEY:Deno.env.get('OPENAI_API_KEY'),OPENAI_TEXT_MODEL:Deno.env.get('OPENAI_TEXT_MODEL')}
}));