/** DocuSign Connect 2.0 JSON SIM webhook. No JWT; HMAC over raw body required. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {docuSignConfigured,docuSignFetch,sha256} from './token.ts';
const reply=(body:unknown,status=200)=>Response.json(body,{status});
const hex=(value:Uint8Array)=>Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
function constantTimeEqual(a:Uint8Array,b:Uint8Array){
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
function fromBase64(s:string){
 try{return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}catch{return new Uint8Array();}
}
const allowed='envelope-completed,envelope-voided,envelope-declined,envelope-delivered'.split(',');
const guid=(id:unknown):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const secret=Deno.env.get('DOCUSIGN_CONNECT_HMAC_SECRET');
 if(!secret||!docuSignConfigured())return reply({error:'DocuSign not configured'},503);
 const text=await req.text();
 if(text.length>1_000_000)return reply({error:'Payload too large'},413);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)));
 const signatures=Array.from({length:4},(_,i)=>req.headers.get('x-docusign-signature-'+(i+1))).filter(Boolean);
 if(!signatures.some(s=>constantTimeEqual(signature,fromBase64(s!))))return reply({error:'Invalid DocuSign signature'},401);
 let body:any;try{body=JSON.parse(text);}catch{return reply({error:'Invalid JSON'},400);}
 const event=String(body.event||'');
 const id=body.data?.envelopeId,account=body.data?.accountId;
 if(!allowed.includes(event))return reply({ignored:true});
 if(!guid(id)||account!==Deno.env.get('DOCUSIGN_ACCOUNT_ID'))return reply({error:'Envelope account mismatch'},403);
 const base=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!service)return reply({error:'Backend unavailable'},503);
 const db=createClient(base,service);
 const {data:envelope,error:loadError}=await db.from('booking_agreements')
  .select('id,booking_id,status,signer_host_id,signer_guest_id,provider_envelope_id')
  .eq('provider_envelope_id',id).maybeSingle();
 if(loadError)return reply({error:'Agreement lookup unavailable'},503);
 if(!envelope)return reply({ignored:true,note:'Unknown envelope'});
 const hash=await sha256(new TextEncoder().encode(text));
 const {data:prior}=await db.from('booking_docusign_events').select('id,processed_at')
  .eq('provider_event_hash',hash).maybeSingle();
 if(prior?.processed_at)return reply({ok:true,duplicate:true});
 if(!prior){
  const {error:queueError}=await db.from('booking_docusign_events').insert({
   provider_event_hash:hash,envelope_id:id,booking_id:envelope.booking_id,event_status:event
  });
  if(queueError)return reply({error:'Event could not be recorded'},503);
 }
 try{
  const remote=await docuSignFetch('/envelopes/'+encodeURIComponent(id));
  const details=await remote.json();
  if(details.envelopeId!==id)return reply({error:'Provider envelope mismatch'},503);
  if(event==='envelope-completed'){
   if(details.status!=='completed')return reply({error:'DocuSign completion not yet confirmed'},503);
   const {data:booking}=await db.from('property_booking_requests')
    .select('id,status,legal_status').eq('id',envelope.booking_id).maybeSingle();
   if(booking?.status!=='accepted'){
    await db.from('hosting_provider_reconciliation').upsert({
     provider:'docusign',entity_id:envelope.id,issue:'completion_after_booking_cancelled',status:'pending'
    },{onConflict:'provider,entity_id,issue'});
    return reply({error:'Signed envelope needs manual reconciliation because booking is not accepted'},503);
   }
   const [hostAccount,guestAccount,recipients]=await Promise.all([
    db.auth.admin.getUserById(envelope.signer_host_id),
    db.auth.admin.getUserById(envelope.signer_guest_id),
    docuSignFetch('/envelopes/'+encodeURIComponent(id)+'/recipients')
   ]);
   if(hostAccount.error||guestAccount.error||!hostAccount.data.user?.email||!guestAccount.data.user?.email)
    return reply({error:'Signers unavailable'},503);
   const recipientsPayload=await recipients.json();
   const signed=recipientsPayload.signers||[];
   for(const email of [hostAccount.data.user.email,guestAccount.data.user.email]){
    if(!signed.some((r:any)=>r.email?.toLowerCase()===email.toLowerCase()&&
     ['completed','signed'].includes(r.status?.toLowerCase())))return reply({error:'Expected signer not confirmed'},503);
   }
   const [document,certificate]=await Promise.all([
    docuSignFetch('/envelopes/'+encodeURIComponent(id)+'/documents/combined',{headers:{accept:'application/pdf'}}),
    docuSignFetch('/envelopes/'+encodeURIComponent(id)+'/documents/certificate',{headers:{accept:'application/pdf'}})
   ]);
   const pdf=new Uint8Array(await document.arrayBuffer()),cert=new Uint8Array(await certificate.arrayBuffer());
   if(pdf.length<200||cert.length<200||pdf.length>15_000_000||cert.length>15_000_000)
    return reply({error:'Invalid signed document or certificate'},503);
   const storage=db.storage.from('signed-agreements');
   const directory='hosting/'+envelope.booking_id+'/'+id;
   const pdfPath=directory+'/signed.pdf',certificatePath=directory+'/certificate.pdf';
   const [pdfDigest,certDigest]=await Promise.all([sha256(pdf),sha256(cert)]);
   const [uploadedPdf,uploadedCert]=await Promise.all([
    storage.upload(pdfPath,pdf,{contentType:'application/pdf',upsert:false}),
    storage.upload(certificatePath,cert,{contentType:'application/pdf',upsert:false})
   ]);
   // Provider callbacks are retried; already archived files may be reused.
   for(const [result,path] of [[uploadedPdf,pdfPath],[uploadedCert,certificatePath]] as const){
    if(result.error){
     const info=await storage.info(path);
     if(info.error||!info.data)return reply({error:'Evidence archiving failed'},503);
    }
   }
   const {error:saveError}=await db.from('booking_agreements').update({
    status:'completed',completed_at:new Date().toISOString(),
    signed_pdf_path:pdfPath,certificate_path:certificatePath,
    signed_pdf_sha256:pdfDigest,certificate_sha256:certDigest
   }).eq('id',envelope.id);
   if(saveError)return reply({error:'Evidence metadata could not be archived'},503);
   const {error:bookingError}=await db.from('property_booking_requests')
    .update({legal_status:'signed'}).eq('id',envelope.booking_id).eq('status','accepted');
   if(bookingError)return reply({error:'Booking signing status not updated'},503);
   const {data:parties}=await db.from('property_booking_requests')
    .select('owner_id,requester_id').eq('id',envelope.booking_id).maybeSingle();
   if(parties)for(const uid of [parties.owner_id,parties.requester_id]){
    await db.from('member_notifications').insert({
      recipient_id:uid,kind:'hosting_signature',title:'Location agreement signed',
      details:{booking_id:envelope.booking_id}
    });
   }
  }else if(['envelope-voided','envelope-declined'].includes(event)){
   if(envelope.status!=='completed'){
    await db.from('booking_agreements').update({status:event==='envelope-voided'?'voided':'declined'})
     .eq('id',envelope.id).neq('status','completed');
    await db.from('property_booking_requests').update({legal_status:'voided'})
     .eq('id',envelope.booking_id).neq('legal_status','signed');
   }
  }else if(event==='envelope-delivered'&&envelope.status==='sent'){
   await db.from('booking_agreements').update({status:'delivered'}).eq('id',envelope.id).eq('status','sent');
  }
  await db.from('booking_docusign_events').update({processed_at:new Date().toISOString()})
   .eq('provider_event_hash',hash);
  return reply({ok:true});
 }catch(error){
  console.error('DocuSign webhook reconciliation required',error);
  return reply({error:'Provider event not yet reconciled'},503);
 }
});
