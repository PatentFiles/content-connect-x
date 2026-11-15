/** Submit pending identity review: never approve identity or accept user-supplied status. */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const respond=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:{...cors,'content-type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST') return respond({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key||!secret) return respond({error:'Service unavailable'},503);
  const client=createClient(url,key,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) return respond({error:'Unauthorized'},401);
  const admin=createClient(url,secret);
  const {data:security}=await admin.from('account_security').select('banned,suspended').eq('user_id',user.id).maybeSingle();
  if(security?.banned||security?.suspended)return respond({error:'Account unavailable'},403);
  const {data:existing}=await admin.from('age_verification_requests').select('status').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1);
  if(existing?.some(v=>['approved','pending'].includes(v.status)))return respond({error:'Already submitted or verified'},409);
  const body=await req.json().catch(()=>({}));
  const idPath=body.id_document_path,selfiePath=body.selfie_document_path;
  const valid=(p:unknown)=>typeof p==='string'&&p.startsWith(`${user.id}/`)&&p.length<512&&!p.includes('..');
  if(!valid(idPath)||!valid(selfiePath)||idPath===selfiePath)return respond({error:'Private document paths required'},400);
  // Validate the user can reference actual files under their own private folder.
  const [identity,selfie]=await Promise.all([
    admin.storage.from('age-verification').info(idPath),
    admin.storage.from('age-verification').info(selfiePath),
  ]);
  if(identity.error||selfie.error)return respond({error:'Upload both documents before submitting'},400);
  const {data, error:insertError}=await admin.from('age_verification_requests').insert({user_id:user.id,status:'pending',provider:'manual',id_document_path:idPath,selfie_document_path:selfiePath}).select('id,status').single();
  if(insertError)return respond({error:'Verification submission failed'},500);
  return respond(data,201);
});
