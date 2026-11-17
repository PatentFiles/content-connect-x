/**
 * Creator Hosting — authenticated marketplace / reservations / property operations.
 *
 * Source concepts: wrujel/airbnb-clone (marketplace, favorites, filtered search),
 * antsal06/openstay (calendar and transactional collision prevention),
 * anvragsingh/StayFinder (host dashboard), lkilpatrick/openstr (turnovers).
 *
 * Does not import their authentication or databases. All returned listing fields
 * are sanitized; exact address, private media, guest details are never in search.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS'
};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const safe=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const finite=(v:unknown)=>typeof v==='number'?v:typeof v==='string'?Number(v):NaN;
const verified=(record:any)=>record?.status==='approved'&&(!record.expires_at||Date.parse(record.expires_at)>Date.now());
const subscribed=(record:any)=>['active','trial'].includes(record?.status)&&(!record.period_end||Date.parse(record.period_end)>Date.now());
const moment=(v:unknown)=>{const date=typeof v==='string'?new Date(v):new Date(NaN);return Number.isFinite(date.getTime())?date.toISOString():null;};
const acceptedAmenities=new Set(['wifi','parking','private_entrance','makeup_room','dressing_room','shower','kitchen','restroom','soundproof','lighting','green_screen','power_220v','accessible','outdoor','security','air_conditioning','load_in','bedroom','pool']);
const acceptedUses=new Set(['photography','filming','commercial','interviews','music_video','adult_production','nude_photography','explicit_adult_video','events','equipment_rental']);
const acceptedCategories=new Set(['film_studio','photo_studio','house','villa','loft','set','outdoor','equipment','dungeon','other']);
const safeDefaults=(source:any)=>{
 const v=source&&typeof source==='object'&&!Array.isArray(source)?source:{};
 const number=(key:string,min:number,max:number,fallback:number)=>{
  const n=Number(v[key]);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
 };
 return {
  category:acceptedCategories.has(v.category)?v.category:'house',
  capacity:Math.round(number('capacity',1,500,4)),
  minimum_hours:Math.round(number('minimum_hours',1,72,6)),
  hourly_rate:number('hourly_rate',1,100000,100),
  cleaning_fee_cents:Math.round(number('cleaning_fee_cents',0,10000000,0)),
  min_notice_hours:Math.round(number('min_notice_hours',0,720,24)),
  preferred_cleaning_minutes:Math.round(number('preferred_cleaning_minutes',0,1440,120)),
  cancellation_policy:['flexible','moderate','strict'].includes(v.cancellation_policy)?v.cancellation_policy:'moderate',
  deposit_percent:Math.round(number('deposit_percent',0,50,0)),
  required_insurance:v.required_insurance===true,
  rules:safe(v.rules,3000),
  amenities:Array.isArray(v.amenities)?[...new Set(v.amenities.filter((x:unknown)=>acceptedAmenities.has(x)))]:[],
  permitted_uses:Array.isArray(v.permitted_uses)?[...new Set(v.permitted_uses.filter((x:unknown)=>acceptedUses.has(x)))]:[],
 };
};
const hashClaim=(header:string)=>{try{const part=header.replace(/^Bearer\s+/i,'').split('.')[1];return JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')))?.aal||'aal1';}catch{return 'aal1';}};
const publicCols='id,owner_id,title,description,category,city,state,country,capacity,minimum_hours,hourly_rate,currency,amenities,permitted_uses,rules,setup_buffer_minutes,cleanup_buffer_minutes,cancellation_policy,deposit_percent,required_insurance,public_area_id,timezone,min_notice_hours,weekend_bps,holiday_bps,overtime_bps,cleaning_fee_cents,preferred_cleaning_minutes,status,created_at';
const ownerCols=publicCols+',submitted_at,approved_at';
const bookingCols='id,property_id,requester_id,owner_id,starts_at,ends_at,status,notes,requested_use,crew_size,estimated_total,hourly_rate_snapshot,created_at,updated_at';
const denial=(message:string,status=400)=>reply({error:message},status);

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return denial('Method not allowed',405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return denial('Service unavailable',503);
 const token=req.headers.get('Authorization')||'';
 const memberClient=createClient(url,pub,{global:{headers:{Authorization:token}}});
 const {data:{user},error:authError}=await memberClient.auth.getUser();
 if(authError||!user)return denial('Unauthorized',401);
 const db=createClient(url,secret),uid=user.id;
 const [security,age,plan,ohAccount]=await Promise.all([
  db.from('account_security').select('banned,suspended,admin').eq('user_id',uid).maybeSingle(),
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
  db.from('onlyhost_accounts').select('status').eq('user_id',uid).maybeSingle()
 ]);
 if(security.error||age.error||plan.error||ohAccount.error)return denial('Account status unavailable',503);
 if(security.data?.banned||security.data?.suspended)return denial('Account restricted',403);
 const hostAction=new Set(['host_create','host_update','host_submit','host_block_dates','host_remove_block','host_ical_import','host_photos_token','host_photos_register','host_photo_delete','host_private_details','host_bookings','host_booking_respond','turnover_create','turnover_list','turnover_task','turnover_upload_token','turnover_upload_register','turnover_photos','host_booking_complete','my_listings','host_dashboard_summary','host_blocks','host_private_get','host_defaults_get','host_defaults_set','host_video_token','host_video_register','host_video_delete']);
 const admin=security.data?.admin===true;
 const {data:hostAgreement,error:termsError}=await db.from('onlyhost_accounts')
   .select('status,terms_version,legal_capacity_confirmed,property_authority_confirmed,adult_production_understood')
   .eq('user_id',uid).maybeSingle();
 if(termsError)return denial('Host agreement unavailable',503);
 const onlyHostEligible=hostAgreement?.status==='active'&&hostAgreement.terms_version==='host-2026-11-17'&&
   hostAgreement.legal_capacity_confirmed===true&&hostAgreement.property_authority_confirmed===true&&
   hostAgreement.adult_production_understood===true;
 const paid=admin||subscribed(plan.data)||onlyHostEligible;
 const payload=await req.json().catch(()=>null);
 if(!payload||typeof payload!=='object')return denial('Invalid JSON',400);
 const action=safe(payload.action,55);
 if(!verified(age.data?.[0])&&!(hostAction.has(action)&&onlyHostEligible))
   return denial('Creator verification or accepted Host Connect property agreement required',403);
 if(['host_create','host_update','host_submit'].includes(action)&&!onlyHostEligible)
   return denial('Accept the current Host Connect property agreement before creating or publishing listings',403);
 const feature=async(key:string, tier='premium')=>{
  const {data,error}=await db.from('product_feature_flags').select('enabled,allowed_tiers,rollout_percent').eq('key',key).maybeSingle();
  if(error||!data?.enabled||!data.allowed_tiers?.includes(tier))return false;
  if(data.rollout_percent===100)return true;
  let hash=0;for(const char of uid+key)hash=(hash*31+char.charCodeAt(0))>>>0;
  return hash%100<data.rollout_percent;
 };
 if(!await feature('hosting_marketplace',paid?'premium':'free'))return denial('Marketplace is unavailable',403);
 const adminAction=action.startsWith('admin_');
 if(adminAction&&(!admin||hashClaim(token)!=='aal2'))return denial('Verified administrator MFA required',403);
 const paidAction=hostAction.has(action)||['booking_request','booking_cancel'].includes(action);
 if(paidAction&&(!paid||!await feature('hosting_marketplace','premium')))return denial('Premium membership required',403);
 if(['booking_request','booking_cancel','host_bookings','host_booking_respond','host_booking_complete'].includes(action)&&!await feature('hosting_requests','premium'))return denial('Hosting requests are paused',403);
 if(action.startsWith('turnover_')&&!await feature('hosting_turnover','premium'))return denial('Turnover tools are paused',403);
 const audit=async(name:string,id?:string,meta:Record<string,unknown>={})=>{
  await db.from('platform_action_audit').insert({actor_id:uid,action:name,target_type:'hosting',target_id:uuid(id)?id:null,metadata:meta});
 };
 const notify=async(recipient:string,kind:string,title:string,id:string)=>{
  await db.from('member_notifications').insert({recipient_id:recipient,kind,title,details:{property_id:id}});
 };
 const blockedOwners=async()=>{
  const {data,error}=await db.from('member_blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`).limit(200);
  if(error)throw error;
  return new Set((data||[]).map((v:any)=>v.blocker_id===uid?v.blocked_id:v.blocker_id));
 };
 const ownProperty=async(id:string)=>{
  const {data,error}=await db.from('properties').select(ownerCols).eq('id',id).eq('owner_id',uid).maybeSingle();
  if(error)throw error;
  return data;
 };
 const approvedPhotoLinks=async(items:any[],includeOwnerPending=false)=>{
  const ids=items.map((v:any)=>v.id);
  if(!ids.length)return items;
  const {data:photos,error}=await db.from('property_images')
    .select('id,property_id,uploader_id,storage_path,caption,position,status')
    .in('property_id',ids).order('position').limit(400);
  if(error)throw error;
  const allowed=(photos||[]).filter((p:any)=>p.status==='approved'||(includeOwnerPending&&p.uploader_id===uid));
  const enriched=await Promise.all(allowed.map(async(p:any)=>{
    const {data:link,error:linkError}=await db.storage.from('property-images').createSignedUrl(p.storage_path,300);
    return linkError?null:{id:p.id,property_id:p.property_id,caption:p.caption,status:p.status,url:link.signedUrl};
  }));
  const {data:videos,error:videoError}=await db.from('property_videos')
    .select('id,property_id,uploader_id,storage_path,caption,mime_type,status,position')
    .in('property_id',ids).order('position').limit(250);
  if(videoError)throw videoError;
  const allowedVideos=(videos||[]).filter((v:any)=>v.status==='approved'||(includeOwnerPending&&v.uploader_id===uid));
  const videoLinks=await Promise.all(allowedVideos.map(async(v:any)=>{
    const {data:link,error:linkError}=await db.storage.from('property-videos').createSignedUrl(v.storage_path,300);
    return linkError?null:{id:v.id,property_id:v.property_id,caption:v.caption,status:v.status,
      mime_type:v.mime_type,url:link.signedUrl};
  }));
  return items.map((item:any)=>({
    ...item,photos:enriched.filter(Boolean).filter((photo:any)=>photo.property_id===item.id),
    videos:videoLinks.filter(Boolean).filter((video:any)=>video.property_id===item.id)
  }));
 };
 try{
 switch(action){
 case 'browse':{
  const q=safe(payload.query,100),category=safe(payload.category,40),
   city=safe(payload.city,100),max=finite(payload.max_price),minCrew=finite(payload.crew_size);
  let query=db.from('properties').select(publicCols).eq('status','active').not('approved_at','is',null).order('created_at',{ascending:false}).limit(80);
  if(payload.bounds&&typeof payload.bounds==='object'){
   const v=payload.bounds;
   const west=Number(v.west),east=Number(v.east),south=Number(v.south),north=Number(v.north);
   if(![west,east,south,north].every(Number.isFinite)||west>east||south>north||
    west < -180||east>180||south< -85||north>85)return denial('Invalid map bounds');
   const {data:areaRows,error:mapError}=await db.from('hosting_public_areas').select('id')
    .gte('longitude',west).lte('longitude',east)
    .gte('latitude',south).lte('latitude',north).eq('approved',true).limit(500);
   if(mapError)throw mapError;
   const allowed=(areaRows||[]).map(x=>x.id);
   if(!allowed.length)return reply({items:[],count:0});
   query=query.in('public_area_id',allowed);
  }
  if(city)query=query.ilike('city',city.replace(/[%*_]/g,''));
  if(category&&acceptedCategories.has(category))query=query.eq('category',category);
  if(Number.isFinite(max)&&max>0)query=query.lte('hourly_rate',max);
  if(Number.isInteger(minCrew)&&minCrew>0)query=query.gte('capacity',minCrew);
  const amenity=safe(payload.amenity,45);
  if(amenity&&acceptedAmenities.has(amenity))query=query.contains('amenities',[amenity]);
  if(q)query=query.or(`title.ilike.%${q.replace(/[%.,()]/g,'')}%,description.ilike.%${q.replace(/[%.,()]/g,'')}%`);
  const {data,error}=await query;
  if(error)throw error;
  const blocked=await blockedOwners();
  const owners=[...new Set((data||[]).map((v:any)=>v.owner_id))];
  const [bad,ages]=await Promise.all([
    owners.length?db.from('account_security').select('user_id,banned,suspended').in('user_id',owners):Promise.resolve({data:[],error:null}),
    owners.length?db.from('age_verification_requests').select('user_id,status,expires_at,created_at').in('user_id',owners).order('created_at',{ascending:false}).limit(1200):Promise.resolve({data:[],error:null})
  ]);
  if(bad.error||ages.error)throw bad.error||ages.error;
  const restricted=new Set((bad.data||[]).filter((v:any)=>v.banned||v.suspended).map((v:any)=>v.user_id));
  const latest=new Map<string,any>();for(const v of ages.data||[])if(!latest.has(v.user_id))latest.set(v.user_id,v);
  const {data:hostAccounts,error:hostError}=owners.length?await db.from('onlyhost_accounts').select('user_id,status,terms_version').in('user_id',owners):{data:[],error:null};
  if(hostError)throw hostError;
  const approvedHosts=new Set((hostAccounts||[]).filter((v:any)=>v.status==='active'&&v.terms_version==='host-2026-11-17').map((v:any)=>v.user_id));
  let visible=(data||[]).filter((v:any)=>!blocked.has(v.owner_id)&&!restricted.has(v.owner_id)&&(verified(latest.get(v.owner_id))||approvedHosts.has(v.owner_id)));
  // Date-filtered search is a convenience; the insert trigger remains authoritative.
  const from=moment(payload.from),to=moment(payload.to);
  if(from&&to){
    if(Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>72*3600000)return denial('Date search window must be within 72 hours');
    const ids=visible.map((v:any)=>v.id);
    if(ids.length){
      const low=new Date(Date.parse(from)-86400000).toISOString(),high=new Date(Date.parse(to)+86400000).toISOString();
      const [bookings,blackouts]=await Promise.all([
        db.from('property_booking_requests').select('property_id,starts_at,ends_at').in('property_id',ids)
          .in('status',['requested','accepted']).lt('starts_at',high).gt('ends_at',low),
        db.from('property_unavailable').select('property_id,starts_at,ends_at').in('property_id',ids)
          .lt('starts_at',high).gt('ends_at',low)
      ]);
      if(bookings.error||blackouts.error)throw bookings.error||blackouts.error;
      visible=visible.filter((property:any)=>{
        const start=Date.parse(from)-property.setup_buffer_minutes*60000;
        const end=Date.parse(to)+property.cleanup_buffer_minutes*60000;
        return ![...(bookings.data||[]),...(blackouts.data||[])].some((b:any)=>
          b.property_id===property.id&&Date.parse(b.starts_at)<end&&Date.parse(b.ends_at)>start
        );
      });
    }
  }
  const ids=visible.map((v:any)=>v.id);
  const {data:ratings,error:ratingError}=ids.length?await db.from('property_reviews')
    .select('property_id,rating').in('property_id',ids).eq('status','published').limit(2500):{data:[],error:null};
  if(ratingError)throw ratingError;
  const items=await approvedPhotoLinks(visible);
  return reply({items:items.map((v:any)=>{
    const values=(ratings||[]).filter((review:any)=>review.property_id===v.id).map((review:any)=>review.rating);
    return {...v,rating_count:values.length,rating_average:values.length?
      Math.round(values.reduce((a:number,b:number)=>a+b,0)*10/values.length)/10:null};
  }),count:items.length});
 }
 case 'listing':{
  if(!uuid(payload.id))return denial('Valid listing required');
  const {data,error}=await db.from('properties').select(publicCols).eq('id',payload.id).eq('status','active').not('approved_at','is',null).maybeSingle();
  if(error||!data)return denial('Listing not available',404);
  const blocked=await blockedOwners();if(blocked.has(data.owner_id))return denial('Listing not available',404);
  const {data:ownerAge}=await db.from('age_verification_requests').select('status,expires_at').eq('user_id',data.owner_id).order('created_at',{ascending:false}).limit(1);
  if(!verified(ownerAge?.[0])){
    const {data:host}=await db.from('onlyhost_accounts').select('status,terms_version')
      .eq('user_id',data.owner_id).maybeSingle();
    if(host?.status!=='active'||host?.terms_version!=='host-2026-11-17')return denial('Listing not available',404);
  }
  const {data:ownerSecurity,error:ownerError}=await db.from('account_security').select('banned,suspended').eq('user_id',data.owner_id).maybeSingle();
  if(ownerError||ownerSecurity?.banned||ownerSecurity?.suspended)return denial('Listing not available',404);
  const {data:blocks,error:bError}=await db.from('property_unavailable').select('starts_at,ends_at').eq('property_id',data.id).gte('ends_at',new Date().toISOString()).limit(100);
  if(bError)throw bError;
  const {data:booked,error:bookingError}=await db.from('property_booking_requests').select('starts_at,ends_at')
    .eq('property_id',data.id).in('status',['requested','accepted']).gte('ends_at',new Date().toISOString()).limit(100);
  if(bookingError)throw bookingError;
  // Count at most one authenticated non-owner view per day; never expose viewer identities to hosts.
  if(data.owner_id!==uid)await db.from('hosting_listing_views')
    .upsert({property_id:data.id,viewer_id:uid},{onConflict:'property_id,viewer_id,viewed_on',ignoreDuplicates:true});
  const [enriched]=await approvedPhotoLinks([data]);
  return reply({item:enriched,unavailable:[...(blocks||[]),...(booked||[])]});
 }
 case 'favorites':{
  const {data,error}=await db.from('property_favorites').select('property_id').eq('user_id',uid).limit(500);
  if(error)throw error;
  return reply({ids:(data||[]).map((v:any)=>v.property_id)});
 }
 case 'favorite_toggle':{
  if(!uuid(payload.id))return denial('Valid listing required');
  const {data:property}=await db.from('properties').select('id,status').eq('id',payload.id).maybeSingle();
  if(property?.status!=='active')return denial('Listing unavailable',404);
  const {data:prior}=await db.from('property_favorites').select('property_id').eq('user_id',uid).eq('property_id',payload.id).maybeSingle();
  const result=prior?await db.from('property_favorites').delete().eq('user_id',uid).eq('property_id',payload.id):
   await db.from('property_favorites').insert({user_id:uid,property_id:payload.id});
  if(result.error)throw result.error;
  return reply({favorite:!prior});
 }
 case 'my_listings':{
  const {data,error}=await db.from('properties').select(ownerCols).eq('owner_id',uid).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  return reply({items:await approvedPhotoLinks(data||[],true)});
 }
 case 'host_dashboard_summary':{
  const {data:owned,error:ownError}=await db.from('properties')
    .select('id,status,title').eq('owner_id',uid).limit(100);
  if(ownError)throw ownError;
  const ids=(owned||[]).map((v:any)=>v.id);
  if(!ids.length)return reply({properties:0,active:0,views_30d:0,booking_requests:0,upcoming:0,conversations:0,by_property:[]});
  const cutoff=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const [views,bookings,threads]=await Promise.all([
    db.from('hosting_listing_views').select('property_id').in('property_id',ids).gte('viewed_on',cutoff).limit(10000),
    db.from('property_booking_requests').select('property_id,status,starts_at').eq('owner_id',uid).limit(1000),
    db.from('hosting_booking_conversations').select('booking_id').in('booking_id',
      (await db.from('property_booking_requests').select('id').eq('owner_id',uid).limit(1000)).data?.map((v:any)=>v.id)||['00000000-0000-0000-0000-000000000000']).limit(1000)
  ]);
  if(views.error||bookings.error||threads.error)throw views.error||bookings.error||threads.error;
  const now=Date.now();
  return reply({
    properties:ids.length,active:(owned||[]).filter((v:any)=>v.status==='active').length,
    views_30d:(views.data||[]).length,
    booking_requests:(bookings.data||[]).filter((v:any)=>v.status==='requested').length,
    upcoming:(bookings.data||[]).filter((v:any)=>v.status==='accepted'&&Date.parse(v.starts_at)>now).length,
    conversations:(threads.data||[]).length,
    by_property:(owned||[]).map((v:any)=>({id:v.id,title:v.title,views_30d:(views.data||[]).filter((x:any)=>x.property_id===v.id).length}))
  });
 }
 case 'host_defaults_get':{
  const {data,error}=await db.from('host_listing_defaults').select('settings,updated_at').eq('user_id',uid).maybeSingle();
  if(error)throw error;
  return reply({settings:data?.settings?safeDefaults(data.settings):null,updated_at:data?.updated_at||null});
 }
 case 'host_defaults_set':{
  const settings=safeDefaults(payload.settings);
  const {data,error}=await db.from('host_listing_defaults')
    .upsert({user_id:uid,settings,updated_at:new Date().toISOString()},{onConflict:'user_id'})
    .select('settings,updated_at').single();
  if(error)throw error;await audit('host_listing_defaults_updated');
  return reply({settings:data.settings,updated_at:data.updated_at});
 }
 case 'host_video_token':{
  if(!uuid(payload.id))return denial('Invalid property');
  const owner=await ownProperty(payload.id);
  if(!owner||!['draft','pending_review','active','paused'].includes(owner.status))return denial('Not your property',403);
  const type=safe(payload.mime_type,50);
  if(!['video/mp4','video/webm'].includes(type))return denial('Only MP4 or WebM video is supported');
  const {data:existing,error:videosError}=await db.from('property_videos').select('id').eq('property_id',owner.id);
  if(videosError||existing?.length>=5)return denial('Maximum five property videos',429);
  const filename=uid+'/'+owner.id+'/'+crypto.randomUUID()+(type==='video/mp4'?'.mp4':'.webm');
  const {data,error}=await db.storage.from('property-videos').createSignedUploadUrl(filename);
  if(error)throw error;
  return reply({path:filename,token:data.token});
 }
 case 'host_video_register':{
  if(!uuid(payload.id)||typeof payload.path!=='string')return denial('Invalid video');
  const owner=await ownProperty(payload.id);if(!owner)return denial('Not your property',403);
  if(!payload.path.startsWith(uid+'/'+owner.id+'/')||payload.path.includes('..')||payload.path.length>350)
    return denial('Invalid private video path',403);
  const {data:object,error:storageError}=await db.storage.from('property-videos').info(payload.path);
  if(storageError||!object)return denial('Uploaded video not found',404);
  const type=object.metadata?.mimetype||safe(payload.mime_type,40);
  if(!['video/mp4','video/webm'].includes(type)||Number(object.metadata?.size||0)>41943040)
    return denial('Unsupported video or file too large',400);
  const {data:existing,error:existingError}=await db.from('property_videos').select('id').eq('property_id',owner.id);
  if(existingError||existing?.length>=5)return denial('Maximum five property videos',429);
  const {data,error}=await db.from('property_videos').insert({
    property_id:owner.id,uploader_id:uid,storage_path:payload.path,mime_type:type,
    caption:safe(payload.caption,250),position:existing?.length||0,status:'pending'
  }).select('id,status').single();
  if(error)throw error;
  if(owner.status==='active')await db.from('properties').update({status:'pending_review',approved_at:null,approved_by:null}).eq('id',owner.id);
  await audit('host_video_uploaded',data.id);
  return reply({item:data,note:'Video uploaded privately for human moderation; not public until approved.'},201);
 }
 case 'host_video_delete':{
  if(!uuid(payload.id))return denial('Video required');
  const {data:video}=await db.from('property_videos').select('id,property_id,storage_path')
    .eq('id',payload.id).eq('uploader_id',uid).maybeSingle();
  if(!video||!await ownProperty(video.property_id))return denial('Video unavailable',403);
  const {error}=await db.from('property_videos').delete().eq('id',video.id);
  if(error)throw error;
  await db.storage.from('property-videos').remove([video.storage_path]);
  return reply({ok:true});
 }
 case 'host_create':{
  const title=safe(payload.title,140),city=safe(payload.city,100),country=safe(payload.country,100);
  const rate=finite(payload.hourly_rate),crew=finite(payload.capacity),minHours=finite(payload.minimum_hours);
  const category=safe(payload.category,40);
  const cleaning=Number(payload.cleaning_fee_cents??0),
    notice=Number(payload.min_notice_hours??24),
    cleaningMinutes=Number(payload.preferred_cleaning_minutes??120);
  if(!Number.isSafeInteger(cleaning)||cleaning<0||cleaning>10000000||
     !Number.isInteger(notice)||notice<0||notice>720||
     !Number.isInteger(cleaningMinutes)||cleaningMinutes<0||cleaningMinutes>1440)
    return denial('Invalid cleaning fee or booking notice settings');
  if(title.length<5||city.length<2||country.length<2||!acceptedCategories.has(category)||!Number.isFinite(rate)||rate<=0||rate>100000||
     !Number.isInteger(crew)||crew<1||crew>500||!Number.isInteger(minHours)||minHours<1||minHours>72)
   return denial('Valid title, location, category, rate, capacity and minimum booking hours required');
  const permitted=Array.isArray(payload.permitted_uses)?payload.permitted_uses.filter((v:any)=>acceptedUses.has(v)):[];
  if(!permitted.length)return denial('Select permitted production uses');
  const amenities=Array.isArray(payload.amenities)?payload.amenities.filter((v:any)=>acceptedAmenities.has(v)):[];
  const {data,error}=await db.from('properties').insert({
   owner_id:uid,status:'draft',created_via_brand:payload.source_brand==='onlyhost'&&onlyHostEligible?'onlyhost':'content_connect',title,city,country,state:safe(payload.state,100),category,hourly_rate:rate,capacity:crew,
   minimum_hours:minHours,description:safe(payload.description,4000),permitted_uses:[...new Set(permitted)],
   amenities:[...new Set(amenities)],rules:safe(payload.rules,3000),
   setup_buffer_minutes:30,cleanup_buffer_minutes:30,
   cleaning_fee_cents:cleaning,min_notice_hours:notice,preferred_cleaning_minutes:cleaningMinutes,
   cancellation_policy:['flexible','moderate','strict'].includes(payload.cancellation_policy)?payload.cancellation_policy:'flexible',
   deposit_percent:Number.isInteger(payload.deposit_percent)&&payload.deposit_percent>=0&&payload.deposit_percent<=50?payload.deposit_percent:0,
   required_insurance:payload.required_insurance===true
  }).select('id,status,title').single();
  if(error)throw error;await audit('host_listing_created',data.id);return reply({item:data},201);
 }
 case 'host_update':{
  if(!uuid(payload.id))return denial('Invalid property');
  const original=await ownProperty(payload.id);if(!original)return denial('Property unavailable',403);
  const allowedStatuses=['draft','pending_review','active','paused'];
  if(!allowedStatuses.includes(original.status))return denial('Contact support to update this property',403);
  const title=safe(payload.title,140),city=safe(payload.city,100),country=safe(payload.country,100),
   category=safe(payload.category,40),rate=finite(payload.hourly_rate),crew=finite(payload.capacity),
   minimum=finite(payload.minimum_hours);
  const cleaning=Number(payload.cleaning_fee_cents??original.cleaning_fee_cents??0),
    notice=Number(payload.min_notice_hours??original.min_notice_hours??24),
    cleaningMinutes=Number(payload.preferred_cleaning_minutes??120);
  if(!Number.isSafeInteger(cleaning)||cleaning<0||cleaning>10000000||
     !Number.isInteger(notice)||notice<0||notice>720||
     !Number.isInteger(cleaningMinutes)||cleaningMinutes<0||cleaningMinutes>1440)
    return denial('Invalid cleaning fee or booking notice settings');
  if(title.length<5||city.length<2||country.length<2||!acceptedCategories.has(category)||!Number.isFinite(rate)||rate<=0||rate>100000||
     !Number.isInteger(crew)||crew<1||crew>500||!Number.isInteger(minimum)||minimum<1||minimum>72)return denial('Invalid listing details');
  const uses=Array.isArray(payload.permitted_uses)?payload.permitted_uses.filter((v:any)=>acceptedUses.has(v)):[];
  if(!uses.length)return denial('Select permitted production uses');
  const amenities=Array.isArray(payload.amenities)?payload.amenities.filter((v:any)=>acceptedAmenities.has(v)):[];
  const {data,error}=await db.from('properties').update({
   status:'draft',approved_at:null,approved_by:null,
   title,city,country,state:safe(payload.state,100),category,hourly_rate:rate,
   capacity:crew,minimum_hours:minimum,description:safe(payload.description,4000),rules:safe(payload.rules,3000),
   cleaning_fee_cents:cleaning,min_notice_hours:notice,preferred_cleaning_minutes:cleaningMinutes,
   permitted_uses:[...new Set(uses)],amenities:[...new Set(amenities)],updated_at:new Date().toISOString(),
   cancellation_policy:['flexible','moderate','strict'].includes(payload.cancellation_policy)?payload.cancellation_policy:'flexible',
   deposit_percent:Number.isInteger(payload.deposit_percent)&&payload.deposit_percent>=0&&payload.deposit_percent<=50?payload.deposit_percent:0,
   required_insurance:payload.required_insurance===true
  }).eq('id',original.id).eq('owner_id',uid).select('id,status').maybeSingle();
  if(error||!data)throw error||Error('Property update failed');
  await audit('host_listing_updated',data.id);return reply({item:data});
 }
 case 'host_submit':{
  if(!uuid(payload.id))return denial('Invalid property');
  const property=await ownProperty(payload.id);
  if(!property||!['draft','pending_review'].includes(property.status))return denial('Only draft listings can be submitted',403);
  if(!property.permitted_uses?.length)return denial('Select permitted uses');
  const {data:privateInfo,error:privateError}=await db.from('property_private')
    .select('exact_address').eq('property_id',property.id).maybeSingle();
  if(privateError||!privateInfo?.exact_address||privateInfo.exact_address.trim().length<8)
    return denial('Save the complete private street address before submitting this listing for review',400);
  const {data:photos,error:photosError}=await db.from('property_images').select('id').eq('property_id',property.id).in('status',['pending','approved']).limit(1);
  if(photosError||!photos?.length)return denial('At least one privately uploaded property photo required',400);
  const {data,error}=await db.from('properties').update({status:'pending_review',submitted_at:new Date().toISOString()}).eq('id',property.id).eq('owner_id',uid).select('id,status').single();
  if(error)throw error;
  await audit('host_listing_submitted',property.id);
  return reply({item:data,note:'Listing is pending administrator review; it is not public yet.'});
 }
 case 'host_photos_token':{
  if(!uuid(payload.id))return denial('Invalid property');
  const owner=await ownProperty(payload.id);
  if(!owner||!['draft','pending_review','active','paused'].includes(owner.status))return denial('Property unavailable',403);
  const type=safe(payload.mime_type,50);
  if(!['image/jpeg','image/png','image/webp'].includes(type))return denial('Only JPEG, PNG or WebP supported');
  const extension=type==='image/jpeg'?'jpg':type.split('/')[1];
  const path=uid+'/'+owner.id+'/'+crypto.randomUUID()+'.'+extension;
  const {data,error}=await db.storage.from('property-images').createSignedUploadUrl(path);
  if(error)throw error;
  return reply({path,token:data.token,mime_type:type});
 }
 case 'host_photos_register':{
  if(!uuid(payload.id)||typeof payload.path!=='string')return denial('Invalid image request');
  const owner=await ownProperty(payload.id);
  if(!owner)return denial('Not your listing',403);
  const path=payload.path;
  if(!path.startsWith(uid+'/'+owner.id+'/')||path.includes('..')||path.length>350)return denial('Invalid private image path',403);
  const {data:object,error:infoError}=await db.storage.from('property-images').info(path);
  if(infoError||!object)return denial('Upload not present',404);
  const type=object.metadata?.mimetype||safe(payload.mime_type,40);
  if(!['image/jpeg','image/png','image/webp'].includes(type))return denial('Unsupported file',400);
  const {data:count,error:countError}=await db.from('property_images').select('id').eq('property_id',owner.id);
  if(countError||count?.length>=20)return denial('Maximum of 20 photos per listing',429);
  const {data,error}=await db.from('property_images').insert({
   property_id:owner.id,uploader_id:uid,storage_path:path,mime_type:type,
   caption:safe(payload.caption,250),position:count?.length||0,status:'pending'
  }).select('id,status').single();
  if(error)throw error;
  if(owner.status==='active')await db.from('properties').update({status:'pending_review',approved_by:null,approved_at:null}).eq('id',owner.id);
  return reply({item:data,note:'Photo uploaded privately and queued for review.'},201);
 }
 case 'host_photo_delete':{
  if(!uuid(payload.id))return denial('Invalid image');
  const {data:photo}=await db.from('property_images').select('id,property_id,storage_path').eq('id',payload.id).eq('uploader_id',uid).maybeSingle();
  if(!photo||!await ownProperty(photo.property_id))return denial('Image unavailable',403);
  await db.from('property_images').delete().eq('id',photo.id);
  await db.storage.from('property-images').remove([photo.storage_path]);
  return reply({ok:true});
 }
 case 'host_block_dates':{
  if(!uuid(payload.id))return denial('Invalid property');
  const owner=await ownProperty(payload.id);if(!owner)return denial('Not your listing',403);
  const start=moment(payload.starts_at),end=moment(payload.ends_at);
  if(!start||!end||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>90*86400000)return denial('Invalid blocked interval',400);
  const {data:overlap}=await db.from('property_booking_requests').select('id').eq('property_id',owner.id)
   .in('status',['requested','accepted']).lt('starts_at',end).gt('ends_at',start).limit(1);
  if(overlap?.length)return denial('Already booked; resolve the reservation first',409);
  const {data,error}=await db.from('property_unavailable').insert({property_id:owner.id,blocked_by:uid,starts_at:start,ends_at:end,reason:safe(payload.reason,200)}).select('id').single();
  if(error)throw error;return reply({item:data},201);
 }

 case 'host_ical_import':{
  if(!uuid(payload.id)||!await ownProperty(payload.id))return denial('Not your listing',403);
  const raw=payload.ics;
  if(typeof raw!=='string'||raw.length>200000||!raw.includes('BEGIN:VCALENDAR'))return denial('A valid iCalendar file under 200 KB is required',400);
  const normalized=raw.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,'').replace(/\r/g,'');
  const rawEvents=normalized.split('BEGIN:VEVENT').slice(1).map(v=>v.split('END:VEVENT')[0]);
  if(!rawEvents.length||rawEvents.length>150)return denial('Calendar must contain between 1 and 150 events',400);
  const parseDate=(v:string)=>{
    const value=v.trim();
    if(/^\d{8}$/.test(value))
      {const date=new Date(value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8)+'T00:00:00Z');return Number.isFinite(date.getTime())?date.toISOString():null;}
    if(/^\d{8}T\d{6}Z$/.test(value))
      {const date=new Date(value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8)+'T'+value.slice(9,11)+':'+value.slice(11,13)+':'+value.slice(13,15)+'Z');return Number.isFinite(date.getTime())?date.toISOString():null;}
    return null;
  };
  let added=0,ignored=0;
  for(const event of rawEvents){
    const lines=event.split('\n');
    const startLine=lines.find(v=>v.startsWith('DTSTART:')||v.startsWith('DTSTART;VALUE=DATE:'));
    const endLine=lines.find(v=>v.startsWith('DTEND:')||v.startsWith('DTEND;VALUE=DATE:'));
    const uidLine=lines.find(v=>v.startsWith('UID:'));
    if(!startLine||!endLine){ignored++;continue;}
    const start=parseDate(startLine.slice(startLine.indexOf(':')+1));
    const end=parseDate(endLine.slice(endLine.indexOf(':')+1));
    if(!start||!end||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>90*86400000){ignored++;continue;}
    if(Date.parse(end)<Date.now()-30*86400000){ignored++;continue;}
    const identity=uidLine?uidLine.slice(4).trim():(start+end);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
    const key=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const {error}=await db.from('property_unavailable').upsert({
      property_id:payload.id,blocked_by:uid,starts_at:start,ends_at:end,
      reason:'Imported calendar block',source:'ics_upload',source_uid_hash:key
    },{onConflict:'property_id,source_uid_hash'});
    // A conflicting booking is not overwritten. Hosts must resolve it manually.
    if(error)ignored++;else added++;
  }
  await audit('hosting_ical_import',payload.id,{added,ignored});
  return reply({imported:added,ignored,note:'Imported events block booking dates. Unsupported timezones or conflicting entries were skipped.'});
 }
 case 'host_remove_block':{
  if(!uuid(payload.id))return denial('Invalid block');
  const {data:blocked,error}=await db.from('property_unavailable').delete().eq('id',payload.id).eq('blocked_by',uid).select('id').maybeSingle();
  if(error||!blocked)return denial('Block unavailable',404);return reply({ok:true});
 }
 case 'host_blocks':{
  if(!uuid(payload.id)||!await ownProperty(payload.id))return denial('Not your listing',403);
  const {data,error}=await db.from('property_unavailable').select('id,starts_at,ends_at,reason,source').eq('property_id',payload.id).order('starts_at').limit(200);
  if(error)throw error;return reply({items:data});
 }
 case 'booking_request':return denial('Use the transactional dynamic-pricing reservation workflow',409);
  case 'my_bookings':
 case 'host_bookings':{
  if(action==='host_bookings'&&!paid)return denial('Premium hosting required',403);
  let q=db.from('property_booking_requests').select(bookingCols).order('created_at',{ascending:false}).limit(150);
  q=action==='host_bookings'?q.eq('owner_id',uid):q.eq('requester_id',uid);
  const {data,error}=await q;if(error)throw error;
  return reply({items:data||[]});
 }
 case 'booking_cancel':return denial('Use the booking cancellation-policy workflow',409);
 case 'host_booking_respond':{
  if(!uuid(payload.id))return denial('Invalid reservation');
  const {data:reservation}=await db.from('property_booking_requests').select(bookingCols).eq('id',payload.id).maybeSingle();
  if(!reservation)return denial('Reservation not found',404);
  const isHost=reservation.owner_id===uid,isGuest=reservation.requester_id===uid;
  if(action==='host_booking_respond'&&!isHost||action==='booking_cancel'&&!isGuest&&!isHost)return denial('Not a reservation participant',403);
  let next:string;
  if(action==='booking_cancel')next='cancelled';
  else if(['accepted','declined'].includes(payload.status))next=payload.status;
  else return denial('Invalid decision');
  if(reservation.status!=='requested'&&!(reservation.status==='accepted'&&next==='cancelled'))
    return denial('Reservation already resolved',409);
  const {data,error}=await db.from('property_booking_requests').update({status:next,updated_at:new Date().toISOString()})
   .eq('id',reservation.id).eq('status',reservation.status).select(bookingCols).maybeSingle();
  if(error||!data)return denial('Reservation changed during review',409);
  const recipient=isHost?reservation.requester_id:reservation.owner_id;
  await notify(recipient,'hosting_booking','Booking '+next,reservation.property_id);
  await audit('hosting_booking_'+next,reservation.id);
  return reply({item:data,note:'No payment processed by Content Connect X.'});
 }
 case 'turnover_create':{
  if(!uuid(payload.id))return denial('Valid listing required');
  const owner=await ownProperty(payload.id);if(!owner)return denial('Only the venue owner can schedule turnover',403);
  let bookingId:null|string=null;
  if(payload.booking_id){
   const {data:booking}=await db.from('property_booking_requests').select('id').eq('id',payload.booking_id).eq('owner_id',uid).eq('property_id',owner.id).maybeSingle();
   if(!booking)return denial('Booking does not belong to property',403);
   bookingId=booking.id;
  }
  const {data,error}=await db.from('property_turnovers').insert({
    property_id:owner.id,booking_id:bookingId,created_by:uid,due_at:moment(payload.due_at)||null
  }).select('id,status').single();
  if(error)throw error;
  const labels=['Check entry and access','Inspect rooms and set','Collect trash and clean surfaces','Inspect equipment and power','Check supplies and restock','Photograph before/after condition','Lock and secure location'];
  const {error:tError}=await db.from('property_turnover_tasks').insert(labels.map((label,i)=>({turnover_id:data.id,label,position:i})));
  if(tError)throw tError;
  return reply({item:data},201);
 }
 case 'turnover_list':{
  if(!uuid(payload.id)||!await ownProperty(payload.id))return denial('Only host may view turnover',403);
  const {data,error}=await db.from('property_turnovers').select('id,status,due_at,completed_at,booking_id,created_at').eq('property_id',payload.id).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  const ids=(data||[]).map((v:any)=>v.id);
  const {data:tasks,error:tError}=ids.length?await db.from('property_turnover_tasks').select('id,turnover_id,label,done,position').in('turnover_id',ids).order('position'):{data:[],error:null};
  if(tError)throw tError;
  return reply({items:(data||[]).map((v:any)=>({...v,tasks:(tasks||[]).filter((t:any)=>t.turnover_id===v.id)}))});
 }
 case 'turnover_task':{
  if(!uuid(payload.id)||typeof payload.done!=='boolean')return denial('Invalid task');
  const {data:task}=await db.from('property_turnover_tasks').select('id,turnover_id').eq('id',payload.id).maybeSingle();
  if(!task)return denial('Task not found',404);
  const {data:turnover}=await db.from('property_turnovers').select('id,property_id').eq('id',task.turnover_id).maybeSingle();
  if(!turnover||!await ownProperty(turnover.property_id))return denial('Not your turnover',403);
  const {error}=await db.from('property_turnover_tasks').update({done:payload.done,done_at:payload.done?new Date().toISOString():null}).eq('id',task.id);
  if(error)throw error;
  const {data:tasks}=await db.from('property_turnover_tasks').select('done').eq('turnover_id',turnover.id);
  const completed=Boolean(tasks?.length&&tasks.every((v:any)=>v.done));
  await db.from('property_turnovers').update({status:completed?'completed':'in_progress',completed_at:completed?new Date().toISOString():null}).eq('id',turnover.id);
  return reply({ok:true,completed});
 }

 case 'host_private_details':{
  if(!uuid(payload.id)||!await ownProperty(payload.id))return denial('Not your property',403);
  const address=safe(payload.exact_address,400),instructions=safe(payload.entry_instructions,1500),
    notes=safe(payload.internal_notes,1500);
  if(address.length<8)return denial('A usable street address is required');
  const {error}=await db.from('property_private').upsert({
   property_id:payload.id,exact_address:address,entry_instructions:instructions,
   internal_notes:notes
  },{onConflict:'property_id'});
  if(error)throw error;
  await audit('hosting_private_address_updated',payload.id);
  return reply({ok:true,note:'Private entry information saved. It is not available in marketplace search.'});
 }
 case 'host_private_get':{
  if(!uuid(payload.id)||!await ownProperty(payload.id))return denial('Not your property',403);
  const {data,error}=await db.from('property_private').select('exact_address,entry_instructions,internal_notes').eq('property_id',payload.id).maybeSingle();
  if(error)throw error;
  return reply({item:data||{exact_address:'',entry_instructions:'',internal_notes:''}});
 }
 case 'guest_checkin_details':{
  if(!uuid(payload.booking_id))return denial('Booking ID required');
  const {data:booking,error}=await db.from('property_booking_requests')
   .select('property_id,requester_id,owner_id,status,starts_at,ends_at,legal_status,payment_status').eq('id',payload.booking_id).maybeSingle();
  if(error||!booking||![booking.requester_id,booking.owner_id].includes(uid))return denial('Booking unavailable',403);
  if(!['accepted','completed'].includes(booking.status)||booking.legal_status!=='signed'||!['captured','partially_refunded'].includes(booking.payment_status))
    return denial('Completed rental agreement and confirmed payment required before private entry information is shared',403);
  const {data:info,error:detailsError}=await db.from('property_private')
   .select('exact_address,entry_instructions').eq('property_id',booking.property_id).maybeSingle();
  if(detailsError)throw detailsError;
  await audit('hosting_entry_details_accessed',booking.property_id,{booking_id:payload.booking_id});
  return reply({item:info||{exact_address:null,entry_instructions:null}});
 }
 case 'host_booking_complete':{
  if(!uuid(payload.id))return denial('Booking ID required');
  const {data:booking}=await db.from('property_booking_requests').select('id,property_id,owner_id,requester_id,status,ends_at,legal_status,payment_status').eq('id',payload.id).maybeSingle();
  if(!booking||booking.owner_id!==uid)return denial('Only the property owner can complete a booking',403);
  if(booking.status!=='accepted'||booking.legal_status!=='signed'||!['captured','partially_refunded'].includes(booking.payment_status)||Date.parse(booking.ends_at)>Date.now())return denial('Completion requires a finished, signed and funded rental',409);
  const {data,error}=await db.from('property_booking_requests')
   .update({status:'completed',updated_at:new Date().toISOString()})
   .eq('id',booking.id).eq('status','accepted').select('id,status').maybeSingle();
  if(error||!data)return denial('Booking changed during completion',409);
  await notify(booking.requester_id,'hosting_booking','Location visit marked complete',booking.property_id);
  return reply({item:data});
 }
 case 'reviews_public':{
  if(!uuid(payload.id))return denial('Valid listing required');
  const {data:property}=await db.from('properties').select('id,status').eq('id',payload.id).maybeSingle();
  if(property?.status!=='active')return denial('Listing unavailable',404);
  const {data,error}=await db.from('property_reviews').select('id,rating,description,created_at')
   .eq('property_id',payload.id).eq('status','published').order('created_at',{ascending:false}).limit(60);
  if(error)throw error;
  const items=data||[],ratings=items.map((v:any)=>v.rating);
  return reply({items,average:ratings.length?Math.round(ratings.reduce((x:number,y:number)=>x+y,0)*10/ratings.length)/10:null,count:ratings.length});
 }
 case 'reviews_submit':{
  if(!uuid(payload.booking_id))return denial('Completed booking required');
  const {data:booking}=await db.from('property_booking_requests')
   .select('id,property_id,requester_id,status').eq('id',payload.booking_id).maybeSingle();
  if(!booking||booking.requester_id!==uid||booking.status!=='completed')return denial('Only completed guest bookings may be reviewed',403);
  const rating=finite(payload.rating);
  if(!Number.isInteger(rating)||rating<1||rating>5)return denial('Rating must be 1–5',400);
  const {data,error}=await db.from('property_reviews').insert({
   booking_id:booking.id,property_id:booking.property_id,author_id:uid,
   rating,description:safe(payload.description,1200),status:'pending'
  }).select('id,status').single();
  if(error)return denial('Review has already been submitted or is unavailable',409);
  return reply({item:data,note:'Review submitted for human moderation.'},201);
 }
 case 'admin_review_queue':{
  const {data,error}=await db.from('property_reviews')
   .select('id,property_id,author_id,rating,description,created_at').eq('status','pending').order('created_at').limit(60);
  if(error)throw error;
  return reply({items:data||[]});
 }
 case 'admin_review_decide':{
  if(!uuid(payload.id)||!['published','rejected'].includes(payload.status)||payload.human_review_confirmed!==true)
   return denial('Independent review and valid decision required',400);
  const {data:old}=await db.from('property_reviews').select('id,author_id,status').eq('id',payload.id).maybeSingle();
  if(!old||old.status!=='pending'||old.author_id===uid)return denial('Review unavailable',403);
  const {data,error}=await db.from('property_reviews').update({status:payload.status,reviewed_by:uid})
   .eq('id',old.id).eq('status','pending').select('id,status').maybeSingle();
  if(error||!data)return denial('Review changed during moderation',409);
  await audit('hosting_review_moderated',data.id,{status:data.status});
  return reply({item:data});
 }
 case 'turnover_upload_token':{
  if(!uuid(payload.id))return denial('Turnover ID required');
  const {data:turnover}=await db.from('property_turnovers').select('id,property_id').eq('id',payload.id).maybeSingle();
  if(!turnover||!await ownProperty(turnover.property_id))return denial('Not your turnover',403);
  const type=safe(payload.mime_type,50);
  if(!['image/jpeg','image/png','image/webp'].includes(type))return denial('Only JPEG, PNG or WebP supported');
  const extension=type==='image/jpeg'?'jpg':type.split('/')[1];
  const path=uid+'/'+turnover.property_id+'/inspections/'+turnover.id+'/'+crypto.randomUUID()+'.'+extension;
  const {data,error}=await db.storage.from('property-inspections').createSignedUploadUrl(path);
  if(error)throw error;
  return reply({path,token:data.token});
 }
 case 'turnover_upload_register':{
  if(!uuid(payload.id)||!['before','after'].includes(payload.phase)||typeof payload.path!=='string')return denial('Invalid inspection upload',400);
  const {data:turnover}=await db.from('property_turnovers').select('id,property_id').eq('id',payload.id).maybeSingle();
  if(!turnover||!await ownProperty(turnover.property_id))return denial('Not your turnover',403);
  const prefix=uid+'/'+turnover.property_id+'/inspections/'+turnover.id+'/';
  if(!payload.path.startsWith(prefix)||payload.path.includes('..'))return denial('Incorrect inspection path',403);
  const {data:info,error:storageError}=await db.storage.from('property-inspections').info(payload.path);
  if(storageError||!info)return denial('Photo missing from private storage',404);
  const {data,error}=await db.from('property_turnover_photos').insert({
   turnover_id:turnover.id,uploaded_by:uid,phase:payload.phase,storage_path:payload.path
  }).select('id,phase').single();
  if(error)throw error;
  return reply({item:data},201);
 }
 case 'turnover_photos':{
  if(!uuid(payload.id))return denial('Turnover ID required');
  const {data:turnover}=await db.from('property_turnovers').select('id,property_id').eq('id',payload.id).maybeSingle();
  if(!turnover||!await ownProperty(turnover.property_id))return denial('Not your turnover',403);
  const {data,error}=await db.from('property_turnover_photos').select('id,storage_path,phase,created_at').eq('turnover_id',turnover.id).limit(40);
  if(error)throw error;
  const rows=await Promise.all((data||[]).map(async(v:any)=>{
    const {data:link}=await db.storage.from('property-inspections').createSignedUrl(v.storage_path,180);
    return {id:v.id,phase:v.phase,created_at:v.created_at,url:link?.signedUrl||null};
  }));
  return reply({items:rows});
 }
 case 'admin_queue':{
  const {data,error}=await db.from('properties').select(ownerCols).eq('status','pending_review').order('submitted_at').limit(100);
  if(error)throw error;
  const {data:photos,error:pError}=await db.from('property_images').select('id,property_id,status,storage_path').eq('status','pending').limit(100);
  if(pError)throw pError;
  const previews=await Promise.all((photos||[]).map(async(image:any)=>{
    const {data:link}=await db.storage.from('property-images').createSignedUrl(image.storage_path,180);
    return {id:image.id,property_id:image.property_id,url:link?.signedUrl||null};
  }));
  const {data:pendingVideos,error:vError}=await db.from('property_videos')
    .select('id,property_id,status,storage_path,mime_type').eq('status','pending').limit(100);
  if(vError)throw vError;
  const videoPreviews=await Promise.all((pendingVideos||[]).map(async(video:any)=>{
    const {data:link}=await db.storage.from('property-videos').createSignedUrl(video.storage_path,180);
    return {id:video.id,property_id:video.property_id,mime_type:video.mime_type,url:link?.signedUrl||null};
  }));
  return reply({items:await approvedPhotoLinks(data||[]),pending_images:previews,pending_videos:videoPreviews});
 }
 case 'admin_image_review':{
  if(!uuid(payload.id)||!['approved','rejected'].includes(payload.status))return denial('Invalid photo decision');
  const {data:photo}=await db.from('property_images').select('id,uploader_id,property_id,status').eq('id',payload.id).maybeSingle();
  if(!photo||photo.status!=='pending')return denial('Photo unavailable',409);
  if(photo.uploader_id===uid)return denial('Cannot review your own listing',403);
  if(payload.human_review_confirmed!==true)return denial('Independent human review required',403);
  const {data,error}=await db.from('property_images').update({status:payload.status,reviewed_by:uid}).eq('id',photo.id).eq('status','pending').select('id,status').maybeSingle();
  if(error||!data)return denial('Review conflict',409);
  await audit('property_photo_review',data.id,{status:data.status});
  return reply({item:data});
 }
 case 'admin_video_review':{
  if(!uuid(payload.id)||!['approved','rejected'].includes(payload.status))return denial('Invalid video review');
  const {data:video}=await db.from('property_videos').select('id,uploader_id,status').eq('id',payload.id).maybeSingle();
  if(!video||video.status!=='pending')return denial('Video unavailable',409);
  if(video.uploader_id===uid)return denial('Cannot review your own video',403);
  if(payload.human_review_confirmed!==true)return denial('Independent human review required',403);
  const {data,error}=await db.from('property_videos').update({status:payload.status,reviewed_by:uid})
    .eq('id',video.id).eq('status','pending').select('id,status').maybeSingle();
  if(error||!data)return denial('Video review conflict',409);
  await audit('property_video_review',data.id,{status:data.status});
  return reply({item:data});
 }
 case 'admin_listing_review':{
  if(!uuid(payload.id)||!['active','paused'].includes(payload.status))return denial('Invalid review decision');
  const {data:property}=await db.from('properties').select('id,owner_id,status,permitted_uses').eq('id',payload.id).maybeSingle();
  if(!property||property.status!=='pending_review')return denial('Listing not pending review',409);
  if(property.owner_id===uid)return denial('Cannot approve your own listing',403);
  if(payload.human_review_confirmed!==true)return denial('Human review of property rights and permitted uses required',403);
  if(payload.status==='active'){
   const {data:images}=await db.from('property_images').select('id').eq('property_id',property.id).eq('status','approved').limit(1);
   if(!images?.length||!property.permitted_uses?.length)return denial('An approved photo and stated permitted uses are required',409);
   const {data:authority,error:authorityError}=await db.from('host_verification_requests')
     .select('status,expires_at').eq('property_id',property.id).eq('owner_id',property.owner_id)
     .eq('status','approved').limit(3);
   if(authorityError||!authority?.some((v:any)=>!v.expires_at||Date.parse(v.expires_at)>Date.now()))
     return denial('Independent property authority approval required before publication',409);
  }
  const {data,error}=await db.from('properties').update({
    status:payload.status,approved_at:payload.status==='active'?new Date().toISOString():null,
    approved_by:payload.status==='active'?uid:null,updated_at:new Date().toISOString()
  }).eq('id',property.id).eq('status','pending_review').select('id,status').maybeSingle();
  if(error||!data)return denial('Listing review conflict',409);
  await notify(property.owner_id,'hosting_review','Your hosting listing was '+(data.status==='active'?'approved':'returned for changes'),data.id);
  await audit('hosting_listing_reviewed',data.id,{status:data.status});
  return reply({item:data});
 }
 default:return denial('Unknown marketplace action',404);
 }
 }catch(error){console.error('hosting-marketplace',action,error);return denial('Marketplace operation failed',500);}
});