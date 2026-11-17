import {optionalProviderSetting} from './providerConfig.mjs';
/**
 * Hosting pricing and inventory API. Server calculates all prices and atomically
 * reserves venue and finite rental equipment. Clients cannot supply totals.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const deny=(msg:string,code=400)=>respond({error:msg},code);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const str=(v:unknown,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
const iso=(v:unknown)=>{const x=new Date(typeof v==='string'?v:'');return Number.isFinite(x.getTime())?x.toISOString():null;};
const percent=(v:unknown,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
const acceptedCategories=new Set(['camera','lighting','audio','furniture','set','makeup','equipment','service','other']);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return deny('Method not allowed',405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return deny('Backend not configured',503);
 const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:e}=await auth.auth.getUser();if(e||!user)return deny('Unauthorized',401);
 const db=createClient(url,secret),uid=user.id;
 const [verification,security,sub,ohAccount]=await Promise.all([
  db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
  db.from('onlyhost_accounts').select('status').eq('user_id',uid).maybeSingle()
 ]);
 if(verification.error||security.error||sub.error||ohAccount.error)return deny('Account status unavailable',503);
 const adult=Boolean(verification.data?.[0]?.admitted_at);
 if(security.data?.banned||security.data?.suspended)return deny('Account restricted',403);
 const paid=security.data?.admin||['active','trial'].includes(sub.data?.status)&&(!sub.data?.period_end||Date.parse(sub.data.period_end)>Date.now());
 const {data:hostTerms,error:hostTermsError}=await db.from('onlyhost_accounts')
   .select('status,terms_version,legal_capacity_confirmed,property_authority_confirmed,adult_production_understood')
   .eq('user_id',uid).maybeSingle();
 if(hostTermsError)return deny('Host account status unavailable',503);
 const onlyHostEligible=hostTerms?.status==='active'&&hostTerms.terms_version==='host-2026-11-17'&&
   hostTerms.legal_capacity_confirmed===true&&hostTerms.property_authority_confirmed===true&&hostTerms.adult_production_understood===true;
 const body=await req.json().catch(()=>null);if(!body||typeof body!=='object')return deny('Invalid JSON',400);
 const action=str(body.action,60);
 const hostOnlyActions=new Set(['host_set_area','host_rate_settings','rate_rules_list','rate_rule_create','rate_rule_delete',
  'discount_create','discount_list','discount_disable','host_addons_list','addon_upsert','bundle_create','addon_condition']);
 if(!adult&&!(onlyHostEligible&&hostOnlyActions.has(action))&&
    !['areas_public','addons_public','commute_estimates'].includes(action))
   return deny('Complete creator signup or accept the current Host Connect host agreement',403);
 if(hostOnlyActions.has(action)&&!onlyHostEligible)
   return deny('Accept the current Host Connect property agreement to manage property pricing',403);
 const own=async(propertyId:unknown)=>{
  if(!id(propertyId))return null;
  const {data,error}=await db.from('properties').select('id,owner_id,status,timezone').eq('id',propertyId).eq('owner_id',uid).maybeSingle();
  if(error)throw error;return data;
 };
 const hashCode=async(code:unknown)=>{
  if(typeof code!=='string'||!code.trim())return null;
  if(code.trim().length<4||code.trim().length>40)return null;
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code.trim().toUpperCase())));
  return Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
 };
 const audit=async(action:string,target:string)=>{
  await db.from('platform_action_audit').insert({actor_id:uid,action,target_type:'hosting_pricing',target_id:target});
 };
 if(!paid&&!onlyHostEligible&&!['quote','addons_public','areas_public'].includes(action))return deny('Premium membership required',403);
 try{
 switch(action){
 case 'areas_public':{
  const {data,error}=await db.from('hosting_public_areas').select('id,city,region,country,latitude,longitude,radius_km').eq('approved',true).order('city').limit(500);
  if(error)throw error;return respond({items:data||[]});
 }
 case 'host_set_area':{
  const property=await own(body.property_id);if(!property)return deny('Only the host may choose the public map area',403);
  if(!id(body.area_id))return deny('Approved public area required');
  const {data:area}=await db.from('hosting_public_areas')
   .select('id,city,region,country').eq('id',body.area_id).eq('approved',true).maybeSingle();
  if(!area)return deny('Unknown public area',404);
  const {data:venue}=await db.from('properties')
   .select('city,state,country').eq('id',property.id).maybeSingle();
  if(!venue)return deny('Listing unavailable',404);
  if(venue.country?.toLowerCase()!==area.country.toLowerCase()||
   ![venue.city?.toLowerCase(),venue.state?.toLowerCase()].includes(area.city.toLowerCase())&&
   venue.state?.toLowerCase()!==area.region.toLowerCase()&&venue.city?.toLowerCase()!==area.city.toLowerCase())
   return deny('Public map area must be in the venue region',400);
  const {data,error}=await db.from('properties').update({public_area_id:area.id})
   .eq('id',property.id).eq('owner_id',uid).select('id,public_area_id').single();
  if(error)throw error;return respond({item:data});
 }
 case 'commute_estimates':{
  if(!id(body.origin_area_id)||!Array.isArray(body.area_ids)||body.area_ids.length>25||
    body.area_ids.some(v=>!id(v)))return deny('Public origin and destination areas required');
  const areaIds=[...new Set([body.origin_area_id,...body.area_ids])];
  const {data:areas,error}=await db.from('hosting_public_areas')
   .select('id,latitude,longitude,city,region').in('id',areaIds).eq('approved',true);
  if(error)throw error;
  const origin=areas?.find(a=>a.id===body.origin_area_id);
  if(!origin)return deny('Origin area unavailable',404);
  const haversine=(a:any,b:any)=>{
   const rad=Math.PI/180,x=(Number(b.latitude)-Number(a.latitude))*rad,
    y=(Number(b.longitude)-Number(a.longitude))*rad;
   const q=Math.sin(x/2)**2+Math.cos(Number(a.latitude)*rad)*Math.cos(Number(b.latitude)*rad)*Math.sin(y/2)**2;
   return Math.round(6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))*10)/10;
  };
  const results=(areas||[]).filter(a=>a.id!==origin.id).map(a=>({
   area_id:a.id,city:a.city,straight_line_km:haversine(origin,a),
   driving_minutes:null as number|null,route_verified:false
  }));
  const base=optionalProviderSetting('HOSTING_ROUTING_OSRM_URL');
  const approved=optionalProviderSetting('HOSTING_ROUTING_APPROVED')==='true';
  if(base&&approved){
   let parsed:URL;try{parsed=new URL(base);}catch{return deny('Routing URL misconfigured',503);}
   if(parsed.protocol!=='https:'||!['router.project-osrm.org','routing.openstreetmap.de'].includes(parsed.hostname))
    return deny('Routing host is not approved',503);
   for(const destination of results.slice(0,10)){
    const area=areas!.find(a=>a.id===destination.area_id)!;
    const path='/route/v1/driving/'+Number(origin.longitude)+','+Number(origin.latitude)+';'+
      Number(area.longitude)+','+Number(area.latitude)+'?overview=false';
    try{
     const response=await fetch(parsed.origin+path,{redirect:'error',signal:AbortSignal.timeout(3500)});
     const data=response.ok?await response.json():null;
     if(data?.routes?.[0]?.duration&&Number.isFinite(data.routes[0].duration)){
      destination.driving_minutes=Math.ceil(data.routes[0].duration/60);
      destination.route_verified=true;
     }
    }catch{/* route remains unavailable, never invent travel times */}
   }
  }
  return respond({origin_area_id:origin.id,results,
   routing_ready:approved&&!!base,
   disclaimer:'Route estimates use public area centers, never exact property addresses. Straight-line distance is not commute time.'});
 }
 case 'addons_public':{
  if(!id(body.property_id))return deny('Property required');
  const {data:property}=await db.from('properties').select('id,status').eq('id',body.property_id).maybeSingle();
  if(property?.status!=='active')return deny('Listing unavailable',404);
  const [assets,bundles,members]=await Promise.all([
   db.from('hosting_addons').select('id,label,description,category,quantity,hourly_cents,daily_cents,condition')
    .eq('property_id',body.property_id).eq('active',true).not('condition','in','(maintenance,retired)').limit(70),
   db.from('hosting_addon_bundles').select('id,title,discount_bps').eq('property_id',body.property_id).eq('active',true).limit(30),
   db.from('hosting_bundle_items').select('bundle_id,addon_id,quantity').limit(1000)
  ]);
  if(assets.error||bundles.error||members.error)throw assets.error||bundles.error||members.error;
  const allowed=new Set((bundles.data||[]).map(v=>v.id));
  return respond({assets:assets.data||[],bundles:(bundles.data||[]).map(b=>({...b,
   items:(members.data||[]).filter(v=>allowed.has(v.bundle_id)&&v.bundle_id===b.id)}))});
 }
 case 'quote':
 case 'reserve':{
  if(!id(body.property_id)||!iso(body.starts_at)||!iso(body.ends_at)||typeof body.requested_use!=='string')
   return deny('Valid property, date range and production use required');
  const sourceBrand=body.source_brand==='onlyhost'?'onlyhost':'content_connect';
  if(action==='reserve'&&!paid&&!(sourceBrand==='onlyhost'&&onlyHostEligible))return deny('Verified OnlyHost account or CCX premium membership required',403);
  const additions=Array.isArray(body.addons)?body.addons:[];
  if(additions.length>25||additions.some(x=>!id(x?.id)||!percent(x?.quantity,1,1000)))return deny('Invalid equipment selection');
  if(body.bundle_id&&!id(body.bundle_id))return deny('Invalid bundle ID');
  const codeHash=body.discount_code?await hashCode(body.discount_code):null;
  if(body.discount_code&&!codeHash)return deny('Discount code should contain 4–40 characters');
  const params={p_property:body.property_id,p_start:iso(body.starts_at),p_end:iso(body.ends_at),
   p_crew:Number(body.crew_size),p_use:str(body.requested_use,100),
   p_addons:additions,p_bundle:body.bundle_id||null,p_discount_hash:codeHash};
  if(action==='quote'){
   const {data,error}=await db.rpc('ccx_hosting_price_quote',params);
   if(error)return deny(error.message.includes('not valid')?'Booking terms unavailable':'Quote cannot be calculated: '+error.message,409);
   return respond({quote:data,estimated_only:true,expires_after:'Price is recalculated when booking is submitted'});
  }
  const {data:property}=await db.from('properties').select('owner_id,status,approved_at').eq('id',body.property_id).maybeSingle();
  if(!property||property.status!=='active'||!property.approved_at||property.owner_id===uid)return deny('Property unavailable',403);
  const {data:hostVerified,error:hostError}=await db.from('host_verification_requests').select('id,expires_at')
   .eq('property_id',body.property_id).eq('owner_id',property.owner_id).eq('status','approved').limit(1);
  if(hostError||!hostVerified?.some(v=>!v.expires_at||Date.parse(v.expires_at)>Date.now()))return deny('Host verification required',409);
  const {count,error:limitError}=await db.from('property_booking_requests').select('id',{head:true,count:'exact'})
   .eq('requester_id',uid).eq('status','requested').gte('created_at',new Date(Date.now()-86400000).toISOString());
  if(limitError)throw limitError;if((count||0)>=10)return deny('Daily booking request limit reached',429);
  const {data,error}=await db.rpc('ccx_hosting_reserve',{p_guest:uid,...params,p_note:str(body.notes,1000),p_origin_brand:sourceBrand});
  if(error)return deny('Reservation could not be made: '+error.message,409);
  await db.from('member_notifications').insert({recipient_id:property.owner_id,
   kind:'hosting_booking',title:'New professional venue booking request',details:{booking_id:data}});
  await audit('hosting_booking_v2_created',data);
  return respond({booking_id:data,status:'requested',note:'Reservation requested. No money charged and no private address disclosed.'},201);
 }
 case 'host_rate_settings':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const weekend=Number(body.weekend_bps),holiday=Number(body.holiday_bps),overtime=Number(body.overtime_bps),
   notice=Number(body.min_notice_hours),cleaning=Number(body.cleaning_fee_cents),
   prep=Number(body.preferred_cleaning_minutes),tz=str(body.timezone,80);
  if(!percent(weekend,1000,40000)||!percent(holiday,1000,40000)||!percent(overtime,10000,50000)||
   !percent(notice,0,720)||!Number.isSafeInteger(cleaning)||cleaning<0||cleaning>10000000||
   !percent(prep,0,1440)||!tz)return deny('Invalid pricing settings');
  const {data:zone,error:zError}=await db.from('hosting_public_areas').select('id').limit(1);
  if(zError)throw zError;
  try{new Intl.DateTimeFormat('en-US',{timeZone:tz});}catch{return deny('Invalid IANA timezone');}
  const {data,error}=await db.from('properties').update({
   weekend_bps:weekend,holiday_bps:holiday,overtime_bps:overtime,
   min_notice_hours:notice,cleaning_fee_cents:cleaning,preferred_cleaning_minutes:prep,
   timezone:tz,updated_at:new Date().toISOString()
  }).eq('id',property.id).eq('owner_id',uid)
   .select('id,weekend_bps,holiday_bps,overtime_bps,min_notice_hours,cleaning_fee_cents,timezone').maybeSingle();
  if(error||!data)return deny('Pricing update failed',409);
  await audit('hosting_pricing_updated',property.id);
  return respond({item:data});
 }
 case 'rate_rules_list':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const {data,error}=await db.from('hosting_seasonal_rates').select('id,label,kind,starts_on,ends_on,multiplier_bps')
   .eq('property_id',property.id).order('starts_on',{ascending:false}).limit(100);
  if(error)throw error;return respond({items:data||[]});
 }
 case 'rate_rule_create':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const kind=str(body.kind,20),label=str(body.label,120),from=str(body.starts_on,10),to=str(body.ends_on,10),
   factor=Number(body.multiplier_bps);
  if(!['seasonal','holiday','promotion'].includes(kind)||label.length<3||!percent(factor,1000,40000)||
   !/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return deny('Invalid seasonal rule');
  const {data,error}=await db.from('hosting_seasonal_rates').insert({property_id:property.id,label,kind,starts_on:from,ends_on:to,multiplier_bps:factor})
   .select('id,kind,label').single();
  if(error)return deny('Invalid date range or duplicate rule',409);
  await audit('hosting_rate_rule_added',property.id);return respond({item:data},201);
 }
 case 'rate_rule_delete':{
  if(!id(body.id))return deny('Rate rule ID required');
  const {data:rule}=await db.from('hosting_seasonal_rates').select('property_id').eq('id',body.id).maybeSingle();
  if(!rule||!await own(rule.property_id))return deny('Rule not found',404);
  const {error}=await db.from('hosting_seasonal_rates').delete().eq('id',body.id);if(error)throw error;
  return respond({ok:true});
 }
 case 'discount_create':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const hash=await hashCode(body.code),bps=Number(body.discount_bps),limit=Number(body.max_redemptions);
  if(!hash||!percent(bps,1,8000)||!percent(limit,1,100000))return deny('Discount code, rate and limit required');
  const {data,error}=await db.from('hosting_discount_codes').insert({
   property_id:property.id,code_sha256:hash,discount_bps:bps,max_redemptions:limit,
   expires_at:iso(body.expires_at),active:true
  }).select('id,discount_bps,max_redemptions').single();
  if(error)return deny('Discount code already exists',409);
  return respond({item:data,note:'The cleartext discount code is not stored. Share it only with intended guests.'},201);
 }
 case 'discount_list':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const {data,error}=await db.from('hosting_discount_codes').select('id,code_sha256,discount_bps,redemptions,max_redemptions,active,expires_at')
   .eq('property_id',property.id).limit(100);
  if(error)throw error;return respond({items:data||[]});
 }
 case 'discount_disable':{
  if(!id(body.id))return deny('Discount ID required');
  const {data:discount}=await db.from('hosting_discount_codes').select('property_id').eq('id',body.id).maybeSingle();
  if(!discount||!await own(discount.property_id))return deny('Discount unavailable',403);
  const {error}=await db.from('hosting_discount_codes').update({active:false}).eq('id',body.id);
  if(error)throw error;return respond({ok:true});
 }
 case 'host_addons_list':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const {data,error}=await db.from('hosting_addons')
   .select('id,label,category,description,quantity,hourly_cents,daily_cents,condition,active')
   .eq('property_id',property.id).order('created_at',{ascending:false}).limit(150);
  if(error)throw error;return respond({items:data||[]});
 }
 case 'addon_upsert':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const label=str(body.label,160),category=str(body.category,30),quantity=Number(body.quantity),
   hourly=Number(body.hourly_cents),daily=body.daily_cents==null?null:Number(body.daily_cents),
   condition=str(body.condition||'good',20),description=str(body.description,1500);
  if(label.length<3||!acceptedCategories.has(category)||!percent(quantity,1,1000)||!percent(hourly,0,10000000)||
   daily!==null&&!percent(daily,0,10000000)||!['new','good','fair','maintenance','retired'].includes(condition))return deny('Invalid inventory fields');
  const values={property_id:property.id,label,category,quantity,hourly_cents:hourly,daily_cents:daily,condition,description,
   active:body.active!==false};
  if(body.id&&!id(body.id))return deny('Invalid asset ID');
  if(body.id){
   const {data:old}=await db.from('hosting_addons').select('id,quantity').eq('id',body.id).eq('property_id',property.id).maybeSingle();
   if(!old)return deny('Equipment item not found',404);
   const {data:reserved}=await db.from('hosting_booking_addons').select('quantity,booking_id').eq('addon_id',old.id);
   if((reserved||[]).some(v=>v.quantity>quantity))return deny('Quantity is below an already reserved line',409);
  }
  const query=body.id?db.from('hosting_addons').update(values).eq('id',body.id).eq('property_id',property.id):
   db.from('hosting_addons').insert(values);
  const {data,error}=await query.select('id,label,quantity').single();
  if(error)throw error;
  await audit('hosting_addon_saved',property.id);return respond({item:data});
 }
 case 'bundle_create':{
  const property=await own(body.property_id);if(!property)return deny('Owner permission required',403);
  const title=str(body.title,120),discount=Number(body.discount_bps);
  const selections=Array.isArray(body.items)?body.items:[];
  if(title.length<3||!percent(discount,0,8000)||!selections.length||selections.length>20||
   selections.some(v=>!id(v.id)||!percent(v.quantity,1,1000)))return deny('Bundle items and percentage required');
  const unique=new Set(selections.map(v=>v.id));if(unique.size!==selections.length)return deny('Duplicate items');
  const {data:assets,error:lookupError}=await db.from('hosting_addons').select('id,quantity')
   .eq('property_id',property.id).in('id',[...unique]);
  if(lookupError||assets?.length!==unique.size||selections.some(v=>v.quantity>assets.find(a=>a.id===v.id)?.quantity))
   return deny('Bundle item does not belong to venue or exceeds inventory');
  const {data:bundle,error}=await db.from('hosting_addon_bundles')
   .insert({property_id:property.id,title,discount_bps:discount}).select('id').single();
  if(error)throw error;
  const {error:memberError}=await db.from('hosting_bundle_items')
   .insert(selections.map(v=>({bundle_id:bundle.id,addon_id:v.id,quantity:v.quantity})));
  if(memberError){await db.from('hosting_addon_bundles').delete().eq('id',bundle.id);throw memberError;}
  return respond({item:bundle},201);
 }
 case 'addon_condition':{
  if(!id(body.booking_id)||!id(body.addon_id))return deny('Booking and asset required');
  const {data:booking}=await db.from('property_booking_requests').select('property_id,owner_id,status')
   .eq('id',body.booking_id).maybeSingle();
  if(!booking||booking.owner_id!==uid)return deny('Only the host can inspect gear',403);
  const {data:reserved}=await db.from('hosting_booking_addons').select('addon_id').eq('booking_id',body.booking_id)
   .eq('addon_id',body.addon_id).maybeSingle();
  if(!reserved)return deny('Equipment not included in booking',403);
  const before=str(body.condition_before,20),after=str(body.condition_after,20);
  if(!['new','good','fair','damaged'].includes(before)||!['new','good','fair','damaged'].includes(after))
   return deny('Equipment condition must be documented');
  const {data,error}=await db.from('hosting_equipment_inspections').upsert({
   booking_id:body.booking_id,addon_id:body.addon_id,recorded_by:uid,
   condition_before:before,condition_after:after,notes:str(body.notes,1500)
  },{onConflict:'booking_id,addon_id,recorded_by'}).select('id').single();
  if(error)throw error;return respond({item:data});
 }
 default:return deny('Unknown pricing or equipment action',404);
 }
 }catch(error){console.error('hosting-advanced',action,error);return deny('Request failed',500);}
});
