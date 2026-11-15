/**
 * Unified production workflow API. Feature flags are UX only; age, subscription,
 * membership, and server-held admin role determine every action.
 * Safety reports remain available regardless of payment.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const safe=(v:unknown,n=1000)=>typeof v==='string'?v.trim().slice(0,n):'';
const active=(s:any)=>['active','trial'].includes(s?.status)&&(!s.period_end||Date.parse(s.period_end)>Date.now());

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return json({error:'Service unavailable'},503);
 const c=createClient(url,pub,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authError}=await c.auth.getUser();
 if(authError||!user)return json({error:'Unauthorized'},401);
 const db=createClient(url,secret),uid=user.id;
 const [security,age,subscription]=await Promise.all([
   db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
   db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
   db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle()
 ]);
 if(security.error||age.error||subscription.error)return json({error:'Account status unavailable'},503);
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object')return json({error:'Invalid payload'},400);
 const action=safe(body.action,55),isAdmin=security.data?.admin===true;
 const approved=age.data?.[0]?.status==='approved'&&(!age.data[0].expires_at||Date.parse(age.data[0].expires_at)>Date.now());
 const paid=isAdmin||active(subscription.data);
 if(!approved)return json({error:'Verified adult account required'},403);
 const safetyActions=new Set(['create_case','my_cases','case_history','case_add_note']);
 if((security.data?.banned||security.data?.suspended)&&!safetyActions.has(action))return json({error:'Account restricted'},403);
 if(!paid&&!safetyActions.has(action))return json({error:'Paid membership required'},403);
 const log=async(event:string,target:string,meta:Record<string,unknown>={})=>{
   await db.from('platform_action_audit').insert({actor_id:uid,action:event,target_type:'production_manager',target_id:target,metadata:meta});
 };
 const memberOf=async(team_id:string,person=uid)=>{
   const {data,error}=await db.from('production_team_members').select('role,status').eq('team_id',team_id).eq('member_id',person).maybeSingle();
   if(error)throw error;
   return data;
 };
 const eventAccess=async(id:string)=>{
   const {data,eventError}=await db.from('production_events').select('id,organizer_id,team_id,visibility,status,capacity,starts_at,ends_at,title,city').eq('id',id).maybeSingle();
   if(eventError||!data)return null;
   if(data.organizer_id===uid)return data;
   if(data.visibility==='verified')return data;
   if(data.team_id&&(await memberOf(data.team_id))?.status==='active')return data;
   const {data:rsvp}=await db.from('production_event_rsvps').select('user_id').eq('event_id',id).eq('user_id',uid).maybeSingle();
   return rsvp?data:null;
 };
 try{
   switch(action){
     case 'teams_list':{
       const {data:links,error}=await db.from('production_team_members').select('team_id,role,status').eq('member_id',uid).limit(100);
       if(error)throw error;
       if(!links?.length)return json({items:[]});
       const ids=links.map(x=>x.team_id);
       const {data,error:teamError}=await db.from('production_teams').select('id,owner_id,name,description,visibility,created_at').in('id',ids);
       if(teamError)throw teamError;
       return json({items:(data||[]).map(x=>({...x,my_membership:links.find(y=>y.team_id===x.id)}))});
     }
     case 'teams_create':{
       const name=safe(body.name,120);
       if(name.length<3)return json({error:'Team name must have at least 3 characters'},400);
       const {data,error}=await db.from('production_teams').insert({owner_id:uid,name,description:safe(body.description,2000)}).select('id,name,created_at').single();
       if(error)throw error;
       const {error:linkError}=await db.from('production_team_members').insert({team_id:data.id,member_id:uid,role:'owner',status:'active',joined_at:new Date().toISOString()});
       if(linkError){await db.from('production_teams').delete().eq('id',data.id);throw linkError;}
       await log('team_created',data.id);
       return json({item:data},201);
     }
     case 'teams_invite':{
       if(!uuid(body.team_id)||!uuid(body.member_id)||body.member_id===uid)return json({error:'Valid team and member required'},400);
       const me=await memberOf(body.team_id);
       if(!me||me.status!=='active'||!['owner','manager'].includes(me.role))return json({error:'Team management permission required'},403);
       const [targetAge,block]=await Promise.all([
         db.from('age_verification_requests').select('status,expires_at').eq('user_id',body.member_id).order('created_at',{ascending:false}).limit(1),
         db.from('member_blocks').select('blocker_id').or(`and(blocker_id.eq.${uid},blocked_id.eq.${body.member_id}),and(blocker_id.eq.${body.member_id},blocked_id.eq.${uid})`).limit(1)
       ]);
       if(targetAge.error||targetAge.data?.[0]?.status!=='approved'||block.error||block.data?.length)return json({error:'Member cannot be invited'},403);
       const {data:existing}=await db.from('production_team_members').select('status').eq('team_id',body.team_id).eq('member_id',body.member_id).maybeSingle();
       if(existing&&['active','invited'].includes(existing.status))return json({error:'Already invited or joined'},409);
       const {error}=await db.from('production_team_members').upsert({team_id:body.team_id,member_id:body.member_id,role:'member',status:'invited',invited_by:uid,joined_at:null},{onConflict:'team_id,member_id'});
       if(error)throw error;
       await db.from('member_notifications').insert({recipient_id:body.member_id,kind:'team_invite',title:'New production team invitation',details:{team_id:body.team_id}});
       await log('team_invite',body.team_id);
       return json({ok:true});
     }
     case 'teams_respond':{
       if(!uuid(body.team_id)||!['active','declined'].includes(body.status))return json({error:'Invalid invitation response'},400);
       const {data,error}=await db.from('production_team_members').update({status:body.status,joined_at:body.status==='active'?new Date().toISOString():null})
         .eq('team_id',body.team_id).eq('member_id',uid).eq('status','invited').select('team_id,status').maybeSingle();
       if(error||!data)return json({error:'Invitation unavailable'},404);
       await log('team_invite_response',body.team_id,{status:body.status});
       return json({item:data});
     }
     case 'team_members':{
       if(!uuid(body.team_id)||(await memberOf(body.team_id))?.status!=='active')return json({error:'Not a team member'},403);
       const {data,error}=await db.from('production_team_members').select('member_id,role,status,joined_at').eq('team_id',body.team_id).limit(150);
       if(error)throw error;
       return json({items:data});
     }
     case 'events_list':{
       const {data:teamLinks,error:teamError}=await db.from('production_team_members').select('team_id').eq('member_id',uid).eq('status','active').limit(100);
       if(teamError)throw teamError;
       const {data:invites,error:inviteError}=await db.from('production_event_rsvps').select('event_id,status').eq('user_id',uid).limit(100);
       if(inviteError)throw inviteError;
       const {data,error}=await db.from('production_events').select('id,team_id,organizer_id,title,description,city,timezone,starts_at,ends_at,capacity,visibility,status')
         .gte('ends_at',new Date(Date.now()-86400000).toISOString()).order('starts_at').limit(200);
       if(error)throw error;
       const teamIds=new Set((teamLinks||[]).map(x=>x.team_id)),invitedIds=new Set((invites||[]).map(x=>x.event_id));
       return json({items:(data||[]).filter(x=>x.organizer_id===uid||x.visibility==='verified'&&x.status==='scheduled'||x.team_id&&teamIds.has(x.team_id)||invitedIds.has(x.id))
         .map(x=>({...x,my_rsvp:invites?.find(y=>y.event_id===x.id)?.status||null}))});
     }
     case 'events_create':{
       const title=safe(body.title,160),start=Date.parse(body.starts_at),end=Date.parse(body.ends_at);
       const capacity=Number(body.capacity);
       if(title.length<3||!Number.isFinite(start)||!Number.isFinite(end)||start<=Date.now()||end<=start||end-start>7*86400000||!Number.isInteger(capacity)||capacity<1||capacity>250)
         return json({error:'Title, future date interval and capacity are required'},400);
       if(body.team_id&&(!uuid(body.team_id)||!['owner','manager'].includes((await memberOf(body.team_id))?.role||'')))
         return json({error:'Team organizer permission required'},403);
       if(body.collaboration_id){
         const {data:member}=await db.from('collaboration_members').select('user_id').eq('collaboration_id',body.collaboration_id).eq('user_id',uid).maybeSingle();
         if(!member)return json({error:'Not a collaboration member'},403);
       }
       const {data,error}=await db.from('production_events').insert({
         organizer_id:uid,title,description:safe(body.description,3000),city:safe(body.city,100),
         timezone:safe(body.timezone,80)||'UTC',starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),
         capacity,team_id:body.team_id||null,collaboration_id:body.collaboration_id||null,
         status:'scheduled',visibility:body.team_id?'invite':body.visibility==='verified'?'verified':'invite'
       }).select('id,title,status').single();
       if(error)throw error;
       await db.from('production_event_rsvps').insert({event_id:data.id,user_id:uid,status:'going',responded_at:new Date().toISOString()});
       await log('event_created',data.id);
       return json({item:data},201);
     }
     case 'events_invite':{
       if(!uuid(body.event_id)||!uuid(body.member_id))return json({error:'Invalid event or recipient'},400);
       const event=await eventAccess(body.event_id);
       if(!event||event.organizer_id!==uid)return json({error:'Only the organizer may invite'},403);
       const {data:ageCheck}=await db.from('age_verification_requests').select('status').eq('user_id',body.member_id).order('created_at',{ascending:false}).limit(1);
       if(ageCheck?.[0]?.status!=='approved')return json({error:'Recipient must be verified'},403);
       const {error}=await db.from('production_event_rsvps').upsert({event_id:event.id,user_id:body.member_id,status:'invited'},{onConflict:'event_id,user_id',ignoreDuplicates:true});
       if(error)throw error;
       await db.from('member_notifications').insert({recipient_id:body.member_id,kind:'event_invite',title:'New shoot invitation',details:{event_id:event.id}});
       return json({ok:true});
     }
     case 'events_rsvp':{
       if(!uuid(body.event_id)||!['going','maybe','declined'].includes(body.status))return json({error:'Invalid RSVP'},400);
       const event=await eventAccess(body.event_id);
       if(!event||event.status!=='scheduled')return json({error:'Event unavailable'},403);
       if(body.status==='going'){
         const {count,error}=await db.from('production_event_rsvps').select('user_id',{head:true,count:'exact'}).eq('event_id',body.event_id).eq('status','going');
         if(error)throw error;
         const {data:prior}=await db.from('production_event_rsvps').select('status').eq('event_id',body.event_id).eq('user_id',uid).maybeSingle();
         if((count||0)>=event.capacity&&prior?.status!=='going')return json({error:'Event has reached capacity'},409);
       }
       const {data,error}=await db.from('production_event_rsvps').upsert({event_id:body.event_id,user_id:uid,status:body.status,responded_at:new Date().toISOString()},{onConflict:'event_id,user_id'}).select('event_id,status').single();
       if(error)throw error;
       await log('event_rsvp',body.event_id,{status:body.status});
       return json({item:data});
     }
     case 'create_case':{
       if(!['consent','safety','contract','payment','booking','harassment','other'].includes(body.category)||safe(body.description,5000).length<10)
         return json({error:'Category and case description are required'},400);
       let collaboration_id=null,booking_id=null;
       if(body.collaboration_id){
         if(!uuid(body.collaboration_id))return json({error:'Invalid collaboration ID'},400);
         const {data:member}=await db.from('collaboration_members').select('user_id').eq('collaboration_id',body.collaboration_id).eq('user_id',uid).maybeSingle();
         if(!member)return json({error:'Collaboration unavailable'},403);
         collaboration_id=body.collaboration_id;
       }
       if(body.booking_id){
         if(!uuid(body.booking_id))return json({error:'Invalid booking ID'},400);
         const {data:booking}=await db.from('property_booking_requests').select('id').eq('id',body.booking_id).or(`owner_id.eq.${uid},requester_id.eq.${uid}`).maybeSingle();
         if(!booking)return json({error:'Booking unavailable'},403);
         booking_id=body.booking_id;
       }
       const {data,error}=await db.from('production_cases').insert({reporter_id:uid,category:body.category,description:safe(body.description,5000),collaboration_id,booking_id}).select('id,status').single();
       if(error)throw error;
       await db.from('production_case_events').insert({case_id:data.id,actor_id:uid,kind:'opened'});
       await log('case_opened',data.id);
       return json({item:data},201);
     }
     case 'my_cases':{
       let q=db.from('production_cases').select('id,reporter_id,category,description,status,created_at,updated_at,resolution').order('created_at',{ascending:false}).limit(100);
       if(!isAdmin)q=q.eq('reporter_id',uid);
       const {data,error}=await q;if(error)throw error;
       return json({items:data});
     }
     case 'case_history':{
       if(!uuid(body.case_id))return json({error:'Invalid case ID'},400);
       const {data:caseItem}=await db.from('production_cases').select('reporter_id').eq('id',body.case_id).maybeSingle();
       if(!caseItem||(caseItem.reporter_id!==uid&&!isAdmin))return json({error:'Case unavailable'},403);
       const {data,error}=await db.from('production_case_events').select('id,kind,note,created_at').eq('case_id',body.case_id).order('created_at');
       if(error)throw error;
       return json({items:data});
     }
     case 'case_add_note':{
       if(!uuid(body.case_id)||!safe(body.note,5000))return json({error:'Case ID and note required'},400);
       const {data:caseItem}=await db.from('production_cases').select('id,reporter_id').eq('id',body.case_id).maybeSingle();
       if(!caseItem||(caseItem.reporter_id!==uid&&!isAdmin))return json({error:'Case unavailable'},403);
       const {data,error}=await db.from('production_case_events').insert({case_id:body.case_id,actor_id:uid,kind:'note',note:safe(body.note,5000)}).select('id,created_at').single();
       if(error)throw error;
       return json({item:data});
     }
     case 'case_resolve':{
       if(!isAdmin||!uuid(body.case_id)||!['reviewing','mediation','resolved','dismissed'].includes(body.status))return json({error:'Administrator resolution permission required'},403);
       const {data,error}=await db.from('production_cases').update({status:body.status,resolution:safe(body.resolution,3000),assigned_moderator_id:uid,updated_at:new Date().toISOString()}).eq('id',body.case_id).select('id,reporter_id,status').maybeSingle();
       if(error||!data)return json({error:'Case unavailable'},404);
       await db.from('production_case_events').insert({case_id:data.id,actor_id:uid,kind:body.status==='resolved'?'resolved':'status_changed',note:safe(body.resolution,1000)});
       await db.from('member_notifications').insert({recipient_id:data.reporter_id,kind:'case_update',title:'Case status updated',details:{case_id:data.id,status:data.status}});
       await log('case_resolution',data.id,{status:data.status});
       return json({item:{id:data.id,status:data.status}});
     }
     case 'notification_preferences':{
       const {data,error}=await db.from('member_notification_preferences').select('email_digest,booking_reminders,message_alerts').eq('user_id',uid).maybeSingle();
       if(error)throw error;
       return json({item:data||{email_digest:false,booking_reminders:true,message_alerts:true}});
     }
     case 'set_notification_preferences':{
       if(typeof body.email_digest!=='boolean'||typeof body.booking_reminders!=='boolean'||typeof body.message_alerts!=='boolean')return json({error:'Boolean notification choices required'},400);
       const {data,error}=await db.from('member_notification_preferences').upsert({user_id:uid,email_digest:body.email_digest,booking_reminders:body.booking_reminders,message_alerts:body.message_alerts,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select('email_digest,booking_reminders,message_alerts').single();
       if(error)throw error;
       return json({item:data});
     }
     case 'saved_posts':{
       const {data,error}=await db.from('member_saved_posts').select('post_id,created_at').eq('user_id',uid).limit(100);
       if(error)throw error;
       return json({items:data});
     }
     case 'toggle_saved_post':{
       if(!uuid(body.post_id))return json({error:'Invalid post'},400);
       const {data:post}=await db.from('community_posts').select('id,status').eq('id',body.post_id).maybeSingle();
       if(post?.status!=='published')return json({error:'Post unavailable'},404);
       const {data:prior}=await db.from('member_saved_posts').select('post_id').eq('user_id',uid).eq('post_id',body.post_id).maybeSingle();
       const result=prior?await db.from('member_saved_posts').delete().eq('user_id',uid).eq('post_id',body.post_id)
         :await db.from('member_saved_posts').insert({user_id:uid,post_id:body.post_id});
       if(result.error)throw result.error;
       return json({saved:!prior});
     }
     default:return json({error:'Unknown production workflow'},404);
   }
 }catch(e){console.error('production-manager',action,e);return json({error:'Production workflow failed'},500);}
});
