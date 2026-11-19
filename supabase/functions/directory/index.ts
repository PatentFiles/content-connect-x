/** Age-gated directory for the original Discovery, Search and Favorites pages. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {directoryFilters,escapeLikeLiteral} from './searchPolicy.mjs';
import {safeProfileAvatarPath,directoryFeatureForMode} from './profileCardPolicy.mjs';
import {countryAliases,regionAliases} from './locationPolicy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),publicKey=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!publicKey||!secret)return json({error:'Service unavailable'},503);
 try{
 const auth=createClient(url,publicKey,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return json({error:'Unauthorized'},401);
 const db=createClient(url,secret);
 const [securityResult,ageResult,subscriptionResult]=await Promise.all([
  db.from('account_security').select('banned,suspended,admin').eq('user_id',user.id).maybeSingle(),
  db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',user.id).maybeSingle()
 ]);
 if(securityResult.error||ageResult.error||subscriptionResult.error)return json({error:'Unable to verify membership access'},503);
 if(!securityResult.data||securityResult.data.banned||securityResult.data.suspended)return json({error:'Account unavailable'},403);
 const latest=ageResult.data?.[0];
 if(!latest?.admitted_at)return json({error:'Complete account onboarding first'},403);
 const subscription=subscriptionResult.data;
 const premium=Boolean(securityResult.data.admin||subscription&&['active','trial'].includes(subscription.status)&&(!subscription.period_end||Date.parse(subscription.period_end)>Date.now()));
 const body=await req.json().catch(()=>({}));
 const featureKey=directoryFeatureForMode(body?.mode);
 const {data:flag,error:flagError}=await db.from('product_feature_flags').select('enabled,allowed_tiers,rollout_percent').eq('key',featureKey).maybeSingle();
 if(flagError||!flag?.enabled||!flag.allowed_tiers?.includes(premium?'premium':'free'))return json({error:'This directory module is currently unavailable'},403);
 let hash=0;for(const char of user.id+featureKey)hash=(hash*31+char.charCodeAt(0))>>>0;
 if(hash%100>=flag.rollout_percent)return json({error:'This directory module is not enabled for this account'},403);
 let filters;try{filters=directoryFilters(body,premium);}catch{return json({error:'Invalid directory filter'},400);}
 const {data:verified,error:verificationError}=await db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(5000);
 if(verificationError)return json({error:'Unable to load directory'},503);
 const newest=new Map<string,{admitted_at:string,source:string}>();
 for(const value of verified||[])if(!newest.has(value.user_id))newest.set(value.user_id,value);
 const [security,blocks]=await Promise.all([
  db.from('account_security').select('user_id,banned,suspended'),
  db.from('member_blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)
 ]);
 if(security.error||blocks.error)return json({error:'Unable to load directory'},503);
 const allowed=new Set((security.data||[]).filter(row=>!row.banned&&!row.suspended).map(row=>row.user_id));
 const blocked=new Set((blocks.data||[]).map(row=>row.blocker_id===user.id?row.blocked_id:row.blocker_id));
 let eligible=[...newest.entries()].filter(([id,value])=>id!==user.id&&allowed.has(id)&&!blocked.has(id)&&Boolean(value.admitted_at)).map(([id])=>id);
 if(filters.ids)eligible=eligible.filter(id=>filters.ids.includes(id));
 if(!eligible.length)return json({results:[],preview:!premium,limit:filters.limit,has_more:false});
 // Opt-in matching only. Never use private orientation, clinical or identity data.
 if(filters.gender||filters.category){
  let query=db.from('member_profile_preferences').select('user_id').in('user_id',eligible);
  if(filters.gender)query=query.eq('show_gender_in_discovery',true).eq('gender_identity',filters.gender);
  if(filters.category)query=query.eq('show_categories_in_discovery',true).contains('content_categories',[filters.category]);
  const {data,error}=await query;if(error)return json({error:'Unable to load directory'},503);
  eligible=(data||[]).map(row=>row.user_id);
  if(!eligible.length)return json({results:[],preview:!premium,limit:filters.limit,has_more:false});
 }
 let query=db.from('member_profiles').select('id,display_name,role_type,bio,avatar_path,city,state,country').eq('profile_complete',true).in('id',eligible);
 if(filters.role)query=query.eq('role_type',filters.role);
 if(filters.query)query=query.ilike('display_name','%'+escapeLikeLiteral(filters.query)+'%');
 if(filters.city)query=query.ilike('city','%'+escapeLikeLiteral(filters.city)+'%');
 // Multiple aliases come only from fixed country/region dictionaries. Unknown
 // user text always uses an escaped literal filter, never a raw OR expression.
 if(filters.state){const aliases=regionAliases(filters.state,filters.country);query=aliases.length>1?query.or(aliases.map(value=>'state.ilike.'+JSON.stringify(value)).join(',')):query.ilike('state','%'+escapeLikeLiteral(filters.state)+'%');}
 if(filters.country){const aliases=countryAliases(filters.country);query=aliases.length>1?query.or(aliases.map(value=>'country.ilike.'+JSON.stringify(value)).join(',')):query.ilike('country','%'+escapeLikeLiteral(filters.country)+'%');}
 query=query.order('display_name',{ascending:true}).order('id',{ascending:true}).range(filters.offset,filters.offset+filters.limit);
 const {data,error}=await query;if(error)return json({error:'Unable to load directory'},503);
 const page=data||[],hasMore=page.length>filters.limit&&filters.offset+filters.limit<500;
 const ids=page.slice(0,filters.limit).map(row=>row.id);
 const prefs=new Map<string,any>();
 if(ids.length){const {data:choices,error:choiceError}=await db.from('member_profile_preferences').select('user_id,gender_identity,sexual_orientation,content_categories,show_gender_in_discovery,show_orientation_in_discovery,show_categories_in_discovery').in('user_id',ids);if(choiceError)return json({error:'Unable to load directory'},503);for(const choice of choices||[])prefs.set(choice.user_id,choice);}
 const {data:ageRows,error:badgeError}=await db.from('age_verification_requests').select('user_id,status,expires_at,created_at').in('user_id',ids).order('created_at',{ascending:false});
 if(badgeError)return json({error:'Unable to load verification badges'},503);
 const badges=new Map();for(const row of ageRows||[])if(!badges.has(row.user_id))badges.set(row.user_id,row);
 const results=await Promise.all(page.slice(0,filters.limit).map(async row=>{
  const badge=badges.get(row.id);
  const choice=prefs.get(row.id);let avatarUrl=null;
  const path=safeProfileAvatarPath(row.id,row.avatar_path);
  if(path){const {data:link,error:linkError}=await db.storage.from('member-private').createSignedUrl(path,900);if(!linkError)avatarUrl=link?.signedUrl||null;}
  // A signed avatar is issued only after all viewer/member authorization checks.
  // Raw private storage paths, health reports, legal names and emails stay private.
  return {id:row.id,display_name:row.display_name,role_type:row.role_type,bio:row.bio,avatar_url:avatarUrl,city:row.city,state:row.state,country:row.country,age_verified:badge?.status==='approved'&&(!badge.expires_at||Date.parse(badge.expires_at)>Date.now()),gender_identity:choice?.show_gender_in_discovery?choice.gender_identity:null,sexual_orientation:choice?.show_orientation_in_discovery&&['straight','gay','lesbian','bisexual','pansexual','queer','asexual','questioning'].includes(choice.sexual_orientation)?choice.sexual_orientation:null,content_categories:choice?.show_categories_in_discovery?choice.content_categories:[]};
 }));
 return json({results,preview:!premium,limit:filters.limit,has_more:hasMore,offset:filters.offset});
 }catch{return json({error:'Directory service is temporarily unavailable'},503);}
});
