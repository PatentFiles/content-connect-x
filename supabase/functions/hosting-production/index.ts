/**
 * Production staffing and on-location operations.
 * Every resource lookup verifies host, guest, or accepted assignment membership.
 * Private venue details are withheld until agreement, payment and role conditions.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const deny=(error:string,status=400)=>reply({error},status);
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const txt=(v:unknown,n=100)=>typeof v==='string'?v.trim().slice(0,n):'';
const keyAAL=(token:string)=>{try{const x=token.replace(/^Bearer\s+/i,'').split('.')[1];const d=atob(x.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(x.length/4)*4,'='));return JSON.parse(d)?.aal==='aal2';}catch{return false;}};
const nonEmpty=['assistant','coordinator','security','cleaner','crew'];
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return deny('Method not allowed',405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return deny('Backend unavailable',503);
 const bearer=request.headers.get('Authorization')||'';
 const userClient=createClient(url,pub,{global:{headers:{Authorization:bearer}}});
 const {data:{user},error:authError}=await userClient.auth.getUser();
 if(authError||!user)return deny('Unauthorized',401);
 const db=createClient(url,secret),uid=user.id;
 const [age,security,sub]=await Promise.all([
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle()
 ]);
 if(age.error||security.error||sub.error)return deny('Account eligibility unavailable',503);
 const verified=age.data?.[0]?.status==='approved'&&(!age.data[0].expires_at||Date.parse(age.data[0].expires_at)>Date.now());
 if(!verified)return deny('Independent 18+ verification required',403);
 const admin=security.data?.admin===true;
 const paid=admin||['active','trial'].includes(sub.data?.status)&&(!sub.data?.period_end||Date.parse(sub.data.period_end)>Date.now());
 const body=await request.json().catch(()=>null);if(!body||typeof body!=='object')return deny('Invalid JSON',400);
 const action=txt(body.action,65);
 const safety=new Set(['incident_report','incident_my','incident_evidence_token','incident_evidence_register','booking_access_revoke','staff_respond','my_staff_invites','booking_access_respond','cleaning_jobs','cleaning_task','supplies','supply_adjust']);
 if((security.data?.banned||security.data?.suspended)&&!safety.has(action))return deny('Account restricted',403);
 if(!paid&&!safety.has(action))return deny('Active premium membership required',403);
 if(action.startsWith('admin_')&&(!admin||!keyAAL(bearer)))return deny('Administrator MFA required',403);
 const own=async(id:unknown)=>{
  if(!valid(id))return null;
  const {data,error}=await db.from('properties').select('id,owner_id,title,required_insurance,permitted_uses,city,state,country')
   .eq('id',id).eq('owner_id',uid).maybeSingle();
  if(error)throw error;return data;
 };
 const booking=async(id:unknown)=>{
  if(!valid(id))return null;
  const {data,error}=await db.from('property_booking_requests')
   .select('id,property_id,owner_id,requester_id,starts_at,ends_at,status,legal_status,payment_status,operational_status,crew_size,requested_use')
   .eq('id',id).maybeSingle();
  if(error)throw error;return data;
 };
 const access=async(b:any)=>{
  if(!b)return null;
  if([b.owner_id,b.requester_id].includes(uid))return {role:b.owner_id===uid?'host':'guest',status:'active',can_view_entry:true};
  const {data,error}=await db.from('hosting_booking_access')
   .select('role,status,can_view_entry').eq('booking_id',b.id).eq('user_id',uid).maybeSingle();
  if(error)throw error;return data?.status==='active'?data:null;
 };
 const staff=async(propertyId:string,member:string=uid)=>{
  const {data,error}=await db.from('hosting_staff').select('role,status').eq('property_id',propertyId).eq('member_id',member).maybeSingle();
  if(error)throw error;return data;
 };
 const isVerified=async(userId:string)=>{
  const {data,error}=await db.from('age_verification_requests').select('status,expires_at')
   .eq('user_id',userId).order('created_at',{ascending:false}).limit(1);
  if(error)throw error;
  return data?.[0]?.status==='approved'&&(!data[0].expires_at||Date.parse(data[0].expires_at)>Date.now());
 };
 const notify=async(target:string,title:string,bookId:string)=>{
  await db.from('member_notifications').insert({recipient_id:target,kind:'hosting_production',title,details:{booking_id:bookId}});
 };
 const audit=async(what:string,id:string)=>{await db.from('platform_action_audit').insert({actor_id:uid,action:what,target_type:'hosting_production',target_id:id});};
 try{
 switch(action){
 case 'staff_invite':{
  const p=await own(body.property_id);
  if(!p||!valid(body.user_id)||body.user_id===uid||!['cleaner','manager','coordinator','assistant','security'].includes(body.role))return deny('Host and valid staff member required',403);
  if(!await isVerified(body.user_id))return deny('Staff member must be independently verified',403);
  const {data:existing}=await db.from('hosting_staff').select('status').eq('property_id',p.id).eq('member_id',body.user_id).maybeSingle();
  if(existing&&['invited','active'].includes(existing.status))return deny('Staff member is already invited or active',409);
  const {error}=await db.from('hosting_staff').upsert({property_id:p.id,member_id:body.user_id,invited_by:uid,
   role:body.role,status:'invited',accepted_at:null},{onConflict:'property_id,member_id'});
  if(error)throw error;await notify(body.user_id,'Venue staff invitation',p.id);
  return reply({ok:true},201);
 }
 case 'my_staff_invites':{
  const {data,error}=await db.from('hosting_staff').select('property_id,role,status,created_at')
   .eq('member_id',uid).in('status',['invited','active']).limit(100);
  if(error)throw error;return reply({items:data||[]});
 }
 case 'staff_respond':{
  if(!valid(body.property_id)||!['active','declined'].includes(body.status))return deny('Invalid invitation response');
  const {data,error}=await db.from('hosting_staff').update({
   status:body.status,accepted_at:body.status==='active'?new Date().toISOString():null
  }).eq('property_id',body.property_id).eq('member_id',uid).eq('status','invited').select('property_id,status').maybeSingle();
  if(error||!data)return deny('Invitation unavailable',404);
  return reply({item:data});
 }
 case 'staff_list':{
  const property=await own(body.property_id);
  const manager=await staff(String(body.property_id));
  if(!property&&(manager?.status!=='active'||manager.role!=='manager'))return deny('Staff listing unavailable',403);
  const {data,error}=await db.from('hosting_staff').select('member_id,role,status,created_at,accepted_at')
   .eq('property_id',body.property_id).limit(100);
  if(error)throw error;
  return reply({items:data||[]});
 }
 case 'staff_remove':{
  const p=await own(body.property_id);if(!p||!valid(body.user_id))return deny('Owner permission required',403);
  const {data,error}=await db.from('hosting_staff').update({status:'removed'})
   .eq('property_id',p.id).eq('member_id',body.user_id).neq('status','removed').select('member_id').maybeSingle();
  if(error||!data)return deny('Staff member unavailable',404);
  return reply({ok:true});
 }
 case 'turnover_assign':{
  if(!valid(body.turnover_id)||!valid(body.user_id))return deny('Turnover and assignee required');
  const {data:job}=await db.from('property_turnovers').select('id,property_id,created_by,status').eq('id',body.turnover_id).maybeSingle();
  if(!job)return deny('Turnover not found',404);
  const p=await own(job.property_id);
  const manager=await staff(job.property_id);
  if(!p&&(manager?.status!=='active'||manager.role!=='manager'))return deny('Owner or manager required',403);
  const person=await staff(job.property_id,body.user_id);
  if(!person||person.status!=='active'||person.role!=='cleaner')return deny('Cleaner must accept property invitation first',403);
  if(job.status==='completed')return deny('Finished job cannot be reassigned',409);
  const {data,error}=await db.from('property_turnovers').update({
   assigned_to:body.user_id,assigned_by:uid
  }).eq('id',job.id).select('id,assigned_to').single();
  if(error)throw error;await notify(body.user_id,'Assigned a property cleaning job',job.id);
  return reply({item:data});
 }
 case 'cleaning_jobs':{
  if(valid(body.property_id)){
   const p=await own(body.property_id);
   const membership=await staff(body.property_id);
   if(!p&&membership?.status!=='active')return deny('Property staff required',403);
   const {data,error}=await db.from('property_turnovers')
    .select('id,booking_id,property_id,assigned_to,status,due_at,created_at,started_at,completed_at,quality_rating')
    .eq('property_id',body.property_id).order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   const allowed=(data||[]).filter(x=>p||x.assigned_to===uid);
   const ids=allowed.map(x=>x.id);
   const {data:tasks,error:taskError}=ids.length?await db.from('property_turnover_tasks')
    .select('id,turnover_id,label,done,position').in('turnover_id',ids).order('position')
    :{data:[],error:null};
   if(taskError)throw taskError;
   return reply({items:allowed.map(x=>({...x,tasks:(tasks||[]).filter(t=>t.turnover_id===x.id)}))});
  }
  const {data,error}=await db.from('property_turnovers')
   .select('id,booking_id,property_id,assigned_to,status,due_at,created_at,started_at,completed_at,quality_rating')
   .eq('assigned_to',uid).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  const ids=(data||[]).map(x=>x.id);
  const {data:tasks,error:taskError}=ids.length?await db.from('property_turnover_tasks')
   .select('id,turnover_id,label,done,position').in('turnover_id',ids).order('position')
   :{data:[],error:null};
  if(taskError)throw taskError;
  return reply({items:(data||[]).map(x=>({...x,tasks:(tasks||[]).filter(t=>t.turnover_id===x.id)}))});
 }
 case 'cleaning_task':{
  if(!valid(body.task_id)||typeof body.done!=='boolean')return deny('Valid task and status required');
  const {data:task}=await db.from('property_turnover_tasks').select('id,turnover_id').eq('id',body.task_id).maybeSingle();
  if(!task)return deny('Task unavailable',404);
  const {data:job}=await db.from('property_turnovers').select('id,property_id,assigned_to,status,started_at').eq('id',task.turnover_id).maybeSingle();
  if(!job)return deny('Cleaning job unavailable',404);
  const cleaner=await staff(job.property_id);
  if(!await own(job.property_id)&&!(job.assigned_to===uid&&cleaner?.status==='active'&&cleaner.role==='cleaner'))return deny('Accepted cleaner assignment or owner permission required',403);
  if(job.status==='completed'||job.status==='cancelled')return deny('Job is already closed',409);
  const {error}=await db.from('property_turnover_tasks')
   .update({done:body.done,done_at:body.done?new Date().toISOString():null}).eq('id',task.id);
  if(error)throw error;
  const {data:tasks}=await db.from('property_turnover_tasks').select('id,done').eq('turnover_id',job.id);
  const done=Boolean(tasks?.length&&tasks.every(t=>t.done));
  await db.from('property_turnovers').update({
   status:done?'completed':'in_progress',started_at:job.started_at||new Date().toISOString(),
   completed_at:done?new Date().toISOString():null
  }).eq('id',job.id);
  return reply({ok:true,completed:done});
 }
 case 'cleaner_performance':{
  const p=await own(body.property_id);
  if(!p)return deny('Owner required',403);
  const {data,error}=await db.from('property_turnovers').select('assigned_to,status,started_at,completed_at,quality_rating')
   .eq('property_id',p.id).not('assigned_to','is',null).limit(1000);
  if(error)throw error;
  const results=new Map<string,{jobs:number,done:number,hours:number,rated:number,ratings:number}>();
  for(const r of data||[]){
   const v=results.get(r.assigned_to)||{jobs:0,done:0,hours:0,rated:0,ratings:0};
   v.jobs++;
   if(r.status==='completed'){
    v.done++;
    if(r.started_at&&r.completed_at)v.hours+=Math.max(0,(Date.parse(r.completed_at)-Date.parse(r.started_at))/3600000);
   }
   if(r.quality_rating){v.rated++;v.ratings+=r.quality_rating;}
   results.set(r.assigned_to,v);
  }
  return reply({items:[...results.entries()].map(([user_id,v])=>({
   user_id,assigned:v.jobs,completed:v.done,average_hours:v.done?Math.round(v.hours*10/v.done)/10:null,
   average_quality:v.rated?Math.round(v.ratings*10/v.rated)/10:null
  }))});
 }
 case 'cleaning_rate':{
  if(!valid(body.turnover_id)||!Number.isInteger(body.rating)||body.rating<1||body.rating>5)return deny('Valid job and rating required');
  const {data:job}=await db.from('property_turnovers').select('id,property_id,status').eq('id',body.turnover_id).maybeSingle();
  if(!job||!await own(job.property_id)||job.status!=='completed')return deny('Owner can only rate completed job',403);
  const {data,error}=await db.from('property_turnovers').update({
   quality_rating:body.rating,owner_feedback:txt(body.feedback,1000)
  }).eq('id',job.id).select('id,quality_rating').single();
  if(error)throw error;return reply({item:data});
 }
 case 'supply_upsert':{
  const p=await own(body.property_id);if(!p)return deny('Only host can manage inventory',403);
  const label=txt(body.label,140),unit=txt(body.unit||'units',24);
  const quantity=Number(body.quantity),threshold=Number(body.reorder_at);
  if(label.length<2||!Number.isFinite(quantity)||quantity<0||!Number.isFinite(threshold)||threshold<0||quantity>1000000||threshold>1000000)
   return deny('Valid supplies and nonnegative stock required');
  const values={property_id:p.id,label,unit,quantity,reorder_at:threshold,notes:txt(body.notes,500),updated_at:new Date().toISOString()};
  if(body.id&&!valid(body.id))return deny('Invalid supply');
  const q=body.id?db.from('hosting_supplies').update(values).eq('id',body.id).eq('property_id',p.id):
   db.from('hosting_supplies').insert(values);
  const {data,error}=await q.select('id,label,quantity,reorder_at').single();if(error)throw error;
  return reply({item:data});
 }
 case 'supplies':{
  const p=await own(body.property_id),role=valid(body.property_id)?await staff(body.property_id):null;
  if(!p&&role?.status!=='active')return deny('Host or staff required',403);
  const {data,error}=await db.from('hosting_supplies').select('id,label,unit,quantity,reorder_at,notes,updated_at')
   .eq('property_id',body.property_id).order('label').limit(250);
  if(error)throw error;
  return reply({items:data||[],low_stock:(data||[]).filter(v=>Number(v.quantity)<=Number(v.reorder_at))});
 }
 case 'supply_adjust':{
  if(!valid(body.id)||typeof body.delta!=='number'||!Number.isFinite(body.delta)||body.delta===0||Math.abs(body.delta)>1000000)return deny('Valid stock adjustment required');
  const {data,error}=await db.rpc('ccx_hosting_adjust_supply',{
   p_actor:uid,p_supply:body.id,p_delta:body.delta,p_reason:txt(body.reason,200)
  });
  if(error)return deny(error.message.includes('authorized')?'Insufficient permissions':'Stock adjustment unavailable',409);
  return reply({quantity:data});
 }
 case 'booking_access_invite':{
  const b=await booking(body.booking_id);
  if(!b||![b.owner_id,b.requester_id].includes(uid)||b.status!=='accepted'||!valid(body.user_id)||
    [b.owner_id,b.requester_id].includes(body.user_id)||!nonEmpty.includes(body.role))return deny('Accepted booking and valid recipient required',403);
  if(!await isVerified(body.user_id))return deny('Recipient must be independently verified',403);
  const {data:existing}=await db.from('hosting_booking_access')
   .select('status').eq('booking_id',b.id).eq('user_id',body.user_id).maybeSingle();
  if(existing&&['invited','active'].includes(existing.status))return deny('Already invited',409);
  const {error}=await db.from('hosting_booking_access').upsert({
   booking_id:b.id,user_id:body.user_id,invited_by:uid,role:body.role,
   status:'invited',can_view_entry:false,accepted_at:null
  },{onConflict:'booking_id,user_id'});
  if(error)throw error;
  await notify(body.user_id,'Production crew invitation',b.id);
  return reply({ok:true},201);
 }
 case 'booking_access_respond':{
  if(!valid(body.booking_id)||!['active','declined'].includes(body.status))return deny('Invalid invitation');
  const {data,error}=await db.from('hosting_booking_access').update({
   status:body.status,accepted_at:body.status==='active'?new Date().toISOString():null
  }).eq('booking_id',body.booking_id).eq('user_id',uid).eq('status','invited')
   .select('booking_id,role,status').maybeSingle();
  if(error||!data)return deny('Invitation unavailable',404);
  return reply({item:data});
 }
 case 'booking_access_revoke':{
  const b=await booking(body.booking_id);
  if(!b||![b.owner_id,b.requester_id].includes(uid)||!valid(body.user_id))return deny('Booking participant required',403);
  const {data,error}=await db.from('hosting_booking_access').update({status:'revoked',can_view_entry:false})
   .eq('booking_id',b.id).eq('user_id',body.user_id).select('user_id').maybeSingle();
  if(error||!data)return deny('Access unavailable',404);
  const {data:conversation}=await db.from('hosting_booking_conversations')
   .select('conversation_id').eq('booking_id',b.id).maybeSingle();
  if(conversation)await db.from('conversation_members').delete().eq('conversation_id',conversation.conversation_id).eq('user_id',body.user_id);
  return reply({ok:true});
 }
 case 'booking_access_grant_entry':{
  const b=await booking(body.booking_id);
  if(!b||b.owner_id!==uid||!valid(body.user_id)||typeof body.allow!=='boolean')
   return deny('Only the host can grant entry access',403);
  if(b.status!=='accepted'||b.legal_status!=='signed'||!['captured','partially_refunded'].includes(b.payment_status))
   return deny('Entry access requires signed and funded accepted rental',409);
  const {data,error}=await db.from('hosting_booking_access').update({can_view_entry:body.allow})
   .eq('booking_id',b.id).eq('user_id',body.user_id).eq('status','active')
   .select('user_id,role,can_view_entry').maybeSingle();
  if(error||!data)return deny('Active crew member not found',404);
  return reply({item:data});
 }
 case 'booking_access_list':{
  const b=await booking(body.booking_id);
  if(!b)return deny('Booking not found',404);
  const membership=await access(b);
  if(!membership)return deny('Booking permission required',403);
  const {data,error}=await db.from('hosting_booking_access')
   .select('user_id,role,status,can_view_entry,accepted_at').eq('booking_id',b.id).limit(100);
  if(error)throw error;
  return reply({items:[b.owner_id,b.requester_id].includes(uid)?data||[]:(data||[]).filter(v=>v.user_id===uid)});
 }
 case 'booking_conversation_open':{
  const b=await booking(body.booking_id);
  if(!b||b.status!=='accepted')return deny('Accepted booking required for private team chat',409);
  const me=await access(b);
  if(!me)return deny('Booking access denied',403);
  const {data:existing}=await db.from('hosting_booking_conversations')
   .select('conversation_id').eq('booking_id',b.id).maybeSingle();
  if(existing)return reply({conversation_id:existing.conversation_id});
  if(uid!==b.owner_id&&uid!==b.requester_id)return deny('Host or guest must create the conversation',403);
  const {data:conversation,error:cError}=await db.from('conversations')
   .insert({title:'Private location production',kind:'group',created_by:uid}).select('id').single();
  if(cError)throw cError;
  const {error:markError}=await db.from('hosting_booking_conversations')
   .insert({booking_id:b.id,conversation_id:conversation.id,created_by:uid});
  if(markError)return deny('Conversation creation conflict; refresh',409);
  const {data:additional}=await db.from('hosting_booking_access').select('user_id')
   .eq('booking_id',b.id).eq('status','active');
  const all=[...new Set([b.owner_id,b.requester_id,...(additional||[]).map(v=>v.user_id)])];
  const {error:membersError}=await db.from('conversation_members')
   .insert(all.map(user_id=>({conversation_id:conversation.id,user_id})));
  if(membersError)throw membersError;
  await audit('hosting_booking_chat_created',b.id);
  return reply({conversation_id:conversation.id});
 }
 case 'booking_planning_packet':{
  const b=await booking(body.booking_id);
  if(!b)return deny('Booking not found',404);
  const role=await access(b);
  if(!role)return deny('Booking membership required',403);
  const [property,insurance,crew,addons,agreement]=await Promise.all([
   db.from('properties').select('id,title,city,state,country,capacity,permitted_uses,rules,required_insurance')
    .eq('id',b.property_id).maybeSingle(),
   db.from('hosting_booking_insurance').select('status,expiry_date').eq('booking_id',b.id).maybeSingle(),
   db.from('hosting_booking_access').select('user_id,role,status').eq('booking_id',b.id).eq('status','active'),
   db.from('hosting_booking_addons').select('addon_id,quantity').eq('booking_id',b.id),
   db.from('booking_agreements').select('status,completed_at').eq('booking_id',b.id).maybeSingle()
  ]);
  if(property.error||insurance.error||crew.error||addons.error||agreement.error)throw Error('Private planning data unavailable');
  const authorizedAddress=b.status==='accepted'&&b.legal_status==='signed'&&
   ['captured','partially_refunded'].includes(b.payment_status)&&role.can_view_entry;
  const {data:arrival}=authorizedAddress?await db.from('property_private')
    .select('exact_address,entry_instructions').eq('property_id',b.property_id).maybeSingle():{data:null};
  const allowRoster=[b.owner_id,b.requester_id].includes(uid)||role.role==='coordinator';
  return reply({booking_id:b.id,property:property.data,
   starts_at:b.starts_at,ends_at:b.ends_at,crew_size:b.crew_size,
   requested_use:b.requested_use,agreement_status:agreement.data?.status||'unavailable',
   payment_status:b.payment_status,insurance_status:insurance.data?.status||'not_submitted',
   addons:addons.data||[],participants:allowRoster?crew.data||[]:[],
   arrival:arrival||null,
   notice:arrival?'Private access details provided to an authorized attendee.':'Entry details stay hidden until all requirements are met.'});
 }
 case 'insurance_upload_token':{
  const b=await booking(body.booking_id);
  if(!b||b.requester_id!==uid)return deny('Only guest can submit rental insurance',403);
  const mime=txt(body.mime_type,55),ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];
  if(!ext)return deny('PDF or image required');
  const path=uid+'/'+b.property_id+'/booking-insurance/'+b.id+'/'+crypto.randomUUID()+'.'+ext;
  const {data,error}=await db.storage.from('hosting-compliance').createSignedUploadUrl(path);
  if(error)throw error;
  return reply({path,token:data.token});
 }
 case 'insurance_submit':{
  const b=await booking(body.booking_id);
  if(!b||b.requester_id!==uid||typeof body.path!=='string'||
   !body.path.startsWith(uid+'/'+b.property_id+'/booking-insurance/'+b.id+'/')||body.path.includes('..'))
   return deny('Private guest insurance upload required',403);
  const {data:info,error:storageError}=await db.storage.from('hosting-compliance').info(body.path);
  if(storageError||!info)return deny('Evidence file missing',404);
  const expires=txt(body.expiry_date,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||Date.parse(expires)<=Date.now())
   return deny('Insurance expiration must be in the future');
  const {data,error}=await db.from('hosting_booking_insurance').upsert({
   booking_id:b.id,submitted_by:uid,document_path:body.path,policy_holder:txt(body.policy_holder,160),
   expiry_date:expires,status:'pending',reviewed_by:null,reviewed_at:null
  },{onConflict:'booking_id'}).select('booking_id,status').single();
  if(error)throw error;await notify(b.owner_id,'Booking insurance submitted',b.id);
  return reply({item:data},201);
 }
 case 'insurance_review':{
  const b=await booking(body.booking_id);
  if(!b||b.owner_id!==uid||!['approved','rejected'].includes(body.status)||body.review_confirmed!==true)
   return deny('Independent host review of insurance required',403);
  const {data:insurance}=await db.from('hosting_booking_insurance')
   .select('document_path,status').eq('booking_id',b.id).maybeSingle();
  if(!insurance||insurance.status!=='pending')return deny('No pending insurance',409);
  const {data,error}=await db.from('hosting_booking_insurance').update({
   status:body.status,reviewed_by:uid,reviewed_at:new Date().toISOString()
  }).eq('booking_id',b.id).eq('status','pending').select('status').maybeSingle();
  if(error||!data)return deny('Insurance status conflict',409);
  await notify(b.requester_id,'Booking insurance review '+body.status,b.id);
  return reply({item:data});
 }
 case 'booking_check':{
  const b=await booking(body.booking_id),event=txt(body.event_type,30);
  if(!b||!['check_in','check_out','host_confirm','no_show'].includes(event))return deny('Valid booking and event type required');
  const role=await access(b);
  if(!role)return deny('Booking access required',403);
  const {data:prop}=await db.from('properties').select('required_insurance,hourly_rate,overtime_bps')
   .eq('id',b.property_id).maybeSingle();
  if(b.legal_status!=='signed'||!['captured','partially_refunded'].includes(b.payment_status)||b.status!=='accepted')
   return deny('Paid, signed and accepted booking required',409);
  if(event==='check_in'){
   if(role.role!=='guest'&&role.role!=='host'&&role.role!=='coordinator')return deny('Only authorized attendees can check in',403);
   if(b.operational_status!=='ready')return deny('Check-in is not yet available',409);
   if(prop?.required_insurance){
    const {data:insurance}=await db.from('hosting_booking_insurance').select('status,expiry_date')
      .eq('booking_id',b.id).maybeSingle();
    if(insurance?.status!=='approved'||insurance.expiry_date&&Date.parse(insurance.expiry_date)<Date.now())
     return deny('Verified current insurance required to check in',409);
   }
   const {error}=await db.from('hosting_check_events').insert({
    booking_id:b.id,actor_id:uid,event_type:event,note:txt(body.note,1000)
   });
   if(error)return deny('Check-in already recorded',409);
   const {error:updateError}=await db.from('property_booking_requests').update({operational_status:'checked_in'})
    .eq('id',b.id).eq('operational_status','ready');
   if(updateError)throw updateError;
   return reply({ok:true,status:'checked_in'});
  }
  if(event==='check_out'){
   if(!['guest','host','coordinator'].includes(role.role)||b.operational_status!=='checked_in')
    return deny('An authorized attendee must check in first',409);
   const {error}=await db.from('hosting_check_events').insert({
    booking_id:b.id,actor_id:uid,event_type:event,note:txt(body.note,1000)
   });
   if(error)return deny('Check-out already recorded',409);
   await db.from('property_booking_requests').update({operational_status:'checked_out'})
    .eq('id',b.id).eq('operational_status','checked_in');
   const late=Math.max(0,Math.ceil((Date.now()-Date.parse(b.ends_at))/60000));
   if(late>0){
    const quote=Math.ceil(late/15)*15;
    const cents=Math.round(Number(prop?.hourly_rate||0)*100*Number(prop?.overtime_bps||15000)/10000*quote/60);
    await db.from('hosting_overtime_quotes').upsert({
     booking_id:b.id,minutes_late:Math.min(late,4320),proposed_cents:cents,status:'unbilled'
    },{onConflict:'booking_id'});
   }
   await notify(b.owner_id===uid?b.requester_id:b.owner_id,'Production checkout recorded',b.id);
   return reply({ok:true,status:'checked_out',overtime_minutes:late,
    note:'Any overtime is informational until accepted and paid through an approved processor.'});
  }
  if(event==='no_show'){
   if(role.role!=='host'||Date.now()<Date.parse(b.starts_at)+30*60000)
    return deny('Host may report a no-show 30 minutes after start',403);
   const {error}=await db.from('hosting_check_events').insert({
    booking_id:b.id,actor_id:uid,event_type:event,note:txt(body.note,1000)
   });
   if(error)return deny('Already reported',409);
   await db.from('property_booking_requests').update({operational_status:'no_show'}).eq('id',b.id);
   await notify(b.requester_id,'No-show was reported; review or dispute in booking',b.id);
   return reply({ok:true,note:'No-show recorded for dispute review; no automatic penalty is applied.'});
  }
  if(role.role!=='host')return deny('Host confirmation required',403);
  const {error}=await db.from('hosting_check_events').insert({
   booking_id:b.id,actor_id:uid,event_type:event,note:txt(body.note,1000)
  });
  if(error)return deny('Host confirmation already recorded',409);
  return reply({ok:true});
 }
 case 'incident_report':{
  const b=await booking(body.booking_id);
  const role=await access(b);
  const category=txt(body.category,30),description=txt(body.description,3000);
  if(!b||!role||!['damage','equipment','safety','conduct','access','other'].includes(category)||description.length<10)
   return deny('Booking participant and substantial incident details required',403);
  const {data,error}=await db.from('hosting_incidents').insert({
   booking_id:b.id,reporter_id:uid,category,description
  }).select('id,status').single();
  if(error)throw error;
  await db.from('property_booking_requests').update({operational_status:'incident'}).eq('id',b.id)
   .in('operational_status',['ready','checked_in','checked_out','no_show']);
  await db.from('booking_payouts').update({status:'held'}).eq('booking_id',b.id).in('status',['pending','eligible']);
  await audit('hosting_incident_reported',data.id);
  return reply({item:data,note:'Incident filed confidentially. No automatic charges or penalties.'},201);
 }
 case 'incident_my':{
  if(!valid(body.booking_id))return deny('Booking ID required');
  const b=await booking(body.booking_id),role=await access(b);
  if(!b||!role)return deny('Not a booking participant',403);
  const {data,error}=await db.from('hosting_incidents')
   .select('id,reporter_id,category,description,status,created_at')
   .eq('booking_id',b.id).order('created_at',{ascending:false}).limit(40);
  if(error)throw error;
  return reply({items:data||[]});
 }
 case 'incident_evidence_token':{
  if(!valid(body.incident_id))return deny('Incident ID required');
  const {data:incident}=await db.from('hosting_incidents').select('id,booking_id,reporter_id')
   .eq('id',body.incident_id).maybeSingle();
  if(!incident||incident.reporter_id!==uid)return deny('Only reporter may upload evidence',403);
  const mime=txt(body.mime_type,50),ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];
  if(!ext)return deny('PDF or supported image required');
  const path=uid+'/'+incident.booking_id+'/'+incident.id+'/'+crypto.randomUUID()+'.'+ext;
  const {data,error}=await db.storage.from('hosting-incident-evidence').createSignedUploadUrl(path);
  if(error)throw error;
  return reply({path,token:data.token});
 }
 case 'incident_evidence_register':{
  if(!valid(body.incident_id)||typeof body.path!=='string')return deny('Invalid evidence');
  const {data:incident}=await db.from('hosting_incidents').select('id,booking_id,reporter_id,status')
   .eq('id',body.incident_id).maybeSingle();
  if(!incident||incident.reporter_id!==uid||incident.status==='closed')return deny('Incident unavailable',403);
  const prefix=uid+'/'+incident.booking_id+'/'+incident.id+'/';
  if(!body.path.startsWith(prefix)||body.path.includes('..'))return deny('Invalid evidence path',403);
  const {data:info}=await db.storage.from('hosting-incident-evidence').info(body.path);
  if(!info)return deny('Evidence file not found',404);
  const {error}=await db.from('hosting_incidents').update({evidence_path:body.path}).eq('id',incident.id);
  if(error)throw error;
  return reply({ok:true});
 }
 case 'suitability_save':{
  const prop=await own(body.property_id);
  if(!prop)return deny('Owner required',403);
  const privacy=txt(body.privacy_level,30);
  if(!['standard','private_entry','closed_set'].includes(privacy)||!Number.isInteger(body.parking_spaces)
   ||body.parking_spaces<0||body.parking_spaces>1000||!Number.isInteger(body.separate_dressing_rooms)
   ||body.separate_dressing_rooms<0||body.separate_dressing_rooms>100)return deny('Invalid suitability fields');
  const {data,error}=await db.from('hosting_suitability').upsert({
   property_id:prop.id,adult_production_permitted:body.adult_production_permitted===true&&prop.permitted_uses.includes('adult_production'),
   privacy_level:privacy,soundproof_confirmed:body.soundproof_confirmed===true,
   parking_spaces:body.parking_spaces,separate_dressing_rooms:body.separate_dressing_rooms,
   noise_restrictions:txt(body.noise_restrictions,600),
   permits_verified:false,reviewer_id:null,reviewed_at:null,updated_at:new Date().toISOString()
  },{onConflict:'property_id'}).select('property_id,permits_verified').single();
  if(error)throw error;
  return reply({item:data,note:'Host-declared suitability; professional verification requires independent review.'});
 }
 case 'admin_suitability_queue':{
  if(!admin||!keyAAL(bearer))return deny('MFA administrator required',403);
  const {data,error}=await db.from('hosting_suitability')
   .select('property_id,adult_production_permitted,privacy_level,soundproof_confirmed,parking_spaces,separate_dressing_rooms,noise_restrictions,permits_verified')
   .eq('permits_verified',false).limit(80);
  if(error)throw error;return reply({items:data||[]});
 }
 case 'admin_suitability_review':{
  if(!admin||!keyAAL(bearer)||!valid(body.property_id)||body.review_confirmed!==true||typeof body.approved!=='boolean')
   return deny('Independent MFA review required',403);
  const {data:prop}=await db.from('properties').select('id,owner_id').eq('id',body.property_id).maybeSingle();
  if(!prop||prop.owner_id===uid)return deny('Self-approval prohibited',403);
  const {data,error}=await db.from('hosting_suitability').update({
   permits_verified:body.approved,reviewer_id:body.approved?uid:null,
   reviewed_at:body.approved?new Date().toISOString():null
  }).eq('property_id',prop.id).select('property_id,permits_verified').maybeSingle();
  if(error||!data)return deny('Venue badges not found',404);
  await audit('hosting_venue_suitability_reviewed',prop.id);
  return reply({item:data});
 }
 case 'suitability_get':{
  if(!valid(body.property_id))return deny('Valid listing required');
  const {data:prop}=await db.from('properties').select('id,status,owner_id').eq('id',body.property_id).maybeSingle();
  if(!prop||prop.status!=='active'&&prop.owner_id!==uid)return deny('Listing unavailable',404);
  const {data,error}=await db.from('hosting_suitability')
   .select('adult_production_permitted,privacy_level,soundproof_confirmed,parking_spaces,separate_dressing_rooms,noise_restrictions,permits_verified')
   .eq('property_id',prop.id).maybeSingle();
  if(error)throw error;return reply({item:data||null});
 }
 default:return deny('Unknown production operation',404);
 }
 }catch(error){console.error('hosting-production',action,error);return deny('Production workflow failed',500);}
});
