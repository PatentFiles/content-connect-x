import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!key)throw new Error('Server configuration is missing');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({admin,authenticate:async(req)=>{
 const authorization=req.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer '))return null;
 const {data,error}=await admin.auth.getUser(authorization.slice(7));
 return error?null:data.user;
}}));
