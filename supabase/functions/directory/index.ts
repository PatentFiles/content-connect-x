/** Age-verified directory preview. Never expose private member records. */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,'content-type':'application/json'}});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, {status:204,headers:cors});
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  const url = Deno.env.get('SUPABASE_URL');
  const publishable = Deno.env.get('SUPABASE_ANON_KEY');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishable || !secret) return json({error:'Service unavailable'},503);
  const authHeader = req.headers.get('Authorization') || '';
  const client = createClient(url,publishable,{global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if (authError || !user) return json({error:'Unauthorized'},401);
  const admin = createClient(url,secret);
  const [{data: security},{data: ages},{data: subscription}] = await Promise.all([
    admin.from('account_security').select('banned,suspended,admin').eq('user_id',user.id).maybeSingle(),
    admin.from('age_verification_requests').select('status,expires_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1),
    admin.from('member_subscriptions').select('status,period_end').eq('user_id',user.id).maybeSingle(),
  ]);
  if (security?.banned || security?.suspended) return json({error:'Account unavailable'},403);
  const approved=ages?.some(v=>v.status==='approved'&&(!v.expires_at||Date.parse(v.expires_at)>Date.now()));
  if (!approved) return json({error:'Free age verification required'},403);
  const paid=Boolean(security?.admin||subscription && ['active','trial'].includes(subscription.status)&&(!subscription.period_end||Date.parse(subscription.period_end)>Date.now()));
  const {data:flag,error:flagError}=await admin.from('product_feature_flags')
    .select('enabled,allowed_tiers,rollout_percent').eq('key','creator_discovery').maybeSingle();
  if(flagError||!flag?.enabled||!flag.allowed_tiers?.includes(paid?'premium':'free'))
    return json({error:'Creator discovery is currently unavailable'},403);
  let hash=0;for(const char of user.id+'creator_discovery')hash=(hash*31+char.charCodeAt(0))>>>0;
  if(hash%100>=flag.rollout_percent)return json({error:'Creator discovery is not enabled for this account'},403);
  const body=await req.json().catch(()=>({}));
  const query=typeof body.query==='string'?body.query.trim().slice(0,80):'';
  const max=paid?100:12;
  const {data:verified, error:verificationError} = await admin.from('age_verification_requests').select('user_id,status,expires_at,created_at').order('created_at',{ascending:false}).limit(5000);
  if (verificationError) return json({error:'Unable to load directory'},500);
  // A user's most recent review determines eligibility; older approvals are not enough.
  const newest=new Map<string,{status:string,expires_at:string|null}>();
  for(const v of verified||[])if(!newest.has(v.user_id))newest.set(v.user_id,v);
  const validIds=[...newest.entries()].filter(([,v])=>v.status==='approved'&&(!v.expires_at||Date.parse(v.expires_at)>Date.now())).map(([id])=>id);
  const {data:restricted,error:restrictionError}=await admin.from('account_security').select('user_id').or('banned.eq.true,suspended.eq.true');
  if(restrictionError)return json({error:'Unable to load directory'},500);
  const restrictedIds=new Set((restricted||[]).map(v=>v.user_id));
  const ids=validIds.filter(id=>!restrictedIds.has(id));
  if (!ids.length) return json({results:[],preview:!paid,limit:max});
  let builder=admin.from('member_profiles').select('id,display_name,role_type,bio,avatar_path,city,country').eq('profile_complete',true).in('id',ids).limit(max);
  if (query) builder=builder.ilike('display_name',`%${query.replace(/[%_,]/g,'')}%`);
  const {data,error}=await builder;
  if (error) return json({error:'Unable to load directory'},500);
  const results=(data||[]).map(v=>({id:v.id,display_name:v.display_name,role_type:v.role_type,bio:paid?v.bio:null,avatar_path:v.avatar_path,city:v.city,country:v.country,age_verified:true}));
  return json({results,preview:!paid,limit:max});
});