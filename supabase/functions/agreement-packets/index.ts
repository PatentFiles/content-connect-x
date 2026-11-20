/**
 * Formal agreement preparation layer. Draft packets are functional; sending and
 * marking a document signed requires a configured DocuSign service and verified
 * Connect callback. Never mint a completed signature locally.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {providerFetch,buildAgreementPdf} from './docuSignProvider.mjs';
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
  db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle()
 ]);
 if(age.error||sec.error||sub.error)return reply({error:'Account status unavailable'},503);
 if(sec.data?.banned||sec.data?.suspended)return reply({error:'Account restricted'},403);
 if(!age.data?.[0]?.admitted_at)
  return reply({error:'Complete account onboarding first'},403);
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

   const {data:workPolicy,error:workPolicyError}=await db.from('collaborations')
    .select('requires_work_clearance').eq('id',contract.collaboration_id).maybeSingle();
   if(workPolicyError||!workPolicy)return reply({error:'Collaboration requirements unavailable'},503);
   if(workPolicy.requires_work_clearance){
    const {data:participants,error:peopleError}=await db.from('collaboration_members')
     .select('user_id').eq('collaboration_id',collab.id);
    if(peopleError||!participants?.length)return reply({error:'Collaborators unavailable'},503);
    const peopleIds=participants.map((v:any)=>v.user_id);
    const [consents,records]=await Promise.all([
      db.from('ccx_clearance_share_consents').select('user_id,revoked_at')
       .eq('collaboration_id',collab.id).in('user_id',peopleIds),
      db.from('performer_work_clearances').select('user_id,clearance_confirmed,expires_at')
       .in('user_id',peopleIds)
    ]);
    if(consents.error||records.error)return reply({error:'Work readiness unavailable'},503);
    const opted=new Set((consents.data||[]).filter((v:any)=>!v.revoked_at).map((v:any)=>v.user_id));
    if(!peopleIds.every((person:string)=>{
      const result=(records.data||[]).find((v:any)=>v.user_id===person);
      return opted.has(person)&&result?.clearance_confirmed&&result.expires_at&&Date.parse(result.expires_at)>Date.now();
    }))return reply({error:'Work clearance is required for all participants before preparing a signing packet'},409);
   }
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
    const {data:verified,error:verifyError}=await db.from('member_admissions').select('id,user_id,admitted_at,source,created_at')
     .eq('user_id',r.member_id).order('created_at',{ascending:false}).limit(1);
    if(verifyError||!verified?.[0]?.admitted_at)
     return reply({error:'Every signer must have completed signup'},403);
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
   if(!uuid(body.envelope_id))return reply({error:'Select a signing packet'},400);
   const {data:packet,error:packetError}=await db.from('signature_envelopes')
    .select('id,contract_id,collaboration_id,requested_by,status,signing_order_enabled')
    .eq('id',body.envelope_id).maybeSingle();
   if(packetError||!packet||packet.requested_by!==uid)return reply({error:'Only the packet organizer can send it'},403);
   if(packet.status!=='draft')return reply({error:'This packet has already been submitted or requires reconciliation'},409);
   const [contractResult,collabResult,recipientsResult,testingPolicy]=await Promise.all([
    db.from('contracts').select('id,title,content,collaboration_id,status').eq('id',packet.contract_id).maybeSingle(),
    db.from('collaborations').select('id,title,status').eq('id',packet.collaboration_id).maybeSingle(),
    db.from('signature_packet_recipients').select('id,member_id,role,routing_order,status').eq('envelope_id',packet.id).order('routing_order'),
    db.from('ccx_collab_testing_policies').select('*').eq('collaboration_id',packet.collaboration_id).maybeSingle()
   ]);
   const contract=contractResult.data,collab=collabResult.data,recipients=recipientsResult.data||[];
   if(contractResult.error||collabResult.error||recipientsResult.error||testingPolicy.error||!contract||!collab)
    return reply({error:'Signing packet data unavailable'},503);
   if(contract.collaboration_id!==collab.id||collab.status==='cancelled'||!recipients.length||contract.status!=='draft')
    return reply({error:'This agreement is not ready for signing'},409);
   const policy=testingPolicy.data;
   if(policy?.requires_testing){
    if(policy.deadline_at&&Date.parse(policy.deadline_at)<Date.now())return reply({error:'Testing deadline has passed'},409);
    const {data:participants,error:membersError}=await db.from('collaboration_members').select('user_id,membership_role').eq('collaboration_id',collab.id);
    if(membersError)return reply({error:'Cannot verify testing requirements'},503);
    for(const member of (participants||[]).filter(p=>p.membership_role==='creator')){
     const {data:current,error:credError}=await db.from('ccx_testing_credentials').select('id').eq('user_id',member.user_id)
      .eq('status','verified').gte('expires_at',new Date().toISOString())
      .gte('tested_at',new Date(Date.now()-policy.tested_within_days*86400000).toISOString()).limit(1);
     if(credError||!current?.length)return reply({error:'Every creator must have current verified testing before signing'},409);
    }
   }
   const ids=recipients.map(r=>r.member_id);
   if(new Set(ids).size!==ids.length)return reply({error:'Duplicate signer in packet'},409);
   const {data:profiles,error:profileError}=await db.from('member_profiles').select('id,display_name,real_name').in('id',ids);
   if(profileError)return reply({error:'Signer names unavailable'},503);
   const parties=[];
   for(const recipient of recipients){
    const {data:authRow,error:emailError}=await db.auth.admin.getUserById(recipient.member_id);
    if(emailError||!authRow?.user?.email)return reply({error:'A recipient is missing a verified email address'},409);
    const profile=(profiles||[]).find(p=>p.id===recipient.member_id);
    const name=text(profile?.real_name||profile?.display_name,100);
    if(!name)return reply({error:'A recipient has no signing name'},409);
    parties.push({member_id:recipient.member_id,name,email:authRow.user.email,role:recipient.role,
     routing_order:recipient.routing_order});
   }
   const transaction=crypto.randomUUID();
   const {data:claimed,error:claimError}=await db.from('signature_envelopes')
    .update({status:'sending',provider_transaction_id:transaction}).eq('id',packet.id).eq('status','draft').select('id').maybeSingle();
   if(claimError||!claimed)return reply({error:'The packet is already being sent'},409);
   try{
    const pdf=await buildAgreementPdf(contract,parties);
    const signers=parties.filter(r=>r.role!=='viewer').map((r,i)=>({
     email:r.email,name:r.name,recipientId:String(i+1),
     routingOrder:packet.signing_order_enabled?String(r.routing_order):'1',
     tabs:{signHereTabs:[{anchorString:'SIGN_HERE_'+r.member_id,anchorUnits:'pixels',anchorXOffset:'0',anchorYOffset:'12'}]}
    }));
    const carbonCopies=parties.filter(r=>r.role==='viewer').map((r,i)=>({
     email:r.email,name:r.name,recipientId:String(i+1+signers.length),
     routingOrder:packet.signing_order_enabled?String(r.routing_order):'1'
    }));
    const callback=(url||'').replace(/\/$/,'')+'/functions/v1/collaboration-docusign-webhook';
    const requestBody={emailSubject:'Please review and sign: '+text(contract.title,80),
     documents:[{documentBase64:pdf,name:text(contract.title,90)||'Collaboration agreement',fileExtension:'pdf',documentId:'1'}],
     recipients:{signers,carbonCopies},status:'sent',transactionId:transaction,
     eventNotification:{url:callback,requireAcknowledgment:'true',loggingEnabled:'true',
      includeDocuments:'false',includeHMAC:'true',
      envelopeEvents:[{envelopeEventStatusCode:'Completed'},{envelopeEventStatusCode:'Declined'},
       {envelopeEventStatusCode:'Voided'},{envelopeEventStatusCode:'Delivered'}],
      eventData:{version:'restv2.1',format:'json',includeData:['recipients']}}
    };
    const provider=await providerFetch(db,'/envelopes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(requestBody)});
    const created=await provider.json();
    if(!uuid(created.envelopeId))throw Error('DocuSign did not return an envelope ID');
    const {error:updateError}=await db.from('signature_envelopes').update({
     status:'sent',provider_envelope_id:created.envelopeId,sent_at:new Date().toISOString()
    }).eq('id',packet.id).eq('status','sending');
    if(updateError)throw updateError;
    // Record immutable provider recipient IDs so callbacks map each DocuSign signer
    // to the right verified collaboration member, rather than trusting display names.
    const signerParties=parties.filter(r=>r.role!=='viewer'),viewerParties=parties.filter(r=>r.role==='viewer');
    for(let i=0;i<signerParties.length;i++){
     await db.from('signature_packet_recipients').update({status:'sent',provider_recipient_id:String(i+1)})
      .eq('envelope_id',packet.id).eq('member_id',signerParties[i].member_id);
    }
    for(let i=0;i<viewerParties.length;i++){
     await db.from('signature_packet_recipients').update({status:'sent',provider_recipient_id:String(signerParties.length+i+1)})
      .eq('envelope_id',packet.id).eq('member_id',viewerParties[i].member_id);
    }
    await db.from('signature_packet_audit').insert({envelope_id:packet.id,actor_id:uid,
     event_type:'docusign_sent',metadata:{provider_envelope_id:created.envelopeId,transaction_id:transaction,recipient_count:parties.length}});
    return reply({sent:true,status:'sent',envelope_id:created.envelopeId,note:'DocuSign signing invitations sent to each participant.'});
   }catch(error){
    // Network failures after sending can be indeterminate; never auto-retry an envelope.
    await db.from('signature_envelopes').update({status:'error'}).eq('id',packet.id).eq('status','sending');
    await db.from('signature_packet_audit').insert({envelope_id:packet.id,actor_id:uid,
     event_type:'docusign_send_uncertain',metadata:{transaction_id:transaction}});
    return reply({error:'DocuSign could not confirm this send. Reconcile the transaction in DocuSign before another attempt.'},503);
   }
  }
  return reply({error:'Unknown agreement action'},404);
 }catch(e){console.error('agreement-packets',action,e);return reply({error:'Agreement workflow unavailable'},500);}
});
