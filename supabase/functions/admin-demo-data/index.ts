/** Admin-only deterministic presentation data. No production data returned. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {demoData} from './demoData.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const out=(v,s=200)=>Response.json(v,{status:s,headers:cors});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return out({error:'POST required'},405);
 const token=(req.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!token)return out({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return out({error:'Demo service unavailable'},503);
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user?.email_confirmed_at)return out({error:'Invalid session'},401);
  const [security,admission]=await Promise.all([
   db.from('account_security').select('admin,banned,suspended').eq('user_id',user.id).maybeSingle(),
   db.from('member_admissions').select('admitted_at').eq('user_id',user.id).limit(1)
  ]);
  if(security.error||admission.error||security.data?.admin!==true||security.data.banned||security.data.suspended||!admission.data?.some(a=>a.admitted_at))return out({error:'Administrator access required'},403);
  return out(demoData());
 }catch{return out({error:'Demo service unavailable'},503);}
});
