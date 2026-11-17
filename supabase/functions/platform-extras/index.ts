/**
 * Content Connect X — age-gated, privacy-preserving product modules.
 * Implements features informed by Cal.diy, Agora/Orbit, Flagsmith and Fider
 * without copying their application schemas or bypassing existing membership rules.
 * All user mutations use an authenticated service-side gate; public tables have RLS.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const str=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const isCurrent=(row:any)=>row?.status==='approved'&&(!row.expires_at||Date.parse(row.expires_at)>Date.now());
const isPaid=(row:any)=>['active','trial'].includes(row?.status)&&(!row?.period_end||Date.parse(row.period_end)>Date.now());
const iso=(v:unknown)=>{const d=new Date(typeof v==='string'?v:'');return Number.isFinite(d.valueOf())?d.toISOString():null;};
const reject=(reason:string,status=400)=>reply({error:reason},status);

// The JWT has already been validated by Supabase Auth.getUser before this is used.
const assurance=(header:string)=>{
  try {
    const jwt=header.replace(/^Bearer\s+/i,'');
    const payload=jwt.split('.')[1];
    const base64=payload.replace(/-/g,'+').replace(/_/g,'/');
    const claims=JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,'=')));
    return claims?.aal==='aal2'?'aal2':'aal1';
  } catch {return 'aal1';}
};

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reject('Method not allowed',405);
  const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!pub||!secret)return reject('Backend unavailable',503);
  const userClient=createClient(url,pub,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authenticationError}=await userClient.auth.getUser();
  if(authenticationError||!user)return reject('Unauthorized',401);
  const db=createClient(url,secret),uid=user.id;
  const [sec,age,sub,settingsRow]=await Promise.all([
    db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
    db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
    db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
    db.from('platform_settings').select('key,value').eq('key','age_verification_required').maybeSingle(),
  ]);
  if(sec.error||age.error||sub.error)return reject('Account status unavailable',503);
  if(sec.data?.banned||sec.data?.suspended)return reject('Account unavailable',403);
  if(settingsRow.error)return reject('Platform configuration unavailable',503);
  const ageGateEnabled=settingsRow.data?.value!==false;
  const admin=sec.data?.admin===true,paid=admin||isPaid(sub.data),tier=paid?'premium':'free';
  const body=await req.json().catch(()=>({}));
  const action=str(body?.action,70);
  const privilegedControl=action.startsWith('admin_');
  // Allow an authenticated admin to repair platform settings even if the global
  // member gate is enabled. MFA and the admin DB role are still mandatory.
  if(privilegedControl&&(!admin||assurance(req.headers.get('Authorization')||'')!=='aal2'))
    return reject('Verified administrator MFA required',403);
  if(ageGateEnabled&&!isCurrent(age.data?.[0])&&!privilegedControl)
    return reject('Approved age verification required',403);
  const feature=async(key:string,requiredTier=tier)=>{
    const {data,error}=await db.from('product_feature_flags').select('enabled,allowed_tiers,rollout_percent').eq('key',key).maybeSingle();
    if(error||!data?.enabled||!data.allowed_tiers?.includes(requiredTier))return false;
    // A deterministic rollout that cannot be defeated by repeating the request.
    if(data.rollout_percent===100)return true;
    if(data.rollout_percent===0)return false;
    let value=0;for(const c of (uid+key))value=(value*31+c.charCodeAt(0))>>>0;
    return value%100<data.rollout_percent;
  };
  const audits=async(actionType:string,id:string|null=null,meta:Record<string,unknown>={})=>{
    await db.from('platform_action_audit').insert({
      actor_id:uid,action:actionType,target_type:'product',target_id:uuid(id)?id:null,metadata:meta
    });
  };
  const blockedUsers=async()=>{
    const {data,error}=await db.from('member_blocks').select('blocker_id,blocked_id')
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
    if(error)throw error;
    return new Set((data||[]).map((b:any)=>b.blocker_id===uid?b.blocked_id:b.blocker_id));
  };
  const addQueue=async(type:string,id:string)=>{
    const {error}=await db.from('content_moderation_queue').insert({
      content_type:type,content_id:id,submitter_id:uid,status:'pending'
    });
    if(error)throw error;
  };
  const rate=async(table:string,column:string,countLimit:number,windowMs:number)=>{
    const cutoff=new Date(Date.now()-windowMs).toISOString();
    const {count,error}=await db.from(table).select('id',{count:'exact',head:true})
      .eq(column,uid).gte('created_at',cutoff);
    if(error)throw error;
    return (count||0)<countLimit;
  };
  try{
    switch(action){
      case 'get_feature_flags':{
        const keys=['creator_discovery','search','favorites','connections','collaborations','testing',
          'availability','community_feed','community_publish','product_feedback','media_gallery',
          'creator_booking','production_manager','representations','roster','creator_groups',
          'event_rsvps','verified_reviews','messages','contracts','hosting_marketplace',
          'hosting_requests','hosting_turnover','property_bookings','background_screening'];
        const entries=await Promise.all(keys.map(async(key)=>[key,await feature(key)]));
        return reply({flags:Object.fromEntries(entries),tier,age_verification_required:ageGateEnabled});
      }
      case 'admin_set_feature_flag':{
        if(!admin)return reject('Administrator access required',403);
        const key=str(body.key,80);
        if(!/^[a-z][a-z_]{2,79}$/.test(key))return reject('Invalid feature',400);
        const {data:prior,error:lookup}=await db.from('product_feature_flags').select('key').eq('key',key).maybeSingle();
        if(lookup||!prior)return reject('Unknown feature',404);
        const tiers=Array.isArray(body.allowed_tiers)?body.allowed_tiers:[];
        if(tiers.length<1||tiers.some((v:any)=>!['free','premium'].includes(v)))return reject('Invalid tiers',400);
        const percent=Number(body.rollout_percent);
        if(!Number.isInteger(percent)||percent<0||percent>100||typeof body.enabled!=='boolean')
          return reject('Invalid rollout or status',400);
        const {data,error}=await db.from('product_feature_flags').update({
          enabled:body.enabled,allowed_tiers:[...new Set(tiers)],
          rollout_percent:percent,updated_at:new Date().toISOString()
        }).eq('key',key).select('key,enabled,allowed_tiers,rollout_percent').single();
        if(error)throw error;
        await audits('change_feature_flag',null,{key});
        return reply({item:data});
      }
      case 'admin_list_feature_flags':{
        if(!admin)return reject('Administrator access required',403);
        const {data,error}=await db.from('product_feature_flags')
          .select('key,enabled,allowed_tiers,rollout_percent,description').order('key');
        if(error)throw error;
        return reply({items:data});
      }
      case 'admin_get_settings':{
        if(!admin)return reject('Administrator access required',403);
        const {data,error}=await db.from('platform_settings').select('key,value,updated_at');
        if(error)throw error;
        return reply({items:data||[]});
      }
      case 'admin_set_setting':{
        if(!admin)return reject('Administrator access required',403);
        const key=str(body.key,80);
        if(!/^[a-z][a-z_]{2,79}$/.test(key))return reject('Invalid setting key',400);
        const allowedKeys=['age_verification_required'];
        if(!allowedKeys.includes(key))return reject('Unknown setting',404);
        const value=body.value;
        if(typeof value!=='boolean')return reject('Invalid value',400);
        const {data,error}=await db.from('platform_settings').upsert({
          key,value,updated_at:new Date().toISOString(),updated_by:uid
        },{onConflict:'key'}).select('key,value,updated_at').single();
        if(error)throw error;
        await audits('change_platform_setting',null,{key,value});
        return reply({item:data});
      }

      case 'availability_list':{
        if(!await feature('availability','premium')&&!await feature('availability','free'))
          return reject('Availability not enabled',403);
        const city=str(body.city,100),from=iso(body.from)||new Date().toISOString();
        const to=iso(body.to)||new Date(Date.now()+31*86400000).toISOString();
        if(Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>90*86400000)
          return reject('Invalid date window',400);
        let q=db.from('member_availability').select('id,user_id,kind,city,region,country,timezone,starts_at,ends_at,note,visibility')
          .lt('starts_at',to).gt('ends_at',from).order('starts_at').limit(120);
        if(city)q=q.ilike('city',city.replace(/[%*,]/g,''));
        const {data,error}=await q;if(error)throw error;
        const blocked=await blockedUsers();
        const connections=await db.from('member_connection_requests').select('requester_id,recipient_id')
          .eq('status','accepted').or(`requester_id.eq.${uid},recipient_id.eq.${uid}`);
        if(connections.error)throw connections.error;
        const contacts=new Set((connections.data||[]).map((v:any)=>v.requester_id===uid?v.recipient_id:v.requester_id));
        const rows=(data||[]).filter((v:any)=>!blocked.has(v.user_id)&&(
          v.user_id===uid||v.visibility==='verified'||(v.visibility==='connections'&&contacts.has(v.user_id))
        ));
        // Public discovery exposes city and dates only. No exact address, private notes or GPS.
        return reply({items:rows.slice(0,paid?100:10).map((v:any)=>({
          id:v.id,user_id:v.user_id,kind:v.kind,city:v.city,region:v.region,country:v.country,
          starts_at:v.starts_at,ends_at:v.ends_at,timezone:v.timezone,
          note:paid||v.user_id===uid?v.note:null
        })),preview:!paid});
      }
      case 'availability_my':{
        const {data,error}=await db.from('member_availability')
          .select('id,kind,city,region,country,timezone,starts_at,ends_at,note,visibility')
          .eq('user_id',uid).order('starts_at',{ascending:false}).limit(100);
        if(error)throw error;
        return reply({items:data});
      }
      case 'availability_overlaps':{
        if(!paid||!await feature('availability'))return reject('Premium scheduling required',403);
        const {data:mine,error:mineError}=await db.from('member_availability')
          .select('id,city,country,starts_at,ends_at,kind').eq('user_id',uid)
          .gt('ends_at',new Date().toISOString()).order('starts_at').limit(60);
        if(mineError)throw mineError;
        if(!mine?.length)return reply({items:[]});
        const earliest=mine.reduce((acc:any,item:any)=>item.starts_at<acc?item.starts_at:acc,mine[0].starts_at);
        const latest=mine.reduce((acc:any,item:any)=>item.ends_at>acc?item.ends_at:acc,mine[0].ends_at);
        const {data:others,error:otherError}=await db.from('member_availability')
          .select('id,user_id,city,country,starts_at,ends_at,visibility,kind')
          .neq('user_id',uid).lt('starts_at',latest).gt('ends_at',earliest).limit(250);
        if(otherError)throw otherError;
        const blocked=await blockedUsers();
        const {data:connections,error:connError}=await db.from('member_connection_requests')
          .select('requester_id,recipient_id').eq('status','accepted')
          .or(`requester_id.eq.${uid},recipient_id.eq.${uid}`);
        if(connError)throw connError;
        const contacts=new Set((connections||[]).map((c:any)=>c.requester_id===uid?c.recipient_id:c.requester_id));
        const found=[];
        for(const myWindow of mine){
          for(const theirWindow of others||[]){
            if(blocked.has(theirWindow.user_id)||theirWindow.visibility==='private')continue;
            if(theirWindow.visibility==='connections'&&!contacts.has(theirWindow.user_id))continue;
            if(myWindow.city.toLowerCase()!==theirWindow.city.toLowerCase()||
               myWindow.country.toLowerCase()!==theirWindow.country.toLowerCase())continue;
            const start=Math.max(Date.parse(myWindow.starts_at),Date.parse(theirWindow.starts_at));
            const end=Math.min(Date.parse(myWindow.ends_at),Date.parse(theirWindow.ends_at));
            if(end<=start)continue;
            found.push({user_id:theirWindow.user_id,city:myWindow.city,country:myWindow.country,
              starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),
              kind:theirWindow.kind,overlap_hours:Math.round((end-start)/3600000)});
          }
        }
        return reply({items:found.slice(0,100),checked_at:new Date().toISOString()});
      }
      case 'availability_create':{
        if(!paid||!await feature('availability'))return reject('Premium availability required',403);
        if(!await rate('member_availability','user_id',80,30*86400000))
          return reject('Availability entry limit reached',429);
        const from=iso(body.starts_at),to=iso(body.ends_at),
          city=str(body.city,100),country=str(body.country,100),
          region=str(body.region,100),note=str(body.note,500);
        if(!from||!to||Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>31*86400000
          ||city.length<2||country.length<2||Date.parse(from)<Date.now()-86400000)
          return reject('Valid city, country and date range required',400);
        const visibility=['verified','connections','private'].includes(body.visibility)?body.visibility:'verified';
        const timezone=str(body.timezone,70)||'UTC';
        const kind=['travel','shoot','studio','unavailable'].includes(body.kind)?body.kind:'travel';
        const {data,error}=await db.from('member_availability').insert({
          user_id:uid,kind,city,country,region,timezone,
          starts_at:from,ends_at:to,note,visibility
        }).select('id,starts_at,ends_at,city,kind').single();
        if(error)throw error;
        await audits('availability_create',data.id);
        return reply({item:data},201);
      }
      case 'availability_delete':{
        if(!uuid(body.id))return reject('Invalid entry',400);
        const {data,error}=await db.from('member_availability').delete()
          .eq('id',body.id).eq('user_id',uid).select('id').maybeSingle();
        if(error||!data)return reject('Entry unavailable',404);
        await audits('availability_delete',data.id);
        return reply({ok:true});
      }

      case 'follow_toggle':{
        if(!uuid(body.user_id)||body.user_id===uid)return reject('Invalid follow target',400);
        const target=body.user_id;
        const blocked=await blockedUsers();
        if(blocked.has(target))return reject('Member unavailable',403);
        const {data:latestAge,error:ageError}=await db.from('age_verification_requests')
          .select('status,expires_at').eq('user_id',target).order('created_at',{ascending:false}).limit(1);
        if(ageError||!isCurrent(latestAge?.[0]))return reject('Member not verified',403);
        const {data:existing,error:priorError}=await db.from('member_follows')
          .select('followed_id').eq('follower_id',uid).eq('followed_id',target).maybeSingle();
        if(priorError)throw priorError;
        const result=existing
          ?await db.from('member_follows').delete().eq('follower_id',uid).eq('followed_id',target)
          :await db.from('member_follows').insert({follower_id:uid,followed_id:target});
        if(result.error)throw result.error;
        return reply({following:!existing});
      }
      case 'following_list':{
        const {data,error}=await db.from('member_follows')
          .select('followed_id').eq('follower_id',uid).limit(200);
        if(error)throw error;
        return reply({user_ids:(data||[]).map((v:any)=>v.followed_id)});
      }
      case 'creator_bookings_list':{
        const {data,error}=await db.from('creator_booking_requests')
          .select('id,host_id,requester_id,starts_at,ends_at,status,notes,created_at')
          .or(`host_id.eq.${uid},requester_id.eq.${uid}`)
          .order('created_at',{ascending:false}).limit(100);
        if(error)throw error;
        return reply({items:data||[]});
      }
      case 'creator_bookings_request':{
        if(!paid||!await feature('creator_booking','premium'))return reject('Premium booking required',403);
        const host=body.host_id,start=iso(body.starts_at),end=iso(body.ends_at);
        if(!uuid(host)||host===uid||!start||!end||Date.parse(start)<=Date.now()||Date.parse(end)<=Date.parse(start)||
          Date.parse(end)-Date.parse(start)>8*3600000||Date.parse(end)-Date.parse(start)<30*60000||
          Date.parse(start)>Date.now()+120*86400000)return reject('Invalid creator booking window',400);
        const [ageCheck,subscriptionCheck,securityCheck,connected,blocked]=await Promise.all([
          db.from('age_verification_requests').select('status,expires_at').eq('user_id',host).order('created_at',{ascending:false}).limit(1),
          db.from('member_subscriptions').select('status,period_end').eq('user_id',host).maybeSingle(),
          db.from('account_security').select('banned,suspended').eq('user_id',host).maybeSingle(),
          db.from('member_connection_requests').select('id').eq('status','accepted').or(`and(requester_id.eq.${uid},recipient_id.eq.${host}),and(requester_id.eq.${host},recipient_id.eq.${uid})`).limit(1),
          db.from('member_blocks').select('blocker_id').or(`and(blocker_id.eq.${uid},blocked_id.eq.${host}),and(blocker_id.eq.${host},blocked_id.eq.${uid})`).limit(1)
        ]);
        if(ageCheck.error||!isCurrent(ageCheck.data?.[0])||subscriptionCheck.error||!isPaid(subscriptionCheck.data)||
          securityCheck.error||securityCheck.data?.banned||securityCheck.data?.suspended||connected.error||!connected.data?.length||
          blocked.error||blocked.data?.length)return reject('Creator is not available for booking',403);
        const {data:availability,error:availabilityError}=await db.from('member_availability')
          .select('id').eq('user_id',host).in('kind',['shoot','studio']).neq('visibility','private')
          .lte('starts_at',start).gte('ends_at',end).limit(1);
        if(availabilityError||!availability?.length)return reject('The creator has not offered this time window',409);
        const {count,error:limitError}=await db.from('creator_booking_requests').select('id',{head:true,count:'exact'})
          .eq('requester_id',uid).eq('status','requested').gte('created_at',new Date(Date.now()-86400000).toISOString());
        if(limitError)throw limitError;
        if((count||0)>=10)return reject('Daily request limit reached',429);
        const {data,error}=await db.from('creator_booking_requests').insert({
          host_id:host,requester_id:uid,starts_at:start,ends_at:end,notes:str(body.notes,1000)
        }).select('id,status,starts_at,ends_at').single();
        if(error)return reject('Requested time is not available',409);
        await db.from('member_notifications').insert({recipient_id:host,kind:'creator_booking',title:'New professional shoot booking request',details:{booking_id:data.id}});
        await audits('creator_booking_request',data.id);
        return reply({item:data},201);
      }
      case 'creator_bookings_respond':{
        if(!uuid(body.id)||!['confirmed','declined'].includes(body.status))return reject('Invalid booking response',400);
        const {data:existing,error:existingError}=await db.from('creator_booking_requests')
          .select('id,host_id,requester_id,status').eq('id',body.id).maybeSingle();
        if(existingError||!existing||existing.host_id!==uid)return reject('Booking unavailable',403);
        if(existing.status!=='requested')return reject('Booking has already been answered',409);
        const {data,error}=await db.from('creator_booking_requests')
          .update({status:body.status,updated_at:new Date().toISOString()})
          .eq('id',existing.id).eq('status','requested').select('id,status').maybeSingle();
        if(error||!data)return reject('Booking update conflict',409);
        await db.from('member_notifications').insert({recipient_id:existing.requester_id,kind:'creator_booking',title:'Booking '+body.status,details:{booking_id:data.id}});
        await audits('creator_booking_response',data.id,{status:data.status});
        return reply({item:data});
      }
      case 'creator_bookings_cancel':{
        if(!uuid(body.id))return reject('Invalid booking ID',400);
        const {data:existing,error:existingError}=await db.from('creator_booking_requests')
          .select('id,host_id,requester_id,status').eq('id',body.id).maybeSingle();
        if(existingError||!existing||![existing.host_id,existing.requester_id].includes(uid))return reject('Booking unavailable',403);
        if(!['requested','confirmed'].includes(existing.status))return reject('Booking cannot be cancelled',409);
        const {data,error}=await db.from('creator_booking_requests')
          .update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',existing.id)
          .in('status',['requested','confirmed']).select('id').maybeSingle();
        if(error||!data)return reject('Booking update conflict',409);
        const recipient=existing.host_id===uid?existing.requester_id:existing.host_id;
        await db.from('member_notifications').insert({recipient_id:recipient,kind:'creator_booking',title:'Booking cancelled',details:{booking_id:data.id}});
        await audits('creator_booking_cancel',data.id);
        return reply({ok:true});
      }
      case 'community_feed':{
        if(!await feature('community_feed'))return reject('Feed not available',403);
        const blocked=await blockedUsers();
        const {data,error}=await db.from('community_posts')
          .select('id,author_id,body,created_at,published_at')
          .eq('status','published').order('published_at',{ascending:false}).limit(paid?55:15);
        if(error)throw error;
        const authorIds=[...new Set((data||[]).map((v:any)=>v.author_id))];
        const {data:restricted,error:restrictedError}=authorIds.length?
          await db.from('account_security').select('user_id').in('user_id',authorIds)
            .or('banned.eq.true,suspended.eq.true'):{data:[],error:null};
        if(restrictedError)throw restrictedError;
        const restrictedIds=new Set((restricted||[]).map((v:any)=>v.user_id));
        const items=(data||[]).filter((v:any)=>!blocked.has(v.author_id)&&!restrictedIds.has(v.author_id));
        const ids=items.map((v:any)=>v.id);
        const authors=[...new Set(items.map((v:any)=>v.author_id))];
        const {data:profiles,error:profileError}=authors.length
          ?await db.from('member_profiles').select('id,display_name,role_type,city').in('id',authors)
          :{data:[],error:null};
        if(profileError)throw profileError;
        const {data:reactions,error:reactionError}=ids.length
          ?await db.from('community_reactions').select('post_id,user_id').in('post_id',ids).limit(1000)
          :{data:[],error:null};
        if(reactionError)throw reactionError;
        const {data:following,error:followError}=await db.from('member_follows')
          .select('followed_id').eq('follower_id',uid).limit(200);
        if(followError)throw followError;
        const followSet=new Set((following||[]).map((f:any)=>f.followed_id));
        const mode=body?.feed_mode==='following'?'following':'latest';
        const shown=mode==='following'?items.filter((item:any)=>followSet.has(item.author_id)):items;
        return reply({items:shown.map((v:any)=>({
          ...v,author:(profiles||[]).find((p:any)=>p.id===v.author_id)||null,
          reactions:(reactions||[]).filter((r:any)=>r.post_id===v.id).length,
          liked:(reactions||[]).some((r:any)=>r.post_id===v.id&&r.user_id===uid),
          followed:followSet.has(v.author_id)
        })),preview:!paid});
      }
      case 'community_create_post':{
        if(!paid||!await feature('community_publish'))return reject('Premium publishing required',403);
        const content=str(body.body,3000);
        if(content.length<5)return reject('Post must be at least 5 characters',400);
        if(!await rate('community_posts','author_id',5,86400000))return reject('Daily post limit reached',429);
        const {data,error}=await db.from('community_posts').insert({
          author_id:uid,body:content,status:'pending'
        }).select('id,status').single();
        if(error)throw error;
        try{await addQueue('post',data.id);}catch(e){
          await db.from('community_posts').delete().eq('id',data.id);
          throw e;
        }
        await audits('community_submit_post',data.id);
        return reply({item:data,note:'Pending human review; not publicly visible yet'},201);
      }
      case 'community_comments':{
        if(!uuid(body.post_id)||!await feature('community_feed'))return reject('Post unavailable',400);
        const {data:post,error:pError}=await db.from('community_posts').select('id,status').eq('id',body.post_id).maybeSingle();
        if(pError||post?.status!=='published')return reject('Post unavailable',404);
        const {data,error}=await db.from('community_comments').select('id,author_id,body,created_at')
          .eq('post_id',body.post_id).eq('status','published').order('created_at').limit(100);
        if(error)throw error;
        const blocked=await blockedUsers();
        return reply({items:(data||[]).filter((v:any)=>!blocked.has(v.author_id))});
      }
      case 'community_comment':{
        if(!paid||!await feature('community_publish'))return reject('Premium commenting required',403);
        if(!uuid(body.post_id))return reject('Invalid post',400);
        const content=str(body.body,2000);
        if(content.length<2)return reject('Comment must be at least 2 characters',400);
        const {data:post,error:pError}=await db.from('community_posts')
          .select('id,status').eq('id',body.post_id).maybeSingle();
        if(pError||post?.status!=='published')return reject('Post unavailable',404);
        if(!await rate('community_comments','author_id',30,86400000))return reject('Daily comment limit reached',429);
        const {data,error}=await db.from('community_comments').insert({
          post_id:post.id,author_id:uid,body:content,status:'pending'
        }).select('id,status').single();
        if(error)throw error;
        try{await addQueue('comment',data.id);}catch(e){await db.from('community_comments').delete().eq('id',data.id);throw e;}
        await audits('community_submit_comment',data.id);
        return reply({item:data,note:'Comment is pending moderation'},201);
      }
      case 'community_toggle_reaction':{
        if(!await feature('community_feed'))return reject('Reactions unavailable',403);
        if(!uuid(body.post_id))return reject('Invalid post',400);
        const {data:post,error:pError}=await db.from('community_posts')
          .select('id,status').eq('id',body.post_id).maybeSingle();
        if(pError||post?.status!=='published')return reject('Post unavailable',404);
        const {data:prior,error:existingError}=await db.from('community_reactions').select('post_id')
          .eq('post_id',post.id).eq('user_id',uid).maybeSingle();
        if(existingError)throw existingError;
        const outcome=prior
          ?await db.from('community_reactions').delete().eq('post_id',post.id).eq('user_id',uid)
          :await db.from('community_reactions').insert({post_id:post.id,user_id:uid});
        if(outcome.error)throw outcome.error;
        return reply({liked:!prior});
      }
      case 'admin_moderation_queue':{
        if(!admin)return reject('Administrator required',403);
        const {data,error}=await db.from('content_moderation_queue')
          .select('id,content_type,content_id,status,created_at,submitter_id')
          .eq('status','pending').order('created_at').limit(70);
        if(error)throw error;
        const items=[];
        for(const record of data||[]){
          const table=record.content_type==='post'?'community_posts':record.content_type==='comment'?'community_comments':null;
          if(!table)continue;
          const {data:content}=await db.from(table).select('body').eq('id',record.content_id).maybeSingle();
          items.push({...record,body:content?.body||''});
        }
        return reply({items});
      }
      case 'admin_moderation_decide':{
        if(!admin)return reject('Administrator required',403);
        if(!uuid(body.queue_id)||!['approved','rejected'].includes(body.decision))
          return reject('Invalid moderation decision',400);
        const {data:record,error:qError}=await db.from('content_moderation_queue')
          .select('id,content_type,content_id,status').eq('id',body.queue_id).maybeSingle();
        if(qError||record?.status!=='pending')return reject('Queue item unavailable',409);
        const table=record.content_type==='post'?'community_posts':
          record.content_type==='comment'?'community_comments':null;
        if(!table)return reject('Unsupported content type',400);
        const status=body.decision==='approved'?'published':'rejected';
        const updates:any={status};
        if(table==='community_posts'&&status==='published')updates.published_at=new Date().toISOString();
        const {error:contentError}=await db.from(table).update(updates).eq('id',record.content_id);
        if(contentError)throw contentError;
        const {error:markError}=await db.from('content_moderation_queue').update({
          status:body.decision,reason:str(body.reason,500),reviewer_id:uid,
          reviewed_at:new Date().toISOString()
        }).eq('id',record.id).eq('status','pending');
        if(markError)throw markError;
        await audits('moderation_decision',record.content_id,{decision:body.decision});
        return reply({status});
      }

      case 'feedback_list':{
        if(!await feature('product_feedback'))return reject('Feedback not available',403);
        const {data,error}=await db.from('feature_feedback')
          .select('id,title,description,status,created_at').order('created_at',{ascending:false}).limit(100);
        if(error)throw error;
        const ids=(data||[]).map((x:any)=>x.id);
        const {data:votes,error:voteError}=ids.length?await db.from('feature_feedback_votes')
          .select('feedback_id,user_id').in('feedback_id',ids).limit(5000):{data:[],error:null};
        if(voteError)throw voteError;
        return reply({items:(data||[]).map((x:any)=>({
          ...x,votes:(votes||[]).filter((v:any)=>v.feedback_id===x.id).length,
          voted:(votes||[]).some((v:any)=>v.feedback_id===x.id&&v.user_id===uid)
        }))});
      }
      case 'feedback_create':{
        if(!await feature('product_feedback'))return reject('Feedback unavailable',403);
        const title=str(body.title,140),description=str(body.description,2000);
        if(title.length<5)return reject('Feature title too short',400);
        if(!await rate('feature_feedback','creator_id',5,604800000))return reject('Weekly feedback limit reached',429);
        const {data,error}=await db.from('feature_feedback').insert({
          creator_id:uid,title,description,status:'submitted'
        }).select('id,status').single();
        if(error)throw error;
        await audits('feature_feedback',data.id);
        return reply({item:data},201);
      }
      case 'feedback_toggle_vote':{
        if(!await feature('product_feedback')||!uuid(body.feedback_id))
          return reject('Feedback unavailable',403);
        const {data:record,error:loadError}=await db.from('feature_feedback')
          .select('id').eq('id',body.feedback_id).maybeSingle();
        if(loadError||!record)return reject('Feature not found',404);
        const {data:prior,error:existingError}=await db.from('feature_feedback_votes')
          .select('feedback_id').eq('feedback_id',record.id).eq('user_id',uid).maybeSingle();
        if(existingError)throw existingError;
        const outcome=prior?await db.from('feature_feedback_votes').delete()
          .eq('feedback_id',record.id).eq('user_id',uid)
          :await db.from('feature_feedback_votes').insert({feedback_id:record.id,user_id:uid});
        if(outcome.error)throw outcome.error;
        return reply({voted:!prior});
      }
      case 'admin_feedback_status':{
        if(!admin)return reject('Administrator required',403);
        if(!uuid(body.id)||!['submitted','under_review','planned','in_progress','shipped','declined'].includes(body.status))
          return reject('Invalid feedback status',400);
        const {data,error}=await db.from('feature_feedback')
          .update({status:body.status}).eq('id',body.id).select('id,status').maybeSingle();
        if(error||!data)return reject('Feedback unavailable',404);
        await audits('feedback_status',data.id,{status:body.status});
        return reply({item:data});
      }
      default:return reject('Unknown product action',404);
    }
  }catch(error){
    console.error('platform-extras failed',action,error);
    return reject('Unable to complete this request',500);
  }
});
