/**
 * Content Connect X trusted workflow gateway.
 * All writes of premium records run after explicit account, age, subscription,
 * and resource membership checks. Raw tables do not expose client insert policies.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json'}});
const isId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const isActive=(v:any)=>v&&['active','trial'].includes(v.status)&&(!v.period_end||new Date(v.period_end)>new Date());
const isAdult=(rows:any[])=>rows.length>0&&rows[0].status==='approved'&&(!rows[0].expires_at||new Date(rows[0].expires_at)>new Date());
const fail=(message:string,status=400)=>respond({error:message},status);
const hashContent=async(content:unknown)=>{
  const bytes=new TextEncoder().encode(JSON.stringify(content));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
};
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return fail('Method not allowed',405);
  const url=Deno.env.get('SUPABASE_URL'),publishable=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!publishable||!secret)return fail('Service unavailable',503);
  const bearer=req.headers.get('Authorization')||'';
  const client=createClient(url,publishable,{global:{headers:{Authorization:bearer}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return fail('Unauthorized',401);
  const admin=createClient(url,secret);
  const uid=user.id;
  const [securityResult,verificationResult,subscriptionResult]=await Promise.all([
    admin.from('account_security').select('banned,suspended,admin').eq('user_id',uid).maybeSingle(),
    admin.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
    admin.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
  ]);
  if(securityResult.error||verificationResult.error||subscriptionResult.error)return fail('Account status unavailable',503);
  const security=securityResult.data;
  if(security?.banned||security?.suspended)return fail('Account unavailable',403);
  const adminRole=security?.admin===true;
  // Every member, including administrators, needs independently approved age verification.
  const verified=isAdult(verificationResult.data||[]);
  const paid=adminRole||isActive(subscriptionResult.data);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object')return fail('Invalid JSON',400);
  const action=text(body.action,65);
  if(!verified)return fail('Approved age verification required',403);
  const freeSafetyActions=new Set(['block_user','unblock_user','submit_report','list_blocks']);
  if(!paid&&!freeSafetyActions.has(action))return fail('Active paid membership required',402);
  const audit=async(type:string,id?:string,metadata:Record<string,unknown>={})=>{
    await admin.from('platform_action_audit').insert({actor_id:uid,action:type,target_type:type.split('_')[0],target_id:isId(id)?id:null,metadata});
  };
  const notification=async(recipient_id:string,kind:string,title:string,details:Record<string,unknown>={})=>{
    await admin.from('member_notifications').insert({recipient_id,kind,title,details});
  };
  const memberOf=async(collaboration_id:string,person=uid)=>{
    const {data,error}=await admin.from('collaboration_members').select('user_id').eq('collaboration_id',collaboration_id).eq('user_id',person).maybeSingle();
    if(error)throw error;
    return Boolean(data);
  };
  const conversationMember=async(conversation_id:string,person=uid)=>{
    const {data,error}=await admin.from('conversation_members').select('user_id').eq('conversation_id',conversation_id).eq('user_id',person).maybeSingle();
    if(error)throw error;
    return Boolean(data);
  };
  try{
    switch(action){
      case 'list_blocks':{
        const {data,error}=await admin.from('member_blocks').select('blocked_id,created_at').eq('blocker_id',uid).limit(100);
        if(error)throw error;
        return respond({items:data});
      }
      case 'block_user':{
        const target=body.target_user_id;
        if(!isId(target)||target===uid)return fail('Valid user required');
        const {error}=await admin.from('member_blocks').upsert({blocker_id:uid,blocked_id:target},{onConflict:'blocker_id,blocked_id'});
        if(error)return fail('Unable to block user',400);
        await audit('block_user',target);
        return respond({ok:true});
      }
      case 'unblock_user':{
        const target=body.target_user_id;
        if(!isId(target))return fail('Valid user required');
        const {error}=await admin.from('member_blocks').delete().eq('blocker_id',uid).eq('blocked_id',target);
        if(error)throw error;
        await audit('unblock_user',target);
        return respond({ok:true});
      }
      case 'submit_report':{
        const target=body.reported_id,reason=text(body.reason,300);
        if(!isId(target)||target===uid||reason.length<5)return fail('Valid reported user and reason required');
        const {data,error}=await admin.from('member_reports').insert({reporter_id:uid,reported_id:target,reason,details:text(body.details,3000)}).select('id,status').single();
        if(error)throw error;
        await audit('submit_report',data.id);
        return respond({item:data},201);
      }
      case 'list_collaborations':{
        const {data:members,error}=await admin.from('collaboration_members').select('collaboration_id').eq('user_id',uid).limit(200);
        if(error)throw error;
        const ids=(members||[]).map(v=>v.collaboration_id);
        if(!ids.length)return respond({items:[]});
        const {data,error:loadError}=await admin.from('collaborations').select('id,title,description,status,creator_id,requires_work_clearance,created_at').in('id',ids).order('created_at',{ascending:false});
        if(loadError)throw loadError;
        return respond({items:data});
      }
      case 'create_collaboration':{
        const title=text(body.title,140),description=text(body.description,3000);
        if(title.length<3)return fail('Collaboration title is required');
        const {data:record,error}=await admin.from('collaborations').insert({creator_id:uid,title,description,status:'draft',requires_work_clearance:body.requires_work_clearance===true}).select('id,title,status,created_at').single();
        if(error)throw error;
        const {error:joinError}=await admin.from('collaboration_members').insert({collaboration_id:record.id,user_id:uid,membership_role:'owner'});
        if(joinError){await admin.from('collaborations').delete().eq('id',record.id);throw joinError;}
        await audit('create_collaboration',record.id);
        return respond({item:record},201);
      }
      case 'invite_collaborator':{
        const cid=body.collaboration_id, invitee=body.invitee_id;
        if(!isId(cid)||!isId(invitee)||invitee===uid)return fail('Valid collaboration and invitee required');
        const {data:collab,error:collabError}=await admin.from('collaborations').select('id,creator_id,title').eq('id',cid).maybeSingle();
        if(collabError||!collab||collab.creator_id!==uid)return fail('Only the collaboration owner can invite members',403);
        if(await memberOf(cid,invitee))return fail('Already a member',409);
        const {data:theirAge,error:ageError}=await admin.from('age_verification_requests').select('status,expires_at').eq('user_id',invitee).order('created_at',{ascending:false}).limit(1);
        const {data:theirSubscription,error:subError}=await admin.from('member_subscriptions').select('status,period_end').eq('user_id',invitee).maybeSingle();
        if(ageError||subError||!isAdult(theirAge||[])||!isActive(theirSubscription))return fail('Invitee must be verified and subscribed',403);
        const {data,error}=await admin.from('collaboration_invitations').insert({collaboration_id:cid,invited_by:uid,invitee_id:invitee,status:'pending'}).select('id,collaboration_id,status').single();
        if(error)return fail('Invitation already exists or cannot be created',409);
        await notification(invitee,'collaboration_invite','New collaboration invitation',{invitation_id:data.id,collaboration_id:cid});
        await audit('invite_collaborator',data.id);
        return respond({item:data},201);
      }
      case 'list_invitations':{
        const {data,error}=await admin.from('collaboration_invitations').select('id,collaboration_id,invited_by,invitee_id,status,created_at').eq('invitee_id',uid).order('created_at',{ascending:false}).limit(100);
        if(error)throw error;
        return respond({items:data});
      }
      case 'respond_invitation':{
        const invitation_id=body.invitation_id;
        if(!isId(invitation_id)||!['accepted','declined'].includes(body.status))return fail('Invalid invitation');
        const {data:invite,error}=await admin.from('collaboration_invitations').select('id,collaboration_id,invitee_id,invited_by,status').eq('id',invitation_id).maybeSingle();
        if(error||!invite||invite.invitee_id!==uid)return fail('Invitation unavailable',403);
        if(invite.status!=='pending')return fail('Invitation already handled',409);
        if(body.status==='accepted'){
          const {error:insertError}=await admin.from('collaboration_members').insert({collaboration_id:invite.collaboration_id,user_id:uid,membership_role:'participant'});
          if(insertError)return fail('Could not join collaboration',409);
        }
        const {error:saveError}=await admin.from('collaboration_invitations').update({status:body.status,responded_at:new Date().toISOString()}).eq('id',invitation_id).eq('status','pending');
        if(saveError)throw saveError;
        await notification(invite.invited_by,'collaboration_invite',`Collaboration invitation ${body.status}`,{collaboration_id:invite.collaboration_id});
        await audit('respond_invitation',invitation_id,{status:body.status});
        return respond({item:{id:invitation_id,status:body.status}});
      }
      case 'list_connection_requests':{
        const {data,error}=await admin.from('member_connection_requests')
          .select('id,requester_id,recipient_id,status,requested_at,responded_at')
          .or(`requester_id.eq.${uid},recipient_id.eq.${uid}`)
          .order('requested_at',{ascending:false}).limit(100);
        if(error)throw error;
        return respond({items:data||[]});
      }
      case 'request_connection':{
        const target=body.target_user_id;
        if(!isId(target)||target===uid)return fail('A valid recipient is required');
        const {data:otherAge,error:ageError}=await admin.from('age_verification_requests')
          .select('status,expires_at').eq('user_id',target)
          .order('created_at',{ascending:false}).limit(1);
        const {data:otherSub,error:subError}=await admin.from('member_subscriptions')
          .select('status,period_end').eq('user_id',target).maybeSingle();
        const {data:otherSec,error:secError}=await admin.from('account_security')
          .select('banned,suspended').eq('user_id',target).maybeSingle();
        if(ageError||subError||secError||!isAdult(otherAge||[])||!isActive(otherSub)||otherSec?.banned||otherSec?.suspended)
          return fail('The recipient cannot receive requests',403);
        const {data:blocks,error:blockError}=await admin.from('member_blocks').select('blocker_id')
          .or(`and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`).limit(1);
        if(blockError)throw blockError;
        if(blocks?.length)return fail('Connection unavailable',403);
        const {data:prior,error:priorError}=await admin.from('member_connection_requests').select('id,status')
          .eq('requester_id',target).eq('recipient_id',uid).maybeSingle();
        if(priorError)throw priorError;
        if(prior&&['pending','accepted'].includes(prior.status))return fail('Respond to the existing request instead',409);
        const {data,error}=await admin.from('member_connection_requests').upsert({
          requester_id:uid,recipient_id:target,status:'pending',requested_at:new Date().toISOString(),responded_at:null
        },{onConflict:'requester_id,recipient_id'}).select('id,status').single();
        if(error)throw error;
        await notification(target,'connection_request','New connection request',{request_id:data.id});
        await audit('request_connection',data.id);
        return respond({item:data},201);
      }
      case 'respond_connection':{
        if(!isId(body.request_id)||!['accepted','declined'].includes(body.status))return fail('Invalid request');
        const {data:request,error}=await admin.from('member_connection_requests')
          .select('id,requester_id,recipient_id,status').eq('id',body.request_id).maybeSingle();
        if(error||!request||request.recipient_id!==uid)return fail('Request unavailable',403);
        if(request.status!=='pending')return fail('Request already handled',409);
        const {data:blocks,error:blockError}=await admin.from('member_blocks').select('blocker_id')
          .or(`and(blocker_id.eq.${uid},blocked_id.eq.${request.requester_id}),and(blocker_id.eq.${request.requester_id},blocked_id.eq.${uid})`).limit(1);
        if(blockError)throw blockError;
        if(blocks?.length)return fail('Connection unavailable',403);
        const {data:saved,error:updateError}=await admin.from('member_connection_requests')
          .update({status:body.status,responded_at:new Date().toISOString()})
          .eq('id',request.id).eq('status','pending').select('id,status').maybeSingle();
        if(updateError||!saved)return fail('Request could not be updated',409);
        await notification(request.requester_id,'connection_request',`Connection request ${body.status}`,{request_id:request.id});
        await audit('respond_connection',request.id,{status:body.status});
        return respond({item:saved});
      }
      case 'list_conversations':{
        const {data:links,error}=await admin.from('conversation_members').select('conversation_id,last_read_at').eq('user_id',uid).limit(75);
        if(error)throw error;
        const ids=(links||[]).map(v=>v.conversation_id);
        if(!ids.length)return respond({items:[]});
        const {data,error:loadError}=await admin.from('conversations').select('id,created_at').in('id',ids).order('created_at',{ascending:false});
        if(loadError)throw loadError;
        const enriched=await Promise.all((data||[]).map(async c=>{
          const cursor=links?.find(l=>l.conversation_id===c.id)?.last_read_at;
          let q=admin.from('messages').select('id',{head:true,count:'exact'}).eq('conversation_id',c.id).neq('sender_id',uid);
          if(cursor)q=q.gt('created_at',cursor);
          const {count,error:countError}=await q;
          return {...c,unread:countError?0:(count||0)};
        }));
        return respond({items:enriched});
      }
      case 'create_conversation':{
        const target=body.target_user_id;
        if(!isId(target)||target===uid)return fail('Valid recipient required');
        const {data:targetSecurity,error:targetError}=await admin.from('account_security').select('banned,suspended').eq('user_id',target).maybeSingle();
        if(targetError||targetSecurity?.banned||targetSecurity?.suspended)return fail('Recipient unavailable',403);
        const {data:theirAge,error:theirAgeError}=await admin.from('age_verification_requests').select('status,expires_at').eq('user_id',target).order('created_at',{ascending:false}).limit(1);
        if(theirAgeError||!isAdult(theirAge||[]))return fail('Recipient is not verified',403);
        const {data:theirSubscription,error:subError}=await admin.from('member_subscriptions').select('status,period_end').eq('user_id',target).maybeSingle();
        if(subError||!isActive(theirSubscription))return fail('Recipient unavailable',403);
        // Both people must have expressly accepted a connection before direct chat.
        const {data:connections,error:connectError}=await admin.from('member_connection_requests')
          .select('id,status')
          .or(`and(requester_id.eq.${uid},recipient_id.eq.${target}),and(requester_id.eq.${target},recipient_id.eq.${uid})`)
          .eq('status','accepted').limit(1);
        if(connectError)throw connectError;
        if(!connections?.length)return fail('A mutually accepted connection is required before messaging',403);
        // A block in either direction prevents new contact.
        const {data:blocks,error:blockError}=await admin.from('member_blocks').select('blocker_id').or(`and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`).limit(1);
        if(blockError)throw blockError;
        if(blocks?.length)return fail('This conversation cannot be created',403);
        const {data:convo,error}=await admin.from('conversations').insert({}).select('id,created_at').single();
        if(error)throw error;
        const {error:membersError}=await admin.from('conversation_members').insert([{conversation_id:convo.id,user_id:uid},{conversation_id:convo.id,user_id:target}]);
        if(membersError){await admin.from('conversations').delete().eq('id',convo.id);throw membersError;}
        await notification(target,'conversation','New conversation request',{conversation_id:convo.id});
        await audit('create_conversation',convo.id);
        return respond({item:convo},201);
      }
      case 'list_messages':{
        const cid=body.conversation_id;
        if(!isId(cid)||!await conversationMember(cid))return fail('Conversation not available',403);
        const {data,error}=await admin.from('messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',cid).order('created_at',{ascending:false}).limit(100);
        if(error)throw error;
        return respond({items:(data||[]).reverse()});
      }
      case 'mark_conversation_read':{
        const conversation_id=body.conversation_id;
        if(!isId(conversation_id)||!await conversationMember(conversation_id))return fail('Conversation unavailable',403);
        const {data,error}=await admin.from('conversation_members')
          .update({last_read_at:new Date().toISOString()})
          .eq('conversation_id',conversation_id).eq('user_id',uid)
          .select('conversation_id').maybeSingle();
        if(error||!data)return fail('Unable to mark read',404);
        return respond({ok:true});
      }
      case 'send_message':{
        const cid=body.conversation_id,message=text(body.message,10000);
        if(!isId(cid)||!await conversationMember(cid))return fail('Conversation not available',403);
        if(!message||message.length>10000)return fail('Message text is required');
        // Simple server-side abuse throttling. Larger deployments should use an atomic rate limiter.
        const cutoff=new Date(Date.now()-60000).toISOString();
        const {count,error:rateError}=await admin.from('messages').select('id',{count:'exact',head:true}).eq('sender_id',uid).gte('created_at',cutoff);
        if(rateError)throw rateError;
        if((count||0)>=25)return fail('Message rate limit reached. Try again shortly.',429);
        const {data:members,error:memberError}=await admin.from('conversation_members').select('user_id').eq('conversation_id',cid);
        if(memberError)throw memberError;
        const recipients=(members||[]).filter(m=>m.user_id!==uid).map(m=>m.user_id);
        for(const target of recipients){
          const {data:blocks,error:blockError}=await admin.from('member_blocks').select('blocker_id').or(`and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`).limit(1);
          if(blockError)throw blockError;
          if(blocks?.length)return fail('Conversation unavailable',403);
        }
        const {data,error}=await admin.from('messages').insert({conversation_id:cid,sender_id:uid,body:message}).select('id,conversation_id,sender_id,body,created_at').single();
        if(error)throw error;
        const {data:participants,error:participantError}=await admin.from('conversation_members').select('user_id').eq('conversation_id',cid);
        if(participantError)throw participantError;
        for(const m of participants||[])if(m.user_id!==uid)await notification(m.user_id,'message','New message',{conversation_id:cid});
        await audit('send_message',data.id);
        return respond({item:data},201);
      }
      case 'list_contracts':{
        const {data:members,error}=await admin.from('collaboration_members').select('collaboration_id').eq('user_id',uid);
        if(error)throw error;
        const ids=(members||[]).map(v=>v.collaboration_id);
        if(!ids.length)return respond({items:[]});
        const {data,error:loadError}=await admin.from('contracts').select('id,collaboration_id,title,status,created_by,created_at,locked_at,content').in('collaboration_id',ids).order('created_at',{ascending:false}).limit(100);
        if(loadError)throw loadError;
        return respond({items:data});
      }
      case 'create_contract':{
        const cid=body.collaboration_id,title=text(body.title,150),content=body.content;
        if(!isId(cid)||!await memberOf(cid))return fail('Collaboration not available',403);
        if(title.length<3||!content||typeof content!=='object'||Array.isArray(content))return fail('Valid contract required');
        if(JSON.stringify(content).length>40000)return fail('Contract too large');
        const {data,error}=await admin.from('contracts').insert({collaboration_id:cid,title,content,created_by:uid,status:'draft'}).select('id,collaboration_id,title,status,created_at').single();
        if(error)throw error;
        await audit('create_contract',data.id);
        return respond({item:data},201);
      }
      case 'sign_contract':{
        // Formal agreements must be signed with independently verified DocuSign
        // envelopes, not locally generated signature rows.
        return fail('DocuSign completion is required. In-app prototype signing is disabled.',409);
      }
      case 'list_properties':{
        const {data,error}=await admin.from('properties').select('id,title,description,city,state,country,hourly_rate,status').eq('status','active').order('created_at',{ascending:false}).limit(60);
        if(error)throw error;
        return respond({items:data});
      }
      case 'list_my_properties':{
        const {data,error}=await admin.from('properties').select('id,title,description,city,state,country,hourly_rate,status').eq('owner_id',uid).order('created_at',{ascending:false});
        if(error)throw error;
        return respond({items:data});
      }
      case 'create_property':{
        const title=text(body.title,140);
        if(title.length<3)return fail('Property title is required');
        const rate=Number(body.hourly_rate)||0;
        if(rate<0||rate>100000)return fail('Invalid hourly rate');
        const {data,error}=await admin.from('properties').insert({owner_id:uid,status:'draft',title,description:text(body.description,3000),city:text(body.city,100),state:text(body.state,100),country:text(body.country,80),hourly_rate:rate}).select('id,title,status').single();
        if(error)throw error;
        await audit('create_property',data.id);
        return respond({item:data},201);
      }
      case 'list_bookings':{
        const {data,error}=await admin.from('property_booking_requests').select('id,property_id,requester_id,owner_id,starts_at,ends_at,status,created_at,notes').or(`requester_id.eq.${uid},owner_id.eq.${uid}`).order('created_at',{ascending:false}).limit(100);
        if(error)throw error;
        return respond({items:data});
      }
      case 'book_property':{
        const property_id=body.property_id;
        if(!isId(property_id))return fail('Property ID required');
        const {data:property,error}=await admin.from('properties').select('id,owner_id,status').eq('id',property_id).maybeSingle();
        if(error||!property||property.status!=='active')return fail('Property unavailable',404);
        if(property.owner_id===uid)return fail('Cannot book your own property');
        const start=new Date(body.starts_at),end=new Date(body.ends_at);
        if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start.getTime()<=Date.now()||end<=start||end.getTime()-start.getTime()>86400000||start.getTime()>Date.now()+180*86400000)return fail('Invalid booking interval');
        const {data:existing,error:overlapError}=await admin.from('property_booking_requests').select('id').eq('property_id',property_id).in('status',['accepted','requested']).lt('starts_at',end.toISOString()).gt('ends_at',start.toISOString()).limit(1);
        if(overlapError)throw overlapError;
        if(existing?.length)return fail('Requested interval is not available',409);
        const {data,error:insertError}=await admin.from('property_booking_requests').insert({property_id,owner_id:property.owner_id,requester_id:uid,starts_at:start.toISOString(),ends_at:end.toISOString(),notes:text(body.notes,1000),status:'requested'}).select('id,status,starts_at,ends_at').single();
        if(insertError)throw insertError;
        await notification(property.owner_id,'booking','New property booking request',{booking_id:data.id});
        await audit('book_property',data.id);
        return respond({item:data},201);
      }
      case 'respond_booking':{
        const id=body.booking_id;
        if(!isId(id)||!['accepted','declined'].includes(body.status))return fail('Invalid response');
        const {data:booking,error}=await admin.from('property_booking_requests').select('id,owner_id,requester_id,status').eq('id',id).maybeSingle();
        if(error||!booking||booking.owner_id!==uid)return fail('Booking unavailable',403);
        if(booking.status!=='requested')return fail('Booking already handled',409);
        const {data,error:saveError}=await admin.from('property_booking_requests').update({status:body.status}).eq('id',id).eq('status','requested').select('id,status').maybeSingle();
        if(saveError||!data)return fail('Booking update conflict',409);
        await notification(booking.requester_id,'booking',`Booking ${body.status}`,{booking_id:id});
        await audit('respond_booking',id,{status:body.status});
        return respond({item:data});
      }
      case 'list_notifications':{
        const {data,error}=await admin.from('member_notifications').select('id,kind,title,details,read_at,created_at').eq('recipient_id',uid).order('created_at',{ascending:false}).limit(50);
        if(error)throw error;
        return respond({items:data});
      }
      case 'mark_notification_read':{
        if(!isId(body.notification_id))return fail('Invalid notification');
        const {data,error}=await admin.from('member_notifications').update({read_at:new Date().toISOString()}).eq('id',body.notification_id).eq('recipient_id',uid).select('id').maybeSingle();
        if(error||!data)return fail('Notification unavailable',404);
        return respond({ok:true});
      }
      default:return fail('Unknown workflow action',404);
    }
  }catch(error){
    console.error('member-workflows:',action,error);
    return fail('Workflow could not be completed',500);
  }
});
