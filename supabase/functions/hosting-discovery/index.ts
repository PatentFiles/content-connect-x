/** Private paginated property media and host market comparison.
 * No exact addresses, health records, secret values, or unapproved peer media.
 * This shares the original properties table; it creates no shadow inventory.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
const id=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const approved=(v:any)=>v?.status==='approved'&&(!v.expires_at||Date.parse(v.expires_at)>Date.now());
const hostCurrent=(v:any)=>v?.status==='active'&&v.terms_version==='host-2026-11-17'&&v.legal_capacity_confirmed===true&&v.property_authority_confirmed===true&&v.adult_production_understood===true;
const publicColumns='id,owner_id,title,description,category,city,state,country,hourly_rate,currency,minimum_hours,capacity,public_area_id,status,approved_at,created_at';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return reply({error:'Service unavailable'},503);
 const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return reply({error:'Sign in required'},401);
 const db=createClient(url,secret),uid=user.id;
 try{
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request'},400);
  const action=typeof body.action==='string'?body.action:'';
  const [security,age,host,flags,plan,blocked]=await Promise.all([
   db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
   db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
   db.from('onlyhost_accounts').select('status,terms_version,legal_capacity_confirmed,property_authority_confirmed,adult_production_understood').eq('user_id',uid).maybeSingle(),
   db.from('product_feature_flags').select('enabled,allowed_tiers,rollout_percent').eq('key','hosting_marketplace').maybeSingle(),
   db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
   db.from('member_blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`).limit(1000)
  ]);
  if([security,age,host,flags,plan,blocked].some(v=>v.error))return reply({error:'Account eligibility unavailable'},503);
  if(!security.data||security.data.banned||security.data.suspended)return reply({error:'Account restricted'},403);
  const hosting=hostCurrent(host.data),creator=Boolean(age.data?.[0]?.admitted_at);
  if(!hosting&&!creator)return reply({error:'Current host agreement or creator verification required'},403);
  const paid=hosting||security.data.admin||(['active','trial'].includes(plan.data?.status)&&(!plan.data?.period_end||Date.parse(plan.data.period_end)>Date.now()));
  let hash=0;for(const c of uid+'hosting_marketplace')hash=(hash*31+c.charCodeAt(0))>>>0;
  if(!flags.data?.enabled||!flags.data.allowed_tiers?.includes(paid?'premium':'free')||hash%100>=flags.data.rollout_percent)
    return reply({error:'Marketplace is unavailable for this account'},403);
  const blockedIds=new Set((blocked.data||[]).map(v=>v.blocker_id===uid?v.blocked_id:v.blocker_id));
  const own=async(propertyId:string)=>{
   const {data,error}=await db.from('properties').select(publicColumns).eq('id',propertyId).eq('owner_id',uid).maybeSingle();
   if(error)throw error;return data;
  };
  /** Checks publication plus current property authority and account standing. */
  const visible=async(items:any[])=>{
   const peers=items.filter(v=>v.owner_id!==uid);if(!peers.length)return items;
   const owners=[...new Set(peers.map(v=>v.owner_id))],ids=peers.map(v=>v.id);
   const [accounts,authority,hosts,ages]=await Promise.all([
    db.from('account_security').select('user_id,banned,suspended').in('user_id',owners),
    db.from('host_verification_requests').select('property_id,owner_id,status,expires_at').in('property_id',ids).eq('status','approved'),
    db.from('onlyhost_accounts').select('user_id,status,terms_version,legal_capacity_confirmed,property_authority_confirmed,adult_production_understood').in('user_id',owners),
    db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').in('user_id',owners).order('created_at',{ascending:false}).limit(2000)
   ]);
   for(const result of [accounts,authority,hosts,ages])if(result.error)throw result.error;
   const safeOwners=new Set((accounts.data||[]).filter(v=>!v.banned&&!v.suspended).map(v=>v.user_id));
   const validHosts=new Set((hosts.data||[]).filter(hostCurrent).map(v=>v.user_id));
   const latest=new Map();for(const v of ages.data||[])if(!latest.has(v.user_id))latest.set(v.user_id,v);
   const rights=new Set((authority.data||[]).filter(approved).map(v=>v.property_id+':'+v.owner_id));
   return items.filter(v=>v.owner_id===uid||v.status==='active'&&v.approved_at&&safeOwners.has(v.owner_id)&&
    !blockedIds.has(v.owner_id)&&rights.has(v.id+':'+v.owner_id)&&(validHosts.has(v.owner_id)||Boolean(latest.get(v.owner_id)?.admitted_at)));
  };
  const media=async(property:any,start:number,limit:number)=>{
   let query=db.from('property_images').select('id,storage_path,caption,status,position,created_at',{count:'exact'})
    .eq('property_id',property.id).order('position').order('created_at').order('id');
   if(property.owner_id!==uid)query=query.eq('status','approved');
   const {data,error,count}=await query.range(start,start+limit-1);
   if(error)throw error;
   const items=await Promise.all((data||[]).map(async v=>{
    const {data:link,error:linkError}=await db.storage.from('property-images').createSignedUrl(v.storage_path,300);
    if(linkError)throw linkError;
    return {id:v.id,caption:v.caption,status:v.status,position:v.position,url:link.signedUrl};
   }));
   return {items,total:count||0,next_offset:start+items.length<(count||0)?start+items.length:null};
  };
  const thumbnails=async(items:any[])=>{
   // Bounded groups avoid unbounded concurrent signing and one property's gallery
   // consuming another property's cover-photo limit.
   const output=[];
   for(let start=0;start<items.length;start+=8){
    const page=await Promise.all(items.slice(start,start+8).map(async v=>{
     const images=await media(v,0,6);
     return {id:v.id,photos:images.items,photo_count:images.total};
    }));output.push(...page);
   }return output;
  };
  switch(action){
  case 'listing_thumbnails':{
   if(!Array.isArray(body.ids)||body.ids.length>100||body.ids.some(v=>!id(v)))return reply({error:'Valid listing IDs required'},400);
   if(!body.ids.length)return reply({items:[]});
   const {data,error}=await db.from('properties').select(publicColumns).in('id',[...new Set(body.ids)]);
   if(error)throw error;
   const allowed=await visible(data||[]);
   return reply({items:await thumbnails(allowed)});
  }
  case 'host_media_page':
  case 'property_media_page':{
   if(!id(body.id))return reply({error:'Valid property required'},400);
   let property;
   if(action==='host_media_page'){
    if(!hosting)return reply({error:'Current host agreement required'},403);
    property=await own(body.id);
   }else{
    if(!creator)return reply({error:'Creator verification required'},403);
    const {data,error}=await db.from('properties').select(publicColumns).eq('id',body.id).eq('status','active').not('approved_at','is',null).maybeSingle();
    if(error)throw error;property=(await visible(data?[data]:[]))[0];
   }
   if(!property)return reply({error:'Property unavailable'},404);
   const start=Number(body.offset??0),limit=Number(body.limit??60);
   if(!Number.isSafeInteger(start)||start<0||!Number.isInteger(limit)||limit<1||limit>60)return reply({error:'Invalid pagination'},400);
   return reply(await media(property,start,limit));
  }
  case 'host_photos_register':{
   if(!hosting||!id(body.id)||typeof body.path!=='string')return reply({error:'Host and property required'},403);
   const property=await own(body.id);
   if(!property||!['draft','active','pending_review','paused'].includes(property.status))return reply({error:'Property unavailable'},403);
   const path=body.path;
   if(!path.startsWith(uid+'/'+property.id+'/')||path.includes('..')||path.length>350)return reply({error:'Invalid upload path'},403);
   const {data:file,error:fileError}=await db.storage.from('property-images').info(path);
   if(fileError||!file)return reply({error:'Upload unavailable'},404);
   const type=file.metadata?.mimetype,size=Number(file.metadata?.size);
   if(!['image/jpeg','image/png','image/webp'].includes(type)||!Number.isFinite(size)||size<=0||size>10485760)
    return reply({error:'Supported image of at most 10MB required'},400);
   const {data:prior,error:priorError}=await db.from('property_images').select('id,status').eq('property_id',property.id).eq('storage_path',path).maybeSingle();
   if(priorError)throw priorError;
   if(prior)return reply({item:prior,note:'Photo already registered.'});
   const {data:last,error:lastError}=await db.from('property_images').select('position').eq('property_id',property.id).order('position',{ascending:false}).limit(1);
   if(lastError)throw lastError;
   const {data,error}=await db.from('property_images').insert({property_id:property.id,uploader_id:uid,storage_path:path,
    mime_type:type,caption:typeof body.caption==='string'?body.caption.trim().slice(0,250):'',
    position:(last?.[0]?.position??-1)+1,status:'pending'}).select('id,status').single();
   if(error)throw error;
   if(property.status==='active'){
    const {error:reviewError}=await db.from('properties').update({status:'pending_review',approved_at:null,approved_by:null}).eq('id',property.id).eq('owner_id',uid);
    if(reviewError)throw reviewError;
   }
   return reply({item:data,note:'Photo saved privately for independent review.'},201);
  }
  case 'host_market_overview':{
   if(!hosting)return reply({error:'Current host agreement required'},403);
   const city=typeof body.city==='string'?body.city.trim().slice(0,100).replace(/[%*,()._]/g,''):'';
   const start=Number(body.offset??0),limit=Number(body.limit??60);
   if(!Number.isSafeInteger(start)||start<0||!Number.isInteger(limit)||limit<1||limit>60)return reply({error:'Invalid pagination'},400);
   const {data:areas,error:areasError}=await db.from('hosting_public_areas').select('id,latitude,longitude,city,region,country').eq('approved',true).order('city').limit(1000);
   if(areasError)throw areasError;
   let allowedAreas:string[]|null=null;
   if(body.bounds){
    const {west,east,south,north}=body.bounds;
    if(![west,east,south,north].every(Number.isFinite)||west>=east||south>=north||west < -180||east>180||south< -85||north>85)
     return reply({error:'Valid map bounds required'},400);
    allowedAreas=(areas||[]).filter(a=>Number(a.longitude)>=west&&Number(a.longitude)<=east&&Number(a.latitude)>=south&&Number(a.latitude)<=north).map(a=>a.id);
   }
   const {data:owned,error:ownedError}=await db.from('properties').select(publicColumns).eq('owner_id',uid).order('created_at',{ascending:false}).limit(100);
   if(ownedError)throw ownedError;
   let query=db.from('properties').select(publicColumns).eq('status','active').not('approved_at','is',null)
    .order('created_at',{ascending:false}).order('id');
   if(city)query=query.ilike('city','%'+city+'%');
   if(allowedAreas?.length)query=query.in('public_area_id',allowedAreas);
   const result=allowedAreas&&!allowedAreas.length?{data:[],error:null}:await query.range(start,start+limit);
   if(result.error)throw result.error;
   const candidates=(result.data||[]).slice(0,limit),hasMore=(result.data||[]).length>limit;
   const available=await visible(candidates);
   const ownedThumbnails=await thumbnails(owned||[]),marketThumbnails=await thumbnails(available);
   const cover=new Map([...ownedThumbnails,...marketThumbnails].map(v=>[v.id,v]));
   const clean=(v:any)=>{const {owner_id,approved_at,...publicItem}=v;return {...publicItem,...cover.get(v.id),owned:owner_id===uid};};
   return reply({areas:areas||[],items:available.map(clean),owned_items:(owned||[]).map(clean),has_more:hasMore,next_offset:hasMore?start+limit:null});
  }
  default:return reply({error:'Unknown discovery action'},404);
  }
 }catch(error){console.error('hosting-discovery operation failed',error?.code||'request_failed');return reply({error:'Property discovery is temporarily unavailable'},500);}
});
