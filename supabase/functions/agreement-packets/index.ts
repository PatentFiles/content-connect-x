/**
 * Formal agreement preparation layer. Draft packets are functional; sending and
 * marking a document signed requires a configured DocuSign service and verified
 * Connect callback. Never mint a completed signature locally.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown,n=140)=>typeof v==='string'?v.trim().slice(0,n):'';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return reply({error:'Backend unavailable'},503);
 const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authenticationError}=await client.auth.getUser();
 if(authenticationError||!user)return reply({error:'Unauthorized'},401);
 const db=createClient(url,secret),uid=user.id;
 const [age,sec,sub]=await Promise.all([
  db.from('age_verification_requests').select('status,expires_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle()
 ]);
 if(age.error||sec.error||sub.error)return reply({error:'Account status unavailable'},503);
 if(sec.data?.banned||sec.data?.suspended)return reply({error:'Account restricted'},403);
 if(age.data?.[0]?.status!=='approved'||age.data[0]?.expires_at&&Date.parse(age.data[0].expires_at)<Date.now())
  return reply({error:'Age verification required'},403);
 const paid=sec.data?.admin||['active','trial'].includes(sub.data?.status)&&(!sub.data?.period_end||Date.parse(sub.data.period_end)>Date.now());
 if(!paid)return reply({error:'Premium account required'},403);
 const body=await req.json().catch(()=>({}));
 const action=text(body.action,55);
 try{
  if(action==='templates'){
   const {data,error}=await db.from('approved_agreement_templates').select('id,title,document_type')
    .eq('active',true).order('title').limit(50);
   if(error)throw error;
   return reply({items:data||[]});
  }
  if(action==='my_packets'){
   const {data:members,error:memberError}=await db.from('collaboration_members').select('collaboration_id').eq('user_id',uid).limit(150);
   if(memberError)throw memberError;
   const ids=(members||[]).map(m=>m.collaboration_id);
   if(!ids.length)return reply({items:[]});
   const {data,error}=await db.from('signature_envelopes').select('id,contract_id,collaboration_id,provider,status,signing_order_enabled,created_at,completed_at')
    .in('collaboration_id',ids).order('created_at',{ascending:false}).limit(100);
   if(error)throw error;
   return reply({items:data||[]});
  }
  if(action==='packet_recipients'){
   if(!uuid(body.envelope_id))return reply({error:'Invalid packet'},400);
   const {data:envelope,error}=await db.from('signature_envelopes').select('id,collaboration_id,status').eq('id',body.envelope_id).maybeSingle();
   if(error||!envelope)return reply({error:'Packet unavailable'},404);
   const {data:member}=await db.from('collaboration_members').select('user_id').eq('collaboration_id',envelope.collaboration_id).eq('user_id',uid).maybeSingle();
   if(!member)return reply({error:'Not a participant'},403);
   const {data:recipients,error:recipientsError}=await db.from('signature_packet_recipients')
    .select('member_id,role,routing_order,status,signed_at').eq('envelope_id',envelope.id).order('routing_order');
   if(recipientsError)throw recipientsError;
   return reply({status:envelope.status,items:recipients||[]});
  }
  if(action==='create_draft'){
   if(!uuid(body.contract_id))return reply({error:'Contract ID required'},400);
   const {data:contract,error:contractError}=await db.from('contracts')
    .select('id,collaboration_id,title,status,content').eq('id',body.contract_id).maybeSingle();
   if(contractError||!contract||contract.status!=='draft')return reply({error:'Draft contract required'},404);
   const {data:collab,error:collabError}=await db.from('collaborations')
    .select('id,creator_id,status').eq('id',contract.collaboration_id).maybeSingle();
   if(collabError||!collab||collab.creator_id!==uid||collab.status==='paused')return reply({error:'Only the production owner may prepare a packet'},403);
   const {data:members,error:memberError}=await db.from('collaboration_members')
    .select('user_id').eq('collaboration_id',collab.id);
   if(memberError||!members?.length)return reply({error:'No collaboration participants'},409);
   const people=members.map(m=>m.user_id);
   const requested=body.recipients;
   if(!Array.isArray(requested)||requested.length!==people.length||requested.length>25)
    return reply({error:'All participants must have specified roles and signing order'},400);
   if(new Set(requested.map((r:any)=>r?.member_id)).size!==people.length)
    return reply({error:'Duplicate or missing recipients'},400);
   for(const r of requested){
    if(!uuid(r?.member_id)||!people.includes(r.member_id)||!['signer','approver','viewer'].includes(r.role)||
      !Number.isInteger(r.routing_order)||r.routing_order<1||r.routing_order>25)
      return reply({error:'Invalid recipient identity, role or order'},400);
    const {data:verified,error:verifyError}=await db.from('age_verification_requests').select('status,expires_at')
     .eq('user_id',r.member_id).order('created_at',{ascending:false}).limit(1);
    if(verifyError||verified?.[0]?.status!=='approved'||verified[0]?.expires_at&&Date.parse(verified[0].expires_at)<Date.now())
     return reply({error:'Every signer must be independently age verified'},403);
   }
   if(!requested.some((r:any)=>r.role==='signer'))return reply({error:'At least one signer is required'},400);
   let templateId=null;
   if(body.template_id){
    if(!uuid(body.template_id))return reply({error:'Invalid approved template'},400);
    const {data:template}=await db.from('approved_agreement_templates').select('id').eq('id',body.template_id).eq('active',true).maybeSingle();
    if(!template)return reply({error:'Template is not legally approved'},403);
    templateId=template.id;
   }
   const {data:envelope,error:insertError}=await db.from('signature_envelopes').insert({
    contract_id:contract.id,collaboration_id:collab.id,requested_by:uid,provider:'docusign',
    signing_order_enabled:body.sequential===true,status:'draft'
   }).select('id,status').single();
   if(insertError)throw insertError;
   const {error:recipientError}=await db.from('signature_packet_recipients').insert(requested.map((r:any)=>({
     envelope_id:envelope.id,member_id:r.member_id,role:r.role,routing_order:r.routing_order,status:'pending'
   })));
   if(recipientError){
    await db.from('signature_envelopes').delete().eq('id',envelope.id);
    throw recipientError;
   }
   await db.from('signature_packet_audit').insert({envelope_id:envelope.id,actor_id:uid,
    event_type:'draft_created',metadata:{contract_id:contract.id,recipient_count:requested.length,template_id:templateId}});
   return reply({item:envelope,note:'Draft prepared. DocuSign sending remains disabled until approved and authenticated.'},201);
  }
  if(action==='download_evidence'){
   if(!uuid(body.envelope_id))return reply({error:'Invalid envelope'},400);
   const {data:envelope,error}=await db.from('signature_envelopes')
    .select('collaboration_id,status,completed_document_path,certificate_path')
    .eq('id',body.envelope_id).maybeSingle();
   if(error||!envelope||envelope.status!=='completed'||!envelope.completed_document_path||!envelope.certificate_path)
    return reply({error:'No completed signed document/certificate available'},404);
   const {data:member}=await db.from('collaboration_members').select('user_id').eq('collaboration_id',envelope.collaboration_id).eq('user_id',uid).maybeSingle();
   if(!member)return reply({error:'Not authorized'},403);
   const bucket=db.storage.from('signed-agreements');
   const [signed,certificate]=await Promise.all([
    bucket.createSignedUrl(envelope.completed_document_path,60),
    bucket.createSignedUrl(envelope.certificate_path,60)
   ]);
   if(signed.error||certificate.error)return reply({error:'Evidence temporarily unavailable'},503);
   return reply({signed_pdf:signed.data.signedUrl,certificate:certificate.data.signedUrl,expires_in:60});
  }
  if(action==='send_packet'){
   // No unverified DocuSign completion, no unsigned browser-controlled signing.
   return reply({error:'DocuSign OAuth, approved templates, sender authorization and Connect webhook must be connected before sending'},503);
  }
  return reply({error:'Unknown agreement action'},404);
 }catch(e){console.error('agreement-packets',action,e);return reply({error:'Agreement workflow unavailable'},500);}
});
