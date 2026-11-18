/** Submit pending identity review: never approve identity or accept user-supplied status. */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST, OPTIONS'};
const respond=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:{...cors,'content-type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return respond({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key||!secret) return respond({error:'Service unavailable'},503);
  const client=createClient(url,key,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) return respond({error:'Unauthorized'},401);
  return respond({error:'Manual ID uploads are retired. Start secure document and selfie verification with Yoti.',provider:'yoti'},410);
});
