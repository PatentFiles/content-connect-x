/**
 * Content Connect X: Hosting operations for verified hosts and booking parties.
 * This endpoint never collects, refunds or pays out money without provider evidence.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {cancellationQuote,depositQuote,payoutEligibility,payoutQuote} from './hosting-rules.mjs';

const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers});
const reject=(error:string,status=400)=>response({error},status);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const short=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const assured=(token:string)=>{
 try{const payload=token.replace(/^Bearer\s+/i,'').split('.')[1];const b64=payload.replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(b64.padEnd(Math.ceil(b64.length/4)*4,'=')))?.aal==='aal2';}catch{return false;}
};
const iso=(v:unknown)=>{const d=new Date(typeof v==='string'?v:'');return Number.isFinite(d.getTime())?d.toISOString():null;};
const safeCents=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=100_000_000;

Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reject('Method not allowed',405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return reject('Service unavailable',503);
 const bearer=request.headers.get('Authorization')||'';
 const auth=createClient(url,pub,{global:{headers:{Authorization:bearer}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return reject('Unauthorized',401);
 const db=createClient(url,secret),uid=user.id;
 const [ages,sec,sub]=await Promise.all([
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
 ]);
 if(ages.error||sec.error||sub.error)return reject('Unable to verify account status',503);
 const age=ages.data?.[0];
 if(age?.status!=='approved'||age.expires_at&&Date.parse(age.expires_at)<=Date.now())return reject('Independent adult verification required',403);
 const admin=sec.data?.admin===true,restricted=sec.data?.banned||sec.data?.suspended;
 const paid=admin||(['active','trial'].includes(sub.data?.status)&&(!sub.data?.period_end||Date.parse(sub.data.period_end)>Date.now()));
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=='object')return reject('Invalid JSON',400);
 const action=short(body.action,70),isAdminAction=action.startsWith('admin_');
 const accessWhenRestricted=new Set(['booking_overview','cancel_quote','refund_request','damage_dispute','notification_preferences','push_unregister']);
 if(restricted&&!accessWhenRestricted.has(action))return reject('Account restricted',403);
 if(isAdminAction&&(!admin||!assured(bearer)))return reject('Administrator MFA required',403);
 const memberAction=new Set(['booking_overview','cancel_quote','refund_request','damage_dispute','notification_preferences','push_unregister']);
 if(!paid&&!memberAction.has(action))return reject('Active premium membership required',403);
 const log=async(name:string,target:string|null=null,meta:Record<string,unknown>={})=>{
  await db.from('platform_action_audit').insert({actor_id:uid,action:name,target_type:'hosting_ops',target_id:uuid(target)?target:null,metadata:meta});
 };
 const note=async(target:string,event:string,title:string,id:string)=>{
  await db.from('member_notifications').insert({recipient_id:target,kind:event,title,details:{booking_id:id}});
  for(const channel of ['email','push']){
   await db.from('hosting_notification_outbox').upsert({
    event_key:event+':'+id+':'+target+':'+channel+':'+crypto.randomUUID(),
    recipient_id:target,channel,template:event,payload:{reference_id:id},status:'queued'
   },{onConflict:'event_key'});
  }
 };
 const bookingById=async(id:unknown)=>{
  if(!uuid(id))return null;
  const {data,error}=await db.from('property_booking_requests')
   .select('id,property_id,owner_id,requester_id,starts_at,ends_at,status,legal_status,payment_status,operational_status,estimated_total,created_at')
   .eq('id',id).maybeSingle();
  if(error)throw error;
  if(!data||![data.owner_id,data.requester_id].includes(uid)&&!admin)return null;
  return data;
 };
 const verifiedHost=async(propertyId:string)=>{
  const {data,error}=await db.from('host_verification_requests')
   .select('id,status,expires_at').eq('property_id',propertyId).eq('status','approved').limit(1);
  if(error)throw error;
  return !!data?.some((v:any)=>!v.expires_at||Date.parse(v.expires_at)>Date.now());
 };
 const policyOf=async(id:string)=>{
  const {data,error}=await db.from('booking_policy_snapshots').select('cancellation_policy,rental_cents,deposit_cents,created_at').eq('booking_id',id).maybeSingle();
  if(error)throw error;
  return data;
 };
 try{
 switch(action){
 case 'provider_readiness':{
  return response({merchant:{configured:Deno.env.get('ADULT_MERCHANT_APPROVED')==='true'&&
   !!Deno.env.get('ADULT_MERCHANT_PROVIDER'),name:Deno.env.get('ADULT_MERCHANT_PROVIDER')||null,
   checkout_available:false,external_capture_verified:false,
   note:'Merchant integration requires supported provider API, approved onboarding and sandbox tests'},
   docusign:{configured:!!(Deno.env.get('DOCUSIGN_ACCOUNT_ID')&&Deno.env.get('DOCUSIGN_INTEGRATION_KEY')&&Deno.env.get('DOCUSIGN_PRIVATE_KEY')),
   note:'Formal signature requires DocuSign OAuth and verified completion'},
   notifications:{email_ready:!!Deno.env.get('HOSTING_EMAIL_PROVIDER_ENABLED'),push_ready:!!Deno.env.get('HOSTING_PUSH_PROVIDER_ENABLED')}});
 }
 case 'host_status':{
  const {data,error}=await db.from('host_verification_requests')
   .select('id,property_id,business_name,authority_type,status,verified_at,expires_at,created_at,reviewer_note')
   .eq('owner_id',uid).order('created_at',{ascending:false}).limit(80);
  if(error)throw error;
  return response({items:data||[]});
 }
 case 'verification_upload_token':{
  if(!uuid(body.property_id)||!['authority','insurance'].includes(body.document_type))return reject('Property and document type required');
  const {data:property}=await db.from('properties').select('id,owner_id').eq('id',body.property_id).maybeSingle();
  if(!property||property.owner_id!==uid)return reject('Not the property host',403);
  const mime=short(body.mime_type,50);
  const suffix={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];
  if(!suffix)return reject('File type must be PDF, JPEG, PNG or WebP');
  const path=uid+'/'+property.id+'/'+body.document_type+'/'+crypto.randomUUID()+'.'+suffix;
  const {data,error}=await db.storage.from('hosting-compliance').createSignedUploadUrl(path);
  if(error)throw error;
  return response({path,token:data.token});
 }
 case 'host_verification_submit':{
  if(!uuid(body.property_id)||!['owner','authorized_manager','lease_authorized','business'].includes(body.authority_type))
   return reject('Property authority type required');
  const {data:property}=await db.from('properties').select('id,owner_id,required_insurance').eq('id',body.property_id).maybeSingle();
  if(!property||property.owner_id!==uid)return reject('Not the host',403);
  const proof=short(body.authority_document_path,480),insurance=short(body.insurance_document_path,480);
  if(!proof.startsWith(uid+'/'+property.id+'/authority/'))return reject('Upload property authority evidence first');
  if(property.required_insurance&&!insurance.startsWith(uid+'/'+property.id+'/insurance/'))return reject('Insurance proof required for this property');
  const bucket=db.storage.from('hosting-compliance');
  const [evidence,coverage]=await Promise.all([
   bucket.info(proof),insurance?bucket.info(insurance):Promise.resolve({data:null,error:null})
  ]);
  if(evidence.error||!evidence.data||insurance&&(coverage.error||!coverage.data))return reject('Private evidence file is missing');
  const {data:existing}=await db.from('host_verification_requests').select('id,status').eq('property_id',property.id)
   .in('status',['pending','approved']).limit(1);
  if(existing?.length)return reject('A pending or approved verification already exists',409);
  const businessName=short(body.business_name,200);
  const {data,error}=await db.from('host_verification_requests').insert({
   property_id:property.id,owner_id:uid,business_name:businessName,authority_type:body.authority_type,
   authority_document_path:proof,insurance_document_path:insurance||null,status:'pending'
  }).select('id,status').single();
  if(error)throw error;
  await log('host_verification_submitted',property.id);
  return response({item:data,note:'Submitted for independent review. No verification is granted automatically.'},201);
 }
 case 'admin_host_queue':{
  const {data,error}=await db.from('host_verification_requests')
   .select('id,owner_id,property_id,business_name,authority_type,status,created_at')
   .eq('status','pending').order('created_at').limit(100);
  if(error)throw error;
  return response({items:data||[]});
 }
 case 'admin_host_documents':{
  if(!uuid(body.id))return reject('Invalid request');
  const {data:item}=await db.from('host_verification_requests').select('*').eq('id',body.id).maybeSingle();
  if(!item||item.owner_id===uid)return reject('Independent reviewer required',403);
  const bucket=db.storage.from('hosting-compliance');
  const links=[];
  for(const key of ['authority_document_path','insurance_document_path']){
   if(item[key]){
    const {data,error}=await bucket.createSignedUrl(item[key],90);
    if(error)throw error;
    links.push({type:key,url:data.signedUrl});
   }
  }
  await log('host_authority_documents_reviewed',item.property_id);
  return response({links,authority_type:item.authority_type,business_name:item.business_name});
 }
 case 'admin_host_decide':{
  if(!uuid(body.id)||!['approved','rejected'].includes(body.decision)||body.human_review_confirmed!==true)return reject('Decision and manual review required');
  const {data:item}=await db.from('host_verification_requests').select('id,owner_id,property_id,status').eq('id',body.id).maybeSingle();
  if(!item||item.owner_id===uid||item.status!=='pending')return reject('Review unavailable',403);
  const now=new Date().toISOString();
  const {data,error}=await db.from('host_verification_requests').update({
   status:body.decision,reviewer_id:uid,verified_at:body.decision==='approved'?now:null,
   expires_at:body.decision==='approved'?new Date(Date.now()+365*86400000).toISOString():null,
   reviewer_note:short(body.note,1000)
  }).eq('id',item.id).eq('status','pending').select('id,status').maybeSingle();
  if(error||!data)return reject('Review conflict',409);
  await note(item.owner_id,'hosting_verification','Your property authority review was '+body.decision,item.property_id);
  await log('host_verification_reviewed',item.property_id,{decision:body.decision});
  return response({item:data});
 }
 case 'booking_overview':{
  const booking=await bookingById(body.booking_id);if(!booking)return reject('Booking unavailable',404);
  const [terms,agreement,charge,deposit,refunds,claim,payout,reschedules]=await Promise.all([
   policyOf(booking.id),
   db.from('booking_agreements').select('id,status,provider_envelope_id,completed_at').eq('booking_id',booking.id).maybeSingle(),
   db.from('booking_payment_intents').select('id,kind,provider,status,amount_cents,currency,created_at').eq('booking_id',booking.id).eq('kind','rental').maybeSingle(),
   db.from('booking_payment_intents').select('id,kind,provider,status,amount_cents,currency').eq('booking_id',booking.id).eq('kind','deposit').maybeSingle(),
   db.from('booking_refund_requests').select('id,status,amount_cents,reason,created_at').eq('booking_id',booking.id).order('created_at',{ascending:false}).limit(25),
   db.from('booking_damage_claims').select('id,status,claimed_cents,description,created_at').eq('booking_id',booking.id).limit(25),
   db.from('booking_payouts').select('id,status,payout_cents,paid_at').eq('booking_id',booking.id).maybeSingle(),
   db.from('booking_reschedule_requests').select('id,status,proposed_start,proposed_end,requested_by,created_at').eq('booking_id',booking.id).order('created_at',{ascending:false}).limit(25)
  ]);
  return response({booking,terms,agreement:agreement.data,charge:charge.data,deposit:deposit.data,
   refunds:refunds.data||[],claims:claim.data||[],payout:payout.data,reschedules:reschedules.data||[]});
 }
 case 'cancel_quote':{
  const booking=await bookingById(body.booking_id);if(!booking)return reject('Booking unavailable',404);
  const terms=await policyOf(booking.id);if(!terms)return reject('Terms snapshot missing',409);
  const initiator=uid===booking.owner_id?'host':'guest';
  return response({quote:cancellationQuote({policy:terms.cancellation_policy,rentalCents:Number(terms.rental_cents),
   startAt:booking.starts_at,at:new Date().toISOString(),initiator}),
   deposit_cents:terms.deposit_cents,note:'Policy estimate only. Not an executed or guaranteed refund.'});
 }
 case 'cancel_booking':{
  const booking=await bookingById(body.booking_id);if(!booking)return reject('Booking unavailable',404);
  if(!['requested','accepted'].includes(booking.status))return reject('Booking can no longer be cancelled',409);
  const terms=await policyOf(booking.id);if(!terms)return reject('Booking policy unavailable',409);
  const initiator=booking.owner_id===uid?'host':'guest';
  const quote=cancellationQuote({policy:terms.cancellation_policy,rentalCents:Number(terms.rental_cents),
   startAt:booking.starts_at,at:new Date().toISOString(),initiator});
  const {data:updated,error}=await db.from('property_booking_requests')
   .update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',booking.id).eq('status',booking.status).select('id').maybeSingle();
  if(error||!updated)return reject('Booking changed; refresh and retry',409);
  if(['captured','partially_refunded'].includes(booking.payment_status)&&quote.refundableCents>0){
   await db.from('booking_refund_requests').insert({
    booking_id:booking.id,requested_by:uid,amount_cents:quote.refundableCents,
    reason:'Cancellation quote: '+terms.cancellation_policy,status:'requested'
   });
  }
  await db.from('booking_payouts').update({status:'held'}).eq('booking_id',booking.id).in('status',['pending','eligible']);
  await note(initiator==='host'?booking.requester_id:booking.owner_id,'hosting_cancelled','Booking cancelled',booking.id);
  await log('hosting_booking_cancelled',booking.id,{refund_requested:quote.refundableCents});
  return response({ok:true,quote,refund_status:booking.payment_status==='captured'?'requested_if_eligible':'no_charge_recorded'});
 }
 case 'reschedule_propose':{
  const b=await bookingById(body.booking_id);if(!b)return reject('Booking unavailable',404);
  const start=iso(body.starts_at),end=iso(body.ends_at);
  if(b.status!=='accepted'||b.legal_status==='signed'||!['not_started','failed'].includes(b.payment_status)||!start||!end
   ||Date.parse(start)<=Date.now()||Date.parse(end)-Date.parse(start)!==Date.parse(b.ends_at)-Date.parse(b.starts_at))return reject('Rescheduling requires an unpaid, unsigned accepted reservation with unchanged duration',409);
  const {data:old}=await db.from('booking_reschedule_requests').select('id').eq('booking_id',b.id).eq('status','pending').limit(1);
  if(old?.length)return reject('A reschedule is already pending',409);
  const {data,error}=await db.from('booking_reschedule_requests').insert({
    booking_id:b.id,requested_by:uid,proposed_start:start,proposed_end:end
  }).select('id,status').single();
  if(error)throw error;
  await note(uid===b.owner_id?b.requester_id:b.owner_id,'hosting_reschedule','A new rental time was proposed',b.id);
  return response({item:data},201);
 }
 case 'reschedule_decide':{
  if(!uuid(body.id)||!['accepted','declined'].includes(body.decision))return reject('Invalid reschedule decision');
  const {data:proposal}=await db.from('booking_reschedule_requests').select('id,booking_id,requested_by,status')
   .eq('id',body.id).maybeSingle();
  if(!proposal||proposal.status!=='pending'||proposal.requested_by===uid)return reject('Proposal unavailable',403);
  const booking=await bookingById(proposal.booking_id);
  if(!booking||![booking.requester_id,booking.owner_id].includes(uid))return reject('Not a booking participant',403);
  const {data,error}=await db.from('booking_reschedule_requests').update({
    status:body.decision,responded_by:uid
  }).eq('id',proposal.id).eq('status','pending').select('id,status').maybeSingle();
  if(error||!data)return reject('Reschedule conflicts with a reserved slot or terms',409);
  await note(proposal.requested_by,'hosting_reschedule','Reschedule '+body.decision,booking.id);
  return response({item:data});
 }
 case 'damage_claim':{
  const booking=await bookingById(body.booking_id);
  if(!booking||booking.owner_id!==uid)return reject('Only booking host can submit damage evidence',403);
  if(Date.now()<Date.parse(booking.ends_at)||Date.now()>Date.parse(booking.ends_at)+72*3600000)return reject('Claims must be filed within 72 hours after the rental',409);
  const terms=await policyOf(booking.id);
  const cents=Number(body.claimed_cents),description=short(body.description,3000);
  if(!safeCents(cents)||cents<1||!terms||cents>Number(terms.deposit_cents)||description.length<10)
   return reject('Claim requires detail and cannot exceed agreed deposit',400);
  const {data,error}=await db.from('booking_damage_claims').insert({
   booking_id:booking.id,host_id:uid,claimed_cents:cents,description,status:'submitted'
  }).select('id,status').single();
  if(error)throw error;
  await db.from('booking_payouts').update({status:'held'}).eq('booking_id',booking.id).in('status',['pending','eligible']);
  await note(booking.requester_id,'hosting_claim','The host submitted a damage claim',booking.id);
  return response({item:data,note:'Claim logged. No deposit was charged or released.'},201);
 }
 case 'claim_evidence_token':{
  if(!uuid(body.claim_id))return reject('Invalid claim');
  const {data:claim}=await db.from('booking_damage_claims').select('id,host_id,booking_id').eq('id',body.claim_id).maybeSingle();
  if(!claim||claim.host_id!==uid)return reject('Only the host can upload claim evidence',403);
  const mime=short(body.mime_type,50);
  const extension={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];
  if(!extension)return reject('Unsupported file type');
  const path=uid+'/'+claim.booking_id+'/'+claim.id+'/'+crypto.randomUUID()+'.'+extension;
  const {data,error}=await db.storage.from('hosting-claims').createSignedUploadUrl(path);
  if(error)throw error;
  return response({token:data.token,path});
 }
 case 'claim_evidence_register':{
  if(!uuid(body.claim_id)||typeof body.path!=='string')return reject('Invalid evidence');
  const {data:claim}=await db.from('booking_damage_claims').select('id,host_id,booking_id,status')
   .eq('id',body.claim_id).maybeSingle();
  if(!claim||claim.host_id!==uid||!['submitted','under_review'].includes(claim.status))return reject('Claim unavailable',403);
  if(!body.path.startsWith(uid+'/'+claim.booking_id+'/'+claim.id+'/')||body.path.includes('..'))return reject('Invalid evidence path',403);
  const {data:info,error:storageError}=await db.storage.from('hosting-claims').info(body.path);
  if(storageError||!info)return reject('Evidence file unavailable',404);
  const {error}=await db.from('booking_damage_claims').update({evidence_path:body.path}).eq('id',claim.id);
  if(error)throw error;
  return response({ok:true});
 }
 case 'damage_dispute':{
  if(!uuid(body.claim_id))return reject('Claim ID required');
  const {data:claim}=await db.from('booking_damage_claims').select('id,booking_id,status').eq('id',body.claim_id).maybeSingle();
  if(!claim||claim.status!=='submitted')return reject('Claim unavailable',409);
  const b=await bookingById(claim.booking_id);
  if(!b||b.requester_id!==uid)return reject('Only the guest can dispute a claim',403);
  const {data,error}=await db.from('booking_damage_claims').update({status:'disputed'}).eq('id',claim.id).eq('status','submitted').select('id,status').maybeSingle();
  if(error||!data)return reject('Claim already changed',409);
  await log('hosting_damage_disputed',b.id);
  return response({item:data});
 }
 case 'admin_claims':{
  const {data,error}=await db.from('booking_damage_claims')
   .select('id,booking_id,host_id,claimed_cents,description,status,created_at,evidence_path')
   .in('status',['submitted','disputed','under_review']).order('created_at').limit(75);
  if(error)throw error;
  return response({items:(data||[]).map((v:any)=>({...v,evidence_path:undefined,has_evidence:!!v.evidence_path}))});
 }
 case 'admin_claim_evidence':{
  if(!uuid(body.id))return reject('Claim ID required');
  const {data:claim}=await db.from('booking_damage_claims').select('evidence_path').eq('id',body.id).maybeSingle();
  if(!claim?.evidence_path)return reject('No evidence uploaded',404);
  const {data,error}=await db.storage.from('hosting-claims').createSignedUrl(claim.evidence_path,90);
  if(error)throw error;
  return response({url:data.signedUrl,expires_in:90});
 }
 case 'admin_claim_decide':{
  if(!uuid(body.id)||!['approved','rejected'].includes(body.decision)||body.human_review_confirmed!==true)
   return reject('Independent review required');
  const {data:claim}=await db.from('booking_damage_claims').select('id,booking_id,host_id,status,claimed_cents')
   .eq('id',body.id).maybeSingle();
  if(!claim||claim.host_id===uid||!['submitted','disputed','under_review'].includes(claim.status))
   return reject('Claim unavailable for independent review',403);
  const {data,error}=await db.from('booking_damage_claims').update({
    status:body.decision,reviewed_by:uid
  }).eq('id',claim.id).eq('status',claim.status).select('id,status').maybeSingle();
  if(error||!data)return reject('Claim decision conflict',409);
  const b=await bookingById(claim.booking_id);
  if(b)await note(b.requester_id,'hosting_claim','Damage claim '+body.decision,b.id);
  return response({item:data,note:'Decision recorded; no funds moved.'});
 }
 case 'refund_request':{
  const booking=await bookingById(body.booking_id);if(!booking)return reject('Booking unavailable',404);
  if(!['captured','partially_refunded'].includes(booking.payment_status))return reject('No settled payment to refund',409);
  const terms=await policyOf(booking.id);if(!terms)return reject('Terms unavailable',409);
  const initiator=uid===booking.owner_id?'host':'guest';
  const quote=cancellationQuote({policy:terms.cancellation_policy,rentalCents:Number(terms.rental_cents),
    startAt:booking.starts_at,at:new Date().toISOString(),initiator});
  if(quote.refundableCents<1)return reject('No automatic refund is available under the terms; contact support',409);
  const {data:existing}=await db.from('booking_refund_requests').select('id').eq('booking_id',booking.id)
   .in('status',['requested','approved','submitted']).limit(1);
  if(existing?.length)return reject('Refund review already pending',409);
  const {data,error}=await db.from('booking_refund_requests').insert({
    booking_id:booking.id,requested_by:uid,amount_cents:quote.refundableCents,
    reason:short(body.reason,1200)||'Cancellation policy review'
  }).select('id,status,amount_cents').single();
  if(error)throw error;
  await db.from('booking_payouts').update({status:'held'}).eq('booking_id',booking.id).in('status',['pending','eligible']);
  return response({item:data,note:'Refund requested. No money has been transferred.'},201);
 }
 case 'admin_refunds':{
  const {data,error}=await db.from('booking_refund_requests').select('id,booking_id,amount_cents,reason,status,created_at')
   .in('status',['requested','approved','submitted']).order('created_at').limit(100);
  if(error)throw error;
  return response({items:data||[]});
 }
 case 'admin_refund_decide':{
  if(!uuid(body.id)||!['approved','rejected'].includes(body.decision)||body.human_review_confirmed!==true)
   return reject('Independent refund decision required',400);
  const {data:old}=await db.from('booking_refund_requests').select('id,booking_id,requested_by,status')
   .eq('id',body.id).maybeSingle();
  if(!old||old.requested_by===uid||old.status!=='requested')return reject('Refund unavailable',403);
  const {data,error}=await db.from('booking_refund_requests').update({status:body.decision,
   decided_by:uid,decided_at:new Date().toISOString()}).eq('id',old.id).eq('status','requested').select('id,status').maybeSingle();
  if(error||!data)return reject('Refund review conflict',409);
  await note(old.requested_by,'hosting_refund','Refund review '+body.decision,old.booking_id);
  return response({item:data,note:'A provider must confirm any actual financial refund.'});
 }
 case 'payout_preview':{
  const booking=await bookingById(body.booking_id);
  if(!booking||booking.owner_id!==uid&&!admin)return reject('Host payout unavailable',403);
  const [account,claims,refunds,verification]=await Promise.all([
    db.from('host_payout_accounts').select('verification_status').eq('owner_id',booking.owner_id).maybeSingle(),
    db.from('booking_damage_claims').select('id').eq('booking_id',booking.id).in('status',['submitted','disputed','under_review']).limit(1),
    db.from('booking_refund_requests').select('id').eq('booking_id',booking.id).in('status',['requested','approved','submitted']).limit(1),
    verifiedHost(booking.property_id),
  ]);
  const eligible=payoutEligibility({bookingStatus:booking.status,legalStatus:booking.legal_status,
   paymentStatus:booking.payment_status,hostVerified:verification,accountVerified:account.data?.verification_status==='verified',
   openClaim:!!claims.data?.length,openRefund:!!refunds.data?.length});
  const cents=Math.round(Number(booking.estimated_total||0)*100);
  return response({eligible,quote:payoutQuote({capturedCents:cents,refundedCents:0,feeBasisPoints:0}),
   status:'not_paid',note:'Informational preview; no payout executed or platform fee established.'});
 }
 case 'booking_checkout_prepare':{
  const booking=await bookingById(body.booking_id);
  if(!booking||booking.requester_id!==uid||booking.status!=='accepted')return reject('Accepted guest booking required',403);
  if(booking.legal_status!=='signed')return reject('Completed DocuSign agreement required before checkout',409);
  if(!await verifiedHost(booking.property_id))return reject('Host verification expired',409);
  const snapshot=await policyOf(booking.id);if(!snapshot)return reject('Booking price snapshot missing',409);
  // No unverified provider link is generated; merchant approval is necessary.
  const {error}=await db.from('booking_payment_intents').upsert({
    booking_id:booking.id,provider:'unconfigured',kind:'rental',
    amount_cents:Number(snapshot.rental_cents),status:'not_started'
  },{onConflict:'booking_id,kind',ignoreDuplicates:true});
  if(error)throw error;
  if(Number(snapshot.deposit_cents)>0)await db.from('booking_payment_intents').upsert({
    booking_id:booking.id,provider:'unconfigured',kind:'deposit',
    amount_cents:Number(snapshot.deposit_cents),status:'not_started'
  },{onConflict:'booking_id,kind',ignoreDuplicates:true});
  return reject('Booking quote recorded. Approved adult-industry processor and capture API have not been configured.',503);
 }
 case 'notification_preferences':{
  const {data}=await db.from('member_notification_preferences').select('email_digest,booking_reminders,message_alerts')
   .eq('user_id',uid).maybeSingle();
  return response({item:data||{email_digest:false,booking_reminders:true,message_alerts:true}});
 }
 case 'push_register':{
  if(!paid)return reject('Account must be active',403);
  const endpoint=short(body.endpoint,1600),p256dh=short(body.p256dh,500),authSecret=short(body.auth,500);
  let parsed:URL;try{parsed=new URL(endpoint);}catch{return reject('Invalid push endpoint');}
  if(parsed.protocol!=='https:'||!p256dh||!authSecret)return reject('Push subscription must contain secure browser keys',400);
  const {count,error:countError}=await db.from('hosting_push_subscriptions').select('id',{head:true,count:'exact'}).eq('user_id',uid);
  if(countError)throw countError;
  if((count||0)>10)return reject('Maximum push devices reached',429);
  const {error}=await db.from('hosting_push_subscriptions').upsert({
    user_id:uid,endpoint,p256dh,auth_secret:authSecret
  },{onConflict:'endpoint'});
  if(error)throw error;
  return response({ok:true,note:'Device registered. Delivery requires an approved push provider configuration.'});
 }
 case 'push_unregister':{
  const endpoint=short(body.endpoint,1600);
  const {error}=await db.from('hosting_push_subscriptions').delete().eq('endpoint',endpoint).eq('user_id',uid);
  if(error)throw error;return response({ok:true});
 }
 default:return reject('Unknown hosting operation',404);
 }
 }catch(error){console.error('hosting-operations',action,error);return reject('Hosting operation failed',500);}
});
