/**
 * Age-gated, role- and city-filtered creator discovery. Only safe public fields
 * from currently approved, unrestricted adult profiles are ever returned.
 * Free members may browse worldwide; local contact permissions are separate and enforced in member-workflows.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {directoryFilters,escapeLikeLiteral} from './searchPolicy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),publicKey=Deno.env.get('SUPABASE_ANON_KEY'),
  secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!publicKey||!secret)return json({error:'Service unavailable'},503);
 const auth=createClient(url,publicKey,{
  global:{headers:{Authorization:req.headers.get('Authorization')||''}}
 });
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return json({error:'Unauthorized'},401);
 const db=createClient(url,secret);
 const [securityResult,ageResult,subscriptionResult]=await Promise.all([
  db.from('account_security').select('banned,suspended,admin').eq('user_id',user.id).maybeSingle(),
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',user.id)
    .order('created_at',{ascending:false}).limit(1),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',user.id).maybeSingle()
 ]);
 // If an account-status query fails, never silently permit directory access.
 if(securityResult.error||ageResult.error||subscriptionResult.error)
  return json({error:'Unable to verify membership access'},503);
 if(securityResult.data?.banned||securityResult.data?.suspended)
  return json({error:'Account unavailable'},403);
 const latest=ageResult.data?.[0];
 if(latest?.status!=='approved'||latest.expires_at&&Date.parse(latest.expires_at)<=Date.now())
  return json({error:'Independent adult verification required'},403);
 const subscription=subscriptionResult.data;
 const premium=Boolean(securityResult.data?.admin||
  subscription&&['active','trial'].includes(subscription.status)&&
    (!subscription.period_end||Date.parse(subscription.period_end)>Date.now()));
 const {data:flag,error:flagError}=await db.from('product_feature_flags')
  .select('enabled,allowed_tiers,rollout_percent').eq('key','creator_discovery').maybeSingle();
 if(flagError||!flag?.enabled||!flag.allowed_tiers?.includes(premium?'premium':'free'))
  return json({error:'Creator discovery is currently unavailable'},403);
 let hash=0;
 for(const char of user.id+'creator_discovery')hash=(hash*31+char.charCodeAt(0))>>>0;
 if(hash%100>=flag.rollout_percent)
  return json({error:'Creator discovery is not enabled for this account'},403);
 let filters;
 try{filters=directoryFilters(await req.json().catch(()=>({})),premium);}
 catch{return json({error:'Invalid directory filter'},400);}
 const {data:verified,error:verificationError}=await db.from('age_verification_requests')
  .select('user_id,status,expires_at,created_at').order('created_at',{ascending:false}).limit(5000);
 if(verificationError)return json({error:'Unable to load directory'},503);
 const newest=new Map<string,{status:string,expires_at:string|null}>();
 for(const v of verified||[])if(!newest.has(v.user_id))newest.set(v.user_id,v);
 const verifiedIds=[...newest.entries()].filter(([,value])=>
  value.status==='approved'&&(!value.expires_at||Date.parse(value.expires_at)>Date.now())
 ).map(([id])=>id);
 const {data:restricted,error:restrictedError}=await db.from('account_security')
  .select('user_id').or('banned.eq.true,suspended.eq.true');
 if(restrictedError)return json({error:'Unable to load directory'},503);
 const restrictedIds=new Set((restricted||[]).map(x=>x.user_id));
 let eligible=verifiedIds.filter(id=>!restrictedIds.has(id));
 if(filters.ids)eligible=eligible.filter(id=>filters.ids.includes(id));
 if(!eligible.length)return json({results:[],preview:!premium,limit:filters.limit,has_more:false});
 // Identity and content searching is only possible when the target explicitly
 // opted into exposing the matching field. The query itself must not be an
 // indirect oracle for private gender, orientation or creative preferences.
 if(filters.gender||filters.category){
  let preferenceQuery=db.from('member_profile_preferences').select('user_id')
   .in('user_id',eligible);
  if(filters.gender)preferenceQuery=preferenceQuery.eq('show_gender_in_discovery',true)
   .eq('gender_identity',filters.gender);
  if(filters.category)preferenceQuery=preferenceQuery.eq('show_categories_in_discovery',true)
   .contains('content_categories',[filters.category]);
  const {data:matching,error:matchingError}=await preferenceQuery;
  if(matchingError)return json({error:'Unable to load directory'},503);
  eligible=(matching||[]).map(v=>v.user_id);
  if(!eligible.length)return json({results:[],preview:!premium,limit:filters.limit,has_more:false});
 }
 // Server selects only approved public profile fields. No birthdays, legal IDs,
 // private test results, exact addresses, email or private gallery paths.
 let query=db.from('member_profiles')
  .select('id,display_name,role_type,bio,avatar_path,city,state,country')
  .eq('profile_complete',true).in('id',eligible);
 if(filters.role)query=query.eq('role_type',filters.role);
 if(filters.query)query=query.ilike('display_name','%'+escapeLikeLiteral(filters.query)+'%');
 if(filters.city)query=query.ilike('city','%'+escapeLikeLiteral(filters.city)+'%');
 if(filters.state)query=query.ilike('state','%'+escapeLikeLiteral(filters.state)+'%');
 if(filters.country)query=query.ilike('country','%'+escapeLikeLiteral(filters.country)+'%');
 query=query.order('display_name',{ascending:true}).order('id',{ascending:true})
  .range(filters.offset,filters.offset+filters.limit);
 const {data,error}=await query;
 if(error)return json({error:'Unable to load directory'},503);
 const page=data||[],hasMore=page.length>filters.limit&&filters.offset+filters.limit<500;
 const ids=page.slice(0,filters.limit).map(v=>v.id);
 const prefs=new Map<string,{gender_identity:string,content_categories:string[],
   show_gender_in_discovery:boolean,show_categories_in_discovery:boolean}>();
 if(ids.length){
  const {data:optIns,error:optInError}=await db.from('member_profile_preferences')
   .select('user_id,gender_identity,content_categories,show_gender_in_discovery,show_categories_in_discovery')
   .in('user_id',ids);
  if(optInError)return json({error:'Unable to load directory'},503);
  for(const value of optIns||[])prefs.set(value.user_id,value);
 }
 const results=page.slice(0,filters.limit).map(v=>{
  const choice=prefs.get(v.id);
  return {id:v.id,display_name:v.display_name,role_type:v.role_type,
   bio:v.bio,avatar_path:v.avatar_path,city:v.city,state:v.state,
   country:v.country,age_verified:true,
   gender_identity:choice?.show_gender_in_discovery?choice.gender_identity:null,
   content_categories:choice?.show_categories_in_discovery?choice.content_categories:[]
  };
 });
 return json({results,preview:!premium,limit:filters.limit,
  has_more:hasMore,offset:filters.offset});
});
