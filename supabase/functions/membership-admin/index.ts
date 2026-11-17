/** Membership plan administration. Public prices are read through RLS; writes require AAL2 administrators. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version',
 'Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return reply({error:'Service unavailable'},503);
 const header=req.headers.get('Authorization')||'';
 const auth=createClient(url,pub,{global:{headers:{Authorization:header}}});
 const {data:{user},error:e}=await auth.auth.getUser();
 if(e||!user)return reply({error:'Sign in required'},401);
 const body=await req.json().catch(()=>({}));
 if(body.action!=='set_price'||typeof body.plan_code!=='string'||typeof body.monthly_cents!=='number'||
  !Number.isSafeInteger(body.monthly_cents)||body.monthly_cents<0||body.monthly_cents>1000000)
   return reply({error:'Invalid plan or monthly price'},400);
 const db=createClient(url,secret),uid=user.id;
 const [role,aal]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  auth.auth.mfa.getAuthenticatorAssuranceLevel()
 ]);
 if(role.error||aal.error||!role.data?.admin||role.data.banned||role.data.suspended||aal.data?.currentLevel!=='aal2')
  return reply({error:'Administrator MFA required'},403);
 const {data:plan,error:findError}=await db.from('membership_plan_catalog')
  .select('plan_code,role_type').eq('plan_code',body.plan_code).eq('active',true).maybeSingle();
 if(findError||!plan)return reply({error:'Plan unavailable'},404);
 if(plan.role_type==='studio'&&body.monthly_cents<24999)
  return reply({error:'Studio membership starts at $249.99 per month'},400);
 const {data:updated,error:updateError}=await db.from('membership_plan_catalog').update({
  monthly_cents:body.monthly_cents,updated_at:new Date().toISOString()
 }).eq('plan_code',plan.plan_code).select('plan_code,monthly_cents').single();
 if(updateError)return reply({error:'Unable to update price'},503);
 await db.from('platform_action_audit').insert({
  actor_id:uid,action:'membership_price_updated',target_type:'membership_plan',
  metadata:{plan_code:updated.plan_code,monthly_cents:updated.monthly_cents}
 });
 return reply({item:updated,checkout_enabled:false});
});
