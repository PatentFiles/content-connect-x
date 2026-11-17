/**
 * Content Connect X trusted workflow gateway.
 * All writes of premium records run after explicit account, age, subscription,
 * and resource membership checks. Raw tables do not expose client insert policies.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {isFreeAction,localContactStatus} from './contactPolicy.mjs';
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
  if(adminRole&&!freeSafetyActions.has(action)&&assurance(req.headers.get('Authorization')||'')!=='aal2')return fail('Administrator MFA required',403);
  if(!paid&&!freeSafetyActions.has(action)&&!isFreeAction(action))return fail('Active paid membership required',402);
  // Real feature flags are evaluated on the server, never trusted from UI.
  const actionFeatures:Record<string,string>={
    request_connection:'connections',respond_connection:'connections',
    list_connection_requests:'connections',
    start_conversation:'messages',create_conversation:'messages',
    list_conversations:'messages',list_messages:'messages',send_message:'messages',
    mark_conversation_read:'messages',create_group_conversation:'messages',
    edit_message:'messages',delete_message:'messages',react_message:'messages',
    create_collaboration:'collaborations',invite_collaborator:'collaborations',
    respond_invitation:'collaborations',
    request_connection:'connections',respond_connection:'connections',
    list_contracts:'contracts',create_contract:'contracts',sign_contract:'contracts',
    list_properties:'property_bookings',list_my_properties:'property_bookings',
    create_property:'property_bookings',list_bookings:'property_bookings',
    book_property:'property_bookings',respond_booking:'property_bookings'
  };
  const featureKey=actionFeatures[action];
  if(featureKey){
    const {data:flag,error:flagError}=await admin.from('product_feature_flags')
      .select('enabled,allowed_tiers,rollout_percent').eq('key',featureKey).maybeSingle();
    if(flagError||!flag?.enabled||!flag.allowed_tiers?.includes(paid?'premium':'free'))
      return fail('This feature is unavailable',403);
    let hash=0;for(const char of uid+featureKey)hash=(hash*31+char.charCodeAt(0))>>>0;
    if(hash%100>=flag.rollout_percent)return fail('This feature is not enabled for your account yet',403);
  }
  const enforceFreeContact=async(target:string)=>{
    if(paid)return null;
    const [profiles,areas]=await Promise.all([
      admin.from('member_profiles').select('id,city,state,country').in('id',[uid,target]),
      admin.from('hosting_public_areas').select('city,region,country,latitude,longitude').eq('approved',true)
    ]);
    if(profiles.error||areas.error)return 'Local contact eligibility is temporarily unavailable';
    const my=profiles.data?.find(p=>p.id===uid),other=profiles.data?.find(p=>p.id===target);
    const location=localContactStatus(my,other,areas.data||[]);
    if(!location.allowed)return 'Free introductions are limited to 25 miles using city-level areas. Long-distance profiles can still be saved. '+(location.reason||'');
    const {data:reserved,error}=await admin.rpc('ccx_reserve_free_contact',{p_actor:uid,p_target:target});
    if(error)return 'Unable to check your free contact allowance right now';
    if(reserved!==true)return 'You have reached five different local contacts in the rolling seven-day period. Upgrade to Premium for unlimited contacts.';
    return null;
  };
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
        if(ageError||subError||secError||!isAdult(otherAge||[])||otherSec?.banned||otherSec?.suspended)
          return fail('The recipient cannot receive requests',403);
        const {data:blocks,error:blockError}=await admin.from('member_blocks').select('blocker_id')
          .or(`and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`).limit(1);
        if(blockError)throw blockError;
        if(blocks?.length)return fail('Connection unavailable',403);
        const {data:prior,error:priorError}=await admin.from('member_connection_requests').select('id,status')
          .eq('requester_id',target).eq('recipient_id',uid).maybeSingle();
        if(priorError)throw priorError;
        if(prior&&['pending','accepted'].includes(prior.status))return fail('Respond to the existing request instead',409);
        const localBlock=await enforceFreeContact(target);
        if(localBlock)return fail(localBlock,403);
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
        if(body.status==='accepted'){
          const localBlock=await enforceFreeContact(request.requester_id);
          if(localBlock)return fail(localBlock,403);
        }
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
        const {data,error:loadError}=await admin.from('conversations').select('id,created_at,title,kind').in('id',ids).order('created_at',{ascending:false});
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
        if(subError)return fail('Recipient subscription status unavailable',503);
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
        const localBlock=await enforceFreeContact(target);
        if(localBlock)return fail(localBlock,403);
        const {data:convo,error}=await admin.from('conversations').insert({kind:'direct',created_by:uid}).select('id,created_at,title,kind').single();
        if(error)throw error;
        const {error:membersError}=await admin.from('conversation_members').insert([{conversation_id:convo.id,user_id:uid},{conversation_id:convo.id,user_id:target}]);
        if(membersError){await admin.from('conversations').delete().eq('id',convo.id);throw membersError;}
        await notification(target,'conversation','New conversation request',{conversation_id:convo.id});
        await audit('create_conversation',convo.id);
        return respond({item:convo},201);
      }
      case 'create_group_conversation':{
        if(!paid)return fail('Group conversations require Premium membership',403);
        if(!Array.isArray(body.member_ids)||body.member_ids.length<2||body.member_ids.length>9)
          return fail('Group needs 2–9 other members',400);
        const members=[...new Set(body.member_ids)];
        if(members.length!==body.member_ids.length||members.some(id=>!isId(id)||id===uid))
          return fail('Invalid group members',400);
        const title=text(body.title,100);
        if(title.length<3)return fail('Group name required',400);
        for(const target of members){
          const [a,s,b,r]=await Promise.all([
            admin.from('age_verification_requests').select('status,expires_at').eq('user_id',target).order('created_at',{ascending:false}).limit(1),
            admin.from('member_subscriptions').select('status,period_end').eq('user_id',target).maybeSingle(),
            admin.from('member_blocks').select('blocker_id').or(`and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`).limit(1),
            admin.from('member_connection_requests').select('id').eq('status','accepted').or(`and(requester_id.eq.${uid},recipient_id.eq.${target}),and(requester_id.eq.${target},recipient_id.eq.${uid})`).limit(1)
          ]);
          if(a.error||s.error||b.error||r.error||!isAdult(a.data||[])||!isActive(s.data)||b.data?.length||!r.data?.length)
            return fail('Every participant must be verified, subscribed and mutually connected to the organizer',403);
        }
        const {data,error}=await admin.from('conversations').insert({title,kind:'group',created_by:uid}).select('id,title,kind').single();
        if(error)throw error;
        const {error:joinError}=await admin.from('conversation_members').insert([uid,...members].map(person=>({conversation_id:data.id,user_id:person})));
        if(joinError){await admin.from('conversations').delete().eq('id',data.id);throw joinError;}
        await audit('group_conversation_created',data.id,{members:members.length});
        return respond({item:data},201);
      }
      case 'list_messages':{
        const cid=body.conversation_id;
        if(!isId(cid)||!await conversationMember(cid))return fail('Conversation not available',403);
        const {data,error}=await admin.from('messages').select('id,conversation_id,sender_id,body,created_at,edited_at,deleted_at').eq('conversation_id',cid).order('created_at',{ascending:false}).limit(100);
        if(error)throw error;
        return respond({items:(data||[]).reverse()});
      }
      case 'edit_message':{
        if(!isId(body.message_id))return fail('Invalid message',400);
        const replacement=text(body.message,10000);
        if(!replacement)return fail('Replacement message required',400);
        const {data:prior,error}=await admin.from('messages').select('id,conversation_id,sender_id,body,created_at,deleted_at')
          .eq('id',body.message_id).maybeSingle();
        if(error||!prior||prior.sender_id!==uid||prior.deleted_at)return fail('Message unavailable',403);
        if(Date.now()-Date.parse(prior.created_at)>15*60000)return fail('Message edit window has expired',409);
        if(!await conversationMember(prior.conversation_id))return fail('Conversation unavailable',403);
        const digest=await hashContent(prior.body);
        const {data,error:saveError}=await admin.from('messages').update({body:replacement,edited_at:new Date().toISOString()})
          .eq('id',prior.id).eq('sender_id',uid).is('deleted_at',null).select('id,body,edited_at').maybeSingle();
        if(saveError||!data)return fail('Message changed during editing',409);
        await admin.from('message_revision_audit').insert({message_id:prior.id,actor_id:uid,event_type:'edit',content_hash:digest});
        return respond({item:data});
      }
      case 'delete_message':{
        if(!isId(body.message_id))return fail('Invalid message',400);
        const {data:prior,error}=await admin.from('messages').select('id,conversation_id,sender_id,body,deleted_at')
          .eq('id',body.message_id).maybeSingle();
        if(error||!prior||prior.sender_id!==uid)return fail('Message unavailable',403);
        if(prior.deleted_at)return respond({ok:true,already_deleted:true});
        if(!await conversationMember(prior.conversation_id))return fail('Conversation unavailable',403);
        const digest=await hashContent(prior.body);
        const {error:saveError}=await admin.from('messages').update({body:'[Message removed]',deleted_at:new Date().toISOString()})
          .eq('id',prior.id).eq('sender_id',uid).is('deleted_at',null);
        if(saveError)throw saveError;
        await admin.from('message_revision_audit').insert({message_id:prior.id,actor_id:uid,event_type:'delete',content_hash:digest});
        return respond({ok:true});
      }
      case 'react_message':{
        if(!isId(body.message_id)||!['like','heart','laugh','support'].includes(body.reaction))return fail('Invalid reaction',400);
        const {data:message,error}=await admin.from('messages').select('id,conversation_id,deleted_at').eq('id',body.message_id).maybeSingle();
        if(error||!message||message.deleted_at||!await conversationMember(message.conversation_id))return fail('Message unavailable',403);
        const {data:old}=await admin.from('message_reactions').select('reaction').eq('message_id',message.id).eq('reactor_id',uid).maybeSingle();
        if(old?.reaction===body.reaction){
          const {error:deletionError}=await admin.from('message_reactions').delete().eq('message_id',message.id).eq('reactor_id',uid);
          if(deletionError)throw deletionError;
          return respond({reaction:null});
        }
        const {error:saveError}=await admin.from('message_reactions').upsert({message_id:message.id,reactor_id:uid,reaction:body.reaction},{onConflict:'message_id,reactor_id'});
        if(saveError)throw saveError;
        return respond({reaction:body.reaction});
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
          const localBlock=await enforceFreeContact(target);
          if(localBlock)return fail(localBlock,403);
        }
        if(!paid&&recipients.length!==1)return fail('Free messaging is for direct local connections only',403);
        const {data,error}=await admin.from('messages').insert({conversation_id:cid,sender_id:uid,body:message}).select('id,conversation_id,sender_id,body,created_at').single();
        if(error)throw error;
        const {data:participants,error:participantError}=await admin.from('conversation_members').select('user_id').eq('conversation_id',cid);
        if(participantError)throw participantError;
        for(const m of participants||[])if(m.user_id!==uid)await notification(m.user_id,'message','New message',{conversation_id:cid});
        await audit('send_message',data.id);
        return respond({item:data},201);
      }
      case 'list_collaboration_members':{
        if(!isId(body.collaboration_id)||!await memberOf(body.collaboration_id))return fail('Collaboration unavailable',403);
        const {data,error}=await admin.from('collaboration_members').select('user_id,membership_role')
          .eq('collaboration_id',body.collaboration_id).limit(30);
        if(error)throw error;
        return respond({items:data||[]});
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
        // A clearance-required collaboration cannot begin contractual preparation
        // until each performer has explicitly agreed to share current clearance
        // (binary status only; never individual medical records).
        const {data:collabPolicy,error:policyError}=await admin.from('collaborations')
          .select('requires_work_clearance').eq('id',cid).maybeSingle();
        if(policyError||!collabPolicy)return fail('Collaboration policy unavailable',503);
        if(collabPolicy.requires_work_clearance){
          const {data:members,error:membersError}=await admin.from('collaboration_members')
            .select('user_id').eq('collaboration_id',cid);
          if(membersError||!members?.length)return fail('Collaboration participants unavailable',503);
          const ids=members.map((v:any)=>v.user_id);
          const [consents,checks]=await Promise.all([
            admin.from('ccx_clearance_share_consents').select('user_id,revoked_at')
              .eq('collaboration_id',cid).in('user_id',ids),
            admin.from('performer_work_clearances').select('user_id,clearance_confirmed,expires_at')
              .in('user_id',ids)
          ]);
          if(consents.error||checks.error)return fail('Work clearance status unavailable',503);
          const opted=new Set((consents.data||[]).filter((v:any)=>!v.revoked_at).map((v:any)=>v.user_id));
          if(!ids.every((person:string)=>{
            const c=(checks.data||[]).find((v:any)=>v.user_id===person);
            return opted.has(person)&&c?.clearance_confirmed===true&&c.expires_at&&Date.parse(c.expires_at)>Date.now();
          }))return fail('Every collaboration participant must opt in and have a current verified work-clearance status before contract preparation',409);
        }
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
        // Retired route: never bypass protected host verification, dynamic pricing,
        // contract/payment readiness or equipment inventory in the current API.
        return fail('This booking action moved to Hosting Marketplace. Use the verified hosting workflow.',409);
      }
      case 'list_bookings':{
        const {data,error}=await admin.from('property_booking_requests').select('id,property_id,requester_id,owner_id,starts_at,ends_at,status,created_at,notes').or(`requester_id.eq.${uid},owner_id.eq.${uid}`).order('created_at',{ascending:false}).limit(100);
        if(error)throw error;
        return respond({items:data});
      }
      case 'book_property':{
        // Retired route: never bypass protected host verification, dynamic pricing,
        // contract/payment readiness or equipment inventory in the current API.
        return fail('This booking action moved to Hosting Marketplace. Use the verified hosting workflow.',409);
      }
      case 'respond_booking':{
        // Retired route: never bypass protected host verification, dynamic pricing,
        // contract/payment readiness or equipment inventory in the current API.
        return fail('This booking action moved to Hosting Marketplace. Use the verified hosting workflow.',409);
      }
      case 'view_social_links':{
        if(!paid)return fail('Professional social links require Premium membership',403);
        const target=body.target_user_id;
        if(!isId(target))return fail('Valid member required',400);
        const [ageCheck,settings,securityCheck,blocks]=await Promise.all([
          admin.from('age_verification_requests').select('status,expires_at').eq('user_id',target).order('created_at',{ascending:false}).limit(1),
          admin.from('creator_production_preferences').select('show_socials_to_premium,socials').eq('user_id',target).maybeSingle(),
          admin.from('account_security').select('banned,suspended').eq('user_id',target).maybeSingle(),
          admin.from('member_blocks').select('blocker_id').or(`and(blocker_id.eq.${uid},blocked_id.eq.${target}),and(blocker_id.eq.${target},blocked_id.eq.${uid})`).limit(1)
        ]);
        if(ageCheck.error||settings.error||securityCheck.error||blocks.error||
          !isAdult(ageCheck.data||[])||securityCheck.data?.banned||securityCheck.data?.suspended||
          blocks.data?.length||!settings.data?.show_socials_to_premium)
          return respond({socials:{}});
        const clean:Record<string,string>={};
        for(const provider of ['onlyfans','fansly','twitter','instagram']){
          const raw=settings.data.socials?.[provider];
          if(typeof raw!=='string'||raw.length>500)continue;
          try{const url=new URL(raw);
            if(url.protocol==='https:'&&!url.username&&!url.password)clean[provider]=url.toString();
          }catch{}
        }
        return respond({socials:clean});
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
