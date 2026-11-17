/** Owner-only aggregate profile metrics, and privacy-preserving verified profile-open recording. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Cache-Control':'no-store'
};
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const current=(record:any)=>record?.status==='approved'&&(!record.expires_at||Date.parse(record.expires_at)>Date.now());
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return respond({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return respond({error:'Profile analytics service unavailable'},503);
 const header=req.headers.get('Authorization')||'';
 const requester=createClient(url,pub,{global:{headers:{Authorization:header}}});
 const {data:{user},error:authError}=await requester.auth.getUser();
 if(authError||!user)return respond({error:'Sign in required'},401);
 const db=createClient(url,secret),uid=user.id;
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object')return respond({error:'Invalid request'},400);
 const {data:security,error:securityError}=await db.from('account_security')
  .select('banned,suspended,admin').eq('user_id',uid).maybeSingle();
 if(securityError||security?.banned||security?.suspended)return respond({error:'Account unavailable'},403);
 if(body.action==='summary'){
  // Never return viewer identities, raw event rows, or clinical/profile data.
  const {data,error}=await db.rpc('ccx_profile_view_summary',{p_owner:uid});
  if(error||!data)return respond({error:'Profile analytics are not ready'},503);
  return respond(data);
 }
 if(body.action!=='record')return respond({error:'Unknown action'},404);
 const owner=body.profile_owner_id;
 if(!uuid(owner)||owner===uid)return respond({ok:true,recorded:false});
 const [viewerAge,ownerAge,ownerProfile,ownerSecurity,viewerSubscription,flag,blocked]=await Promise.all([
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(1),
  db.from('member_profiles').select('id,profile_complete').eq('id',owner).maybeSingle(),
  db.from('account_security').select('banned,suspended').eq('user_id',owner).maybeSingle(),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
  db.from('product_feature_flags').select('enabled,allowed_tiers,rollout_percent').eq('key','creator_discovery').maybeSingle(),
  db.from('member_blocks').select('blocker_id').or(`and(blocker_id.eq.${uid},blocked_id.eq.${owner}),and(blocker_id.eq.${owner},blocked_id.eq.${uid})`).limit(1)
 ]);
 if([viewerAge,ownerAge,ownerProfile,ownerSecurity,viewerSubscription,flag,blocked].some(v=>v.error))
  return respond({error:'Profile view unavailable'},503);
 const sub=viewerSubscription.data;
 const premium=security?.admin===true||(['active','trial'].includes(sub?.status)&&(!sub?.period_end||Date.parse(sub.period_end)>Date.now()));
 const feature=flag.data;
 let hash=0;for(const char of uid+'creator_discovery')hash=(hash*31+char.charCodeAt(0))>>>0;
 if(!current(viewerAge.data?.[0])||!current(ownerAge.data?.[0])||
    !ownerProfile.data?.profile_complete||ownerSecurity.data?.banned||ownerSecurity.data?.suspended||
    blocked.data?.length||!feature?.enabled||!feature.allowed_tiers?.includes(premium?'premium':'free')||
    hash%100>=feature.rollout_percent)return respond({error:'Profile not available'},403);
 const {error:writeError}=await db.from('member_profile_view_events').upsert({
  profile_owner_id:owner,viewer_id:uid,viewed_day:new Date().toISOString().slice(0,10)
 },{onConflict:'profile_owner_id,viewer_id,viewed_day',ignoreDuplicates:true});
 if(writeError)return respond({error:'Profile view unavailable'},503);
 return respond({ok:true});
});
