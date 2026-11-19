/** Private, server-authorized collaboration archive and production plans.
 * Backend admission and subscription are checked on every request, not in UI state.
 * None of the document/contract/consent records are exposed to nonmembers.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','Cache-Control':'no-store'}});
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const safe=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
const terminal=new Set(['completed','cancelled','archived','closed']);
const fail=(message:string,status=400)=>send({error:message},status);
const origin=Deno.env.get('SUPABASE_URL'),publicKey=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!origin||!publicKey||!secret)throw Error('Server configuration missing');
const admin=createClient(origin,secret,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return fail('Method not allowed',405);
 if(Number(req.headers.get('content-length')||0)>32768)return fail('Request too large',413);
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer '))return fail('Sign in required',401);
 const userResult=await admin.auth.getUser(bearer.slice(7));
 const uid=userResult.data?.user?.id;
 if(userResult.error||!uid)return fail('Sign in required',401);
 const payload=await req.json().catch(()=>null);
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return fail('Invalid request');
 const action=safe(payload.action,50);
 const [security,admission,subscription]=await Promise.all([
  admin.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  admin.from('member_admissions').select('admitted_at').eq('user_id',uid).limit(1),
  admin.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle()
 ]);
 if(security.error||admission.error||subscription.error)return fail('Account status unavailable',503);
 if(security.data?.banned||security.data?.suspended||!admission.data?.some(x=>!!x.admitted_at))return fail('Account unavailable',403);
 const paid=security.data?.admin===true||!!(subscription.data&&['active','trial'].includes(subscription.data.status)&&(!subscription.data.period_end||Date.parse(subscription.data.period_end)>Date.now()));
 const featureActions=new Set(['list','detail','save_plan','hide','unhide','eligibility','properties']);
 if(!featureActions.has(action))return fail('Unsupported action');
 // Past signed records and consent must remain visible even after a subscription lapses.
 // Only active planning, invitations and professional discovery require Premium.
 if(!paid&&!['list','detail','hide','unhide'].includes(action))return fail('Premium membership required for new collaboration planning',402);
 const member=async cid=>{
  const {data,error}=await admin.from('collaboration_members').select('user_id').eq('collaboration_id',cid).eq('user_id',uid).maybeSingle();
  if(error)throw error;return !!data;
 };
 const invitationEligibility=async target=>{
  if(!id(target)||target===uid)return {eligible:false,reason:'Choose another verified member'};
  const [friend,membership,conversations,blocked,cooldown]=await Promise.all([
   admin.from('member_connection_requests').select('id').eq('status','accepted').or('and(requester_id.eq.'+uid+',recipient_id.eq.'+target+'),and(requester_id.eq.'+target+',recipient_id.eq.'+uid+')').limit(1),
   admin.from('account_security').select('banned,suspended').eq('user_id',target).maybeSingle(),
   admin.from('conversation_members').select('conversation_id').eq('user_id',uid).limit(100),
   admin.from('member_blocks').select('blocker_id').or('and(blocker_id.eq.'+uid+',blocked_id.eq.'+target+'),and(blocker_id.eq.'+target+',blocked_id.eq.'+uid+')').limit(1),
   admin.from('ccx_collaboration_invitation_cooldowns').select('until_at').eq('actor_id',uid).maybeSingle()
  ]);
  if([friend,membership,conversations,blocked,cooldown].some(x=>x.error))throw Error('Invitation status unavailable');
  const until=cooldown.data?.until_at;
  if(until&&Date.parse(until)>Date.now())return {eligible:false,reason:'Invitations paused after repeated declines',cooldown_until:until};
  if(!membership.data||membership.data.banned||membership.data.suspended||blocked.data?.length)return {eligible:false,reason:'Member unavailable'};
  if(friend.data?.length)return {eligible:true,reason:'Accepted connection'};
  const ids=(conversations.data||[]).map(row=>row.conversation_id);
  if(ids.length){
   const {data:others,error:e1}=await admin.from('conversation_members').select('conversation_id').eq('user_id',target).in('conversation_id',ids).limit(100);
   if(e1)throw e1;
   const both=(others||[]).map(row=>row.conversation_id);
   if(both.length){
    const {data:direct,error:e2}=await admin.from('conversations').select('id').in('id',both).eq('kind','direct').limit(100);
    if(e2)throw e2;
    for(const c of direct||[]){
     const {data:messages,error:e3}=await admin.from('messages').select('sender_id,body').eq('conversation_id',c.id).is('deleted_at',null).in('sender_id',[uid,target]).order('created_at',{ascending:false}).limit(200);
     if(e3)throw e3;
     if(messages?.some(m=>m.sender_id===uid&&m.body?.trim().length>=2)&&messages?.some(m=>m.sender_id===target&&m.body?.trim().length>=2))
      return {eligible:true,reason:'Two-way conversation'};
    }
   }
  }
  return {eligible:false,reason:'Become friends or exchange messages both ways first'};
 };
 try{
  if(action==='eligibility')return send(await invitationEligibility(payload.target_user_id));
  if(action==='properties'){
   const {data,error}=await admin.from('properties').select('id,title,city,state,country,timezone').eq('status','active').not('approved_at','is',null).order('created_at',{ascending:false}).limit(75);
   if(error)throw error;return send({items:data||[]});
  }
  if(action==='list'){
   const {data:links,error:e}=await admin.from('collaboration_members').select('collaboration_id').eq('user_id',uid).limit(300);
   if(e)throw e;
   const ids=(links||[]).map(x=>x.collaboration_id);
   if(!ids.length)return send({items:[],hidden:[]});
   const [c,h,plans]=await Promise.all([
    admin.from('collaborations').select('id,title,description,status,creator_id,created_at,requires_work_clearance').in('id',ids).order('created_at',{ascending:false}),
    admin.from('ccx_collaboration_hidden').select('collaboration_id').eq('user_id',uid),
    admin.from('ccx_collaboration_plans').select('collaboration_id,starts_at,city,venue_label,property_id,version').in('collaboration_id',ids)
   ]);
   if(c.error||h.error||plans.error)throw Error('Collaboration history unavailable');
   const planMap=new Map((plans.data||[]).map(x=>[x.collaboration_id,x]));
   return send({items:(c.data||[]).map(x=>({...x,plan:planMap.get(x.id)||null})),hidden:(h.data||[]).map(x=>x.collaboration_id)});
  }
  const cid=payload.collaboration_id;
  if(!id(cid)||!await member(cid))return fail('Collaboration unavailable',403);
  if(action==='hide'||action==='unhide'){
   if(action==='hide'){
    const {error}=await admin.from('ccx_collaboration_hidden').upsert({user_id:uid,collaboration_id:cid},{onConflict:'user_id,collaboration_id'});
    if(error)throw error;
   }else{
    const {error}=await admin.from('ccx_collaboration_hidden').delete().eq('user_id',uid).eq('collaboration_id',cid);
    if(error)throw error;
   }
   await admin.from('platform_action_audit').insert({actor_id:uid,action:action==='hide'?'collaboration_hidden':'collaboration_restored',target_type:'collaboration',target_id:cid});
   return send({ok:true});
  }
  const {data:collab,error:ce}=await admin.from('collaborations').select('id,title,description,status,creator_id,created_at,requires_work_clearance').eq('id',cid).single();
  if(ce||!collab)return fail('Collaboration unavailable',404);
  if(action==='save_plan'){
   if(collab.creator_id!==uid||terminal.has(collab.status))return fail('Only an active collaboration owner may edit its plan',403);
   const [signed,prior,consentRows]=await Promise.all([
    admin.from('contracts').select('id,status,locked_at').eq('collaboration_id',cid).limit(100),
    admin.from('ccx_collaboration_plans').select('version').eq('collaboration_id',cid).maybeSingle(),
    admin.from('collaboration_consents').select('user_id').eq('collaboration_id',cid).is('revoked_at',null).limit(1)
   ]);
   if(signed.error||prior.error||consentRows.error)throw Error('Plan status unavailable');
   if(signed.data?.some(x=>x.locked_at||['signed','executed','locked','completed'].includes(x.status)))return fail('Signed agreements cannot be overwritten. Create an amendment with renewed consent.',409);
   if(consentRows.data?.length)return fail('Existing participant consent must be re-confirmed before changing the production plan.',409);
   const starts=safe(payload.starts_at,40),ends=safe(payload.ends_at,40);
   const timeZone=safe(payload.timezone,80)||'UTC';
   try{new Intl.DateTimeFormat('en-US',{timeZone});}catch{return fail('Choose a valid production time zone');}
   if(Boolean(starts)!==Boolean(ends)||starts&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(starts)||ends&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ends))return fail('Start and end times must be complete UTC instants');
   if(starts&&!Number.isFinite(Date.parse(starts))||ends&&!Number.isFinite(Date.parse(ends))||starts&&ends&&Date.parse(ends)<=Date.parse(starts))return fail('Check the shoot start and end times');
   const activities=Array.isArray(payload.activities)?payload.activities.filter(x=>typeof x==='string'&&x.trim().length>0).map(x=>x.trim().slice(0,100)).slice(0,60):[];
   const venue=safe(payload.venue_label,240),city=safe(payload.city,160),propertyId=payload.property_id||null;
   if(propertyId){
    if(!id(propertyId))return fail('Invalid property selection');
    const {data:property,error:e}=await admin.from('properties').select('id,status,approved_at,timezone').eq('id',propertyId).maybeSingle();
    if(e||!property||property.status!=='active'||!property.approved_at)return fail('Property is not an approved active listing',403);
    if(property.timezone&&property.timezone!==timeZone)return fail('Use the selected property’s production time zone',409);
   }
   const data={collaboration_id:cid,starts_at:starts||null,ends_at:ends||null,timezone:timeZone,city,venue_label:venue,property_id:propertyId,
    scope_of_work:safe(payload.scope_of_work,6000),agreed_activities:activities,deliverables:safe(payload.deliverables,6000),usage_rights:safe(payload.usage_rights,6000),
    version:(prior.data?.version||0)+1,updated_by:uid,updated_at:new Date().toISOString()};
   const out=prior.data
    ?await admin.from('ccx_collaboration_plans').update(data).eq('collaboration_id',cid).eq('version',prior.data.version).select('version').maybeSingle()
    :await admin.from('ccx_collaboration_plans').insert(data).select('version').single();
   if(out.error||!out.data)return fail('Plan changed; refresh and retry',409);
   await admin.from('platform_action_audit').insert({actor_id:uid,action:'collaboration_plan_version',target_type:'collaboration',target_id:cid,metadata:{version:out.data.version}});
   return send({ok:true,version:out.data.version});
  }
  const [members,plan,history,contracts,consents,invites]=await Promise.all([
   admin.from('collaboration_members').select('user_id,membership_role').eq('collaboration_id',cid),
   admin.from('ccx_collaboration_plans').select('starts_at,ends_at,timezone,city,venue_label,property_id,scope_of_work,agreed_activities,deliverables,usage_rights,version,updated_at').eq('collaboration_id',cid).maybeSingle(),
   admin.from('ccx_collaboration_plan_history').select('version,actor_id,recorded_at,snapshot').eq('collaboration_id',cid).order('version',{ascending:false}).limit(40),
   admin.from('contracts').select('id,title,status,content,locked_at,created_at').eq('collaboration_id',cid).order('created_at',{ascending:false}).limit(40),
   admin.from('collaboration_consents').select('user_id,participation_consent,recording_consent,distribution_consent,download_consent,recorded_at,revoked_at').eq('collaboration_id',cid),
   admin.from('collaboration_invitations').select('id,invitee_id,status,created_at,responded_at').eq('collaboration_id',cid).limit(100)
  ]);
  if([members,plan,history,contracts,consents,invites].some(r=>r.error))throw Error('Collaboration details unavailable');
  const ids=(members.data||[]).map(x=>x.user_id);
  const names=ids.length?await admin.from('member_profiles').select('id,display_name,role_type,city,country').in('id',ids):{data:[],error:null};
  if(names.error)throw names.error;
  const profileMap=new Map((names.data||[]).map(x=>[x.id,x]));
  const signatures=(contracts.data||[]).length?await admin.from('contract_signatures').select('contract_id,signer_id,accepted_at,signed_content_hash').in('contract_id',(contracts.data||[]).map(x=>x.id)):{data:[],error:null};
  if(signatures.error)throw signatures.error;
  await admin.from('platform_action_audit').insert({actor_id:uid,action:'collaboration_detail_read',target_type:'collaboration',target_id:cid});
  return send({collaboration:collab,plan:plan.data||null,history:history.data||[],
    members:(members.data||[]).map(x=>({...x,profile:profileMap.get(x.user_id)||null})),
    contracts:(contracts.data||[]).map(x=>({...x,signatures:(signatures.data||[]).filter(s=>s.contract_id===x.id)})),
    consents:consents.data||[],invitations:collab.creator_id===uid?invites.data||[]:[]});
 }catch(e){
  console.error('collaboration workspace error',e instanceof Error?e.name:'unknown');
  return fail('The collaboration workspace is temporarily unavailable',503);
 }
});
