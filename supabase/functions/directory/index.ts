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
 // Authenticated owner-only read-only preview: uses precisely the safe fields
 // and opt-in filters shown to other verified members in public Discovery.
 // Unlike directory search, the signed-in member can preview their own profile.
 if(body?.action==='my_public_profile'){
  const [own,choices,verification]=await Promise.all([
   db.from('member_profiles').select('id,display_name,stage_name,company_name,role_type,bio,avatar_path,cover_path,city,state,country,profile_complete').eq('id',user.id).maybeSingle(),
   db.from('member_profile_preferences').select('gender_identity,sexual_orientation,pronouns,content_categories,specialties,available_to_travel,show_gender_in_discovery,show_orientation_in_discovery,show_categories_in_discovery').eq('user_id',user.id).maybeSingle(),
   db.from('age_verification_requests').select('status,expires_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1)
  ]);
  if(own.error||choices.error||verification.error)return json({error:'Your public profile preview is unavailable'},503);
  if(!own.data)return json({error:'Your profile has not been created'},404);
  const p=own.data,c=choices.data||{},badge=verification.data?.[0];
  const paths={avatar:safeProfileAvatarPath(user.id,p.avatar_path),
   cover:typeof p.cover_path==='string'&&p.cover_path.startsWith(user.id+'/profile/cover-')&&!p.cover_path.includes('..')&&/\.(jpg|jpeg|png|webp)$/i.test(p.cover_path)?p.cover_path:null};
  const signed={};
  for(const [kind,path] of Object.entries(paths)){
   if(!path)continue;
   const {data:link,error}=await db.storage.from('member-private').createSignedUrl(path,600);
   if(!error)signed[kind]=link?.signedUrl||null;
  }
  // Profile extensions are derived only from member-visible, already-approved
  // fields. An owner preview is not permission to expose private account data.
  // Isolate optional section failures so a missing legacy table cannot break
  // the entire profile; report the sections that could not load.
  const sections=await Promise.allSettled([
   db.from('ccx_travel_dates').select('id,city,region,country,starts_at,ends_at')
    .eq('user_id',user.id).eq('visible_to_members',true).gte('ends_at',new Date().toISOString())
    .order('starts_at',{ascending:true}).limit(24),
   db.from('member_social_links').select('links,share_with_premium').eq('user_id',user.id).maybeSingle(),
   db.from('member_representations').select('representative_id,creator_id,representative_role,status,starts_at,expires_at,agreed_by_representative_at,agreed_by_professional_at')
    .or('creator_id.eq.'+user.id+',representative_id.eq.'+user.id).eq('status','active').limit(20),
   db.from('creator_production_preferences').select('availability_type,travel_regions,scene_pairings').eq('user_id',user.id).maybeSingle(),
   db.from('member_portfolio_items').select('id,kind,title,description,external_url,created_at').eq('user_id',user.id).eq('featured',true)
    .order('created_at',{ascending:false}).limit(12),
   db.from('community_posts').select('id,body,published_at,created_at')
    .eq('author_id',user.id).eq('status','published').eq('audience','verified').is('hidden_at',null).is('group_id',null)
    .order('published_at',{ascending:false}).limit(12)
  ]);
  const names=['travel','social_links','representation','production','portfolio','posts'];
  const missing=sections.flatMap((v,i)=>v.status==='rejected'||v.value.error?[names[i]]:[]);
  const value=i=>sections[i].status==='fulfilled'&&!sections[i].value.error?sections[i].value.data:null;
  const travels=Array.isArray(value(0))?value(0):[];
  const social=value(1),allowedSocial= social?.share_with_premium===true&&social?.links&&typeof social.links==='object'?social.links:{};
  // Only official HTTPS social domains and safe links can leave the service.
  const socialDomains={onlyfans:['onlyfans.com'],fansly:['fansly.com'],twitter:['twitter.com','x.com'],instagram:['instagram.com']};
  const socialLinks=Object.entries(allowedSocial).flatMap(([key,raw])=>{
   if(!Array.isArray(socialDomains[key])||typeof raw!=='string')return [];
   try{const parsed=new URL(raw),host=parsed.hostname.toLowerCase().replace(/^www\\./,'');
    return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&socialDomains[key].includes(host)?[{platform:key,url:parsed.toString()}]:[];
   }catch{return [];}
  });
  const active=(Array.isArray(value(2))?value(2):[]).filter(row=>row.agreed_by_representative_at&&row.agreed_by_professional_at&&(!row.expires_at||Date.parse(row.expires_at)>Date.now()));
  const ids=active.map(row=>row.creator_id===user.id?row.representative_id:row.creator_id);
  let representatives=[];
  if(ids.length){
   const [counterparts,security]=await Promise.all([
    db.from('member_profiles').select('id,display_name,role_type,profile_complete').in('id',ids),
    db.from('account_security').select('user_id,banned,suspended').in('user_id',ids)
   ]);
   if(counterparts.error||security.error)missing.push('representation');
   else{
    const secure=new Set((security.data||[]).filter(x=>!x.banned&&!x.suspended).map(x=>x.user_id));
    const byId=new Map((counterparts.data||[]).filter(x=>x.profile_complete&&secure.has(x.id)).map(x=>[x.id,x]));
    representatives=active.flatMap(row=>{
     const person=byId.get(row.creator_id===user.id?row.representative_id:row.creator_id);
     return person?[{id:person.id,display_name:person.display_name,role_type:person.role_type,relationship:row.creator_id===user.id?'Represented by':'Represents'}]:[];
    });
   }
  }
  const creator=value(3),portfolio=Array.isArray(value(4))?value(4):[],posts=Array.isArray(value(5))?value(5):[];
  const externalUrl=raw=>{
   if(typeof raw!=='string')return null;
   try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;}catch{return null;}
  };
  const publicProfile={
   id:p.id,display_name:p.display_name,stage_name:p.stage_name,company_name:p.company_name,role_type:p.role_type,bio:p.bio,
   city:p.city,state:p.state,country:p.country,
   avatar_url:signed.avatar||null,cover_url:signed.cover||null,
   profile_complete:p.profile_complete===true,
   age_verified:badge?.status==='approved'&&(!badge.expires_at||Date.parse(badge.expires_at)>Date.now()),
   gender_identity:c.show_gender_in_discovery?c.gender_identity:null,
   pronouns:c.show_gender_in_discovery?c.pronouns:null,
   sexual_orientation:c.show_orientation_in_discovery?c.sexual_orientation:null,
   content_categories:c.show_categories_in_discovery?c.content_categories||[]:[],
   specialties:c.show_categories_in_discovery?c.specialties||[]:[],
   production:{availability_type:creator?.availability_type||null,
    travel_regions:c.available_to_travel===true?(creator?.travel_regions||[]):[],
    scene_pairings:c.show_categories_in_discovery?(creator?.scene_pairings||[]):[]},
   travel_dates:travels, social_links:socialLinks,representatives,
   featured_portfolio:portfolio.map(x=>({id:x.id,kind:x.kind,title:x.title,description:x.description,url:externalUrl(x.external_url)})),
   posts, sections_unavailable:[...new Set(missing)]
  };
  return json({item:publicProfile,owner_preview:true});
 }
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
 if(filters.gender||filters.category||filters.orientation){
  let query=db.from('member_profile_preferences').select('user_id').in('user_id',eligible);
  if(filters.gender)query=query.eq('show_gender_in_discovery',true).eq('gender_identity',filters.gender);
  if(filters.category)query=query.eq('show_categories_in_discovery',true).contains('content_categories',[filters.category]);
  if(filters.orientation)query=query.eq('show_orientation_in_discovery',true).eq('sexual_orientation',filters.orientation);
  const {data,error}=await query;if(error)return json({error:'Unable to load directory'},503);
  eligible=(data||[]).map(row=>row.user_id);
  if(!eligible.length)return json({results:[],preview:!premium,limit:filters.limit,has_more:false});
 }
 // Only owner-opted-in, self-reported characteristics can be searched.
 // We retrieve *user IDs only*: neither the browser nor directory response ever
 // receives raw age, ethnicity or anatomy values for another member.
 const hasAttributes=Boolean(filters.ethnicity||filters.circumcision||filters.breast_size||
  ['min_age','max_age','min_height_cm','max_height_cm','min_weight_kg','max_weight_kg','min_penis_inches','max_penis_inches'].some(key=>filters[key]!==null));
 if(hasAttributes){
  let attrs=db.from('member_discovery_attributes').select('user_id').in('user_id',eligible).eq('visible_in_discovery',true);
  if(filters.ethnicity)attrs=attrs.eq('ethnicity',filters.ethnicity);
  if(filters.circumcision)attrs=attrs.eq('circumcision',filters.circumcision);
  if(filters.breast_size)attrs=attrs.eq('breast_size',filters.breast_size);
  for(const [key,column] of Object.entries({min_age:'age_years',max_age:'age_years',
   min_height_cm:'height_cm',max_height_cm:'height_cm',min_weight_kg:'weight_kg',
   max_weight_kg:'weight_kg',min_penis_inches:'penis_inches',max_penis_inches:'penis_inches'})){
   if(filters[key]!==null)attrs=key.startsWith('min_')?attrs.gte(column,filters[key]):attrs.lte(column,filters[key]);
  }
  const {data,error}=await attrs;
  if(error)return json({error:'Advanced directory search is unavailable'},503);
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
