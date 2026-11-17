/** Booking-specific DocuSign integration. Only approved templates are sent. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {docuSignConfigured,docuSignFetch} from './token.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const out=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const reject=(e:string,s=400)=>out({error:e},s);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const brief=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reject('Method not allowed',405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return reject('Backend unavailable',503);
 const header=req.headers.get('Authorization')||'';
 const auth=createClient(url,pub,{global:{headers:{Authorization:header}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return reject('Unauthorized',401);
 const db=createClient(url,secret),uid=user.id;
 const [security,age,plan,ohAccount]=await Promise.all([
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
  db.from('onlyhost_accounts').select('status').eq('user_id',uid).maybeSingle()
 ]);
 if(security.error||age.error||plan.error||ohAccount.error)return reject('Account unavailable',503);
 if(security.data?.banned||security.data?.suspended||!age.data?.[0]?.admitted_at)
  return reject('Complete account onboarding first',403);
 const admin=security.data?.admin===true,paid=admin||ohAccount.data?.status==='active'||(['active','trial'].includes(plan.data?.status)&&(!plan.data?.period_end||Date.parse(plan.data.period_end)>Date.now()));
 const body=await req.json().catch(()=>({}));
 const action=brief(body.action,55);
 if(!paid)return reject('Premium membership required',403);
 if(action.startsWith('admin_')&&!admin)return reject('Administrator access required',403);
 const booking=async(id:unknown)=>{
  if(!uuid(id))return null;
  const {data,error}=await db.from('property_booking_requests')
   .select('id,property_id,owner_id,requester_id,status,legal_status,starts_at')
   .eq('id',id).maybeSingle();
  if(error)throw error;
  return data&&[data.owner_id,data.requester_id].includes(uid)?data:null;
 };
 try{
  switch(action){
  case 'status':{
   const b=await booking(body.booking_id);
   if(!b)return reject('Booking unavailable',404);
   const {data,error}=await db.from('booking_agreements')
    .select('id,status,provider,completed_at,created_at').eq('booking_id',b.id).maybeSingle();
   if(error)throw error;
   return out({item:data||null,provider_ready:docuSignConfigured()});
  }
  case 'admin_register_signer_name':{
   if(!uuid(body.user_id)||body.user_id===uid||brief(body.legal_name,180).length<3||body.independent_review_confirmed!==true)
    return reject('Independent approved legal-name review required');
   const {data:verification}=await db.from('member_admissions').select('id,user_id,admitted_at,source,created_at')
    .eq('user_id',body.user_id).order('created_at',{ascending:false}).limit(1);
   if(!verification?.[0]?.admitted_at)
    return reject('Target member must be independently age verified',403);
   const method=['reviewed_government_id','approved_identity_provider'].includes(body.method)?body.method:'reviewed_government_id';
   const {data,error}=await db.from('hosting_verified_signer_names')
    .upsert({user_id:body.user_id,legal_name:brief(body.legal_name,180),
     verified_by:uid,verified_at:new Date().toISOString(),method},{onConflict:'user_id'})
    .select('user_id,verified_at,method').single();
   if(error)throw error;
   return out({item:data});
  }
  case 'send':{
   const b=await booking(body.booking_id);if(!b||b.owner_id!==uid||b.status!=='accepted')return reject('Accepted booking host required',403);
   if(!docuSignConfigured())return reject('DocuSign account approval, credentials and lawyer-reviewed template not configured',503);
   const {data:host}=await db.from('host_verification_requests')
    .select('id,expires_at').eq('property_id',b.property_id).eq('status','approved').limit(1);
   if(!host?.some((h:any)=>!h.expires_at||Date.parse(h.expires_at)>Date.now()))return reject('Verified host authority required',403);
   const expectedTemplate=Deno.env.get('DOCUSIGN_LOCATION_TEMPLATE_ID');
   const {data:template}=await db.from('approved_agreement_templates')
    .select('id,provider_template_id,title').eq('document_type','location_agreement').eq('active',true)
    .eq('provider_template_id',expectedTemplate).maybeSingle();
   if(!template)return reject('Independent administrator approval of legal template required',403);
   const {data:identities}=await db.from('hosting_verified_signer_names').select('user_id,legal_name')
    .in('user_id',[b.owner_id,b.requester_id]);
   if(!identities||identities.length!==2)return reject('Both signers need independently reviewed legal names',403);
   const [hostAuth,guestAuth]=await Promise.all([
    db.auth.admin.getUserById(b.owner_id),db.auth.admin.getUserById(b.requester_id)
   ]);
   if(hostAuth.error||guestAuth.error||!hostAuth.data.user?.email||!guestAuth.data.user?.email)
    return reject('Signer emails not confirmed',403);
   const roles=[
    {member_id:b.owner_id,email:hostAuth.data.user.email,roleName:'Host',routingOrder:'1'},
    {member_id:b.requester_id,email:guestAuth.data.user.email,roleName:'Guest',routingOrder:'2'}
   ].map(r=>({email:r.email,name:identities.find((v:any)=>v.user_id===r.member_id).legal_name,
    roleName:r.roleName,routingOrder:r.routingOrder}));
   let {data:existing,error:lookupError}=await db.from('booking_agreements')
    .select('id,status,provider_envelope_id').eq('booking_id',b.id).maybeSingle();
   if(lookupError)throw lookupError;
   if(existing?.provider_envelope_id)return reject('Envelope already exists; use provider status',409);
   if(!existing){
    const {data,error}=await db.from('booking_agreements').insert({
     booking_id:b.id,template_id:template.id,signer_host_id:b.owner_id,signer_guest_id:b.requester_id,
     status:'draft',provider:'docusign'
    }).select('id,status').single();
    if(error)throw error;existing=data;
   }
   const {data:lock,error:casError}=await db.from('booking_agreements')
    .update({status:'sending'}).eq('id',existing.id).eq('status','draft').select('id').maybeSingle();
   if(casError||!lock)return reject('Signing request already being processed',409);
   try{
    const payload={
     templateId:expectedTemplate,templateRoles:roles,status:'sent',
     emailSubject:'Content Connect X – location rental agreement',
     transactionId:b.id,
     customFields:{textCustomFields:[{name:'ccx_booking_id',value:b.id,show:'false'}]}
    };
    const provider=await docuSignFetch('/envelopes',{
     method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
    });
    const created=await provider.json();
    if(!uuid(created.envelopeId))throw Error('DocuSign did not return an envelope ID');
    const {error:saveError}=await db.from('booking_agreements')
     .update({status:'sent',provider_envelope_id:created.envelopeId})
     .eq('id',existing.id).eq('status','sending');
    if(saveError)throw saveError;
    await db.from('property_booking_requests').update({legal_status:'pending_signature'})
     .eq('id',b.id).eq('legal_status','not_prepared');
    await db.from('member_notifications').insert([
     {recipient_id:b.owner_id,kind:'hosting_signature',title:'Rental agreement sent for signature',details:{booking_id:b.id}},
     {recipient_id:b.requester_id,kind:'hosting_signature',title:'Rental agreement sent for signature',details:{booking_id:b.id}}
    ]);
    return out({envelope_id:created.envelopeId,status:'sent',note:'DocuSign sent invitations. Completion requires verified provider webhook.'});
   }catch(error){
    // A provider network error might have occurred AFTER sending the envelope.
    // Never retry automatically: reconcile by transaction ID with DocuSign first.
    await db.from('booking_agreements').update({status:'error'}).eq('id',existing.id).eq('status','sending');
    await db.from('hosting_provider_reconciliation').upsert({
     provider:'docusign',entity_id:existing.id,issue:'send_indeterminate',status:'pending'
    },{onConflict:'provider,entity_id,issue'});
    console.error('docusign send requires reconciliation',error);
    return reject('Signing could not be confirmed. Administrator must reconcile with DocuSign before retrying.',503);
   }
  }
  case 'download':{
   const b=await booking(body.booking_id);if(!b)return reject('Booking unavailable',404);
   const {data:envelope}=await db.from('booking_agreements')
    .select('status,signed_pdf_path,certificate_path').eq('booking_id',b.id).maybeSingle();
   if(envelope?.status!=='completed'||!envelope.signed_pdf_path||!envelope.certificate_path)
    return reject('Signed records are not yet archived',404);
   const bucket=db.storage.from('signed-agreements');
   const [signed,certificate]=await Promise.all([
    bucket.createSignedUrl(envelope.signed_pdf_path,90),
    bucket.createSignedUrl(envelope.certificate_path,90)
   ]);
   if(signed.error||certificate.error)return reject('Private signed records unavailable',503);
   return out({signed_pdf:signed.data.signedUrl,certificate:certificate.data.signedUrl,expires_in:90});
  }
  default:return reject('Unknown action',404);
  }
 }catch(error){console.error('hosting-docusign',action,error);return reject('DocuSign workflow unavailable',500);}
});
