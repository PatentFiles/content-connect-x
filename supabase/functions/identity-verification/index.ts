// Deployment wrapper bundles the exact versioned local handler and policy.
// Never import an older GitHub commit: those bytes can silently disagree with
// the deployed database migration. Every user action verifies
// Supabase Auth; worker/retention actions use their own one-use capabilities.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!key)throw new Error('Server configuration is missing');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const handler=createHandler({admin,authenticate:async(req:Request)=>{
 const authorization=req.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer '))return null;
 const {data,error}=await admin.auth.getUser(authorization.slice(7));
 return error?null:data.user;
},assurance:async(req:Request)=>{
 // Supabase Auth validates the specific JWT rather than trusting frontend
 // claims or an earlier admin session. No service role key goes to the browser.
 const authorization=req.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer '))return null;
 const {data,error}=await admin.auth.mfa.getAuthenticatorAssuranceLevel(authorization.slice(7));
 return error?null:data?.currentLevel;
}});
Deno.serve(async(req:Request)=>{
 const response=await handler(req);
 if(response.status!==500)return response;
 // Installation failures must not masquerade as an identity rejection.
 const {error}=await admin.from('ccx_idv_config').select('singleton').limit(1);
 if(error&&['42P01','PGRST205'].includes(error.code))return new Response(JSON.stringify({error:'Identity verification setup is not complete. No documents can be uploaded yet.',code:'SETUP_REQUIRED'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
 return response;
});