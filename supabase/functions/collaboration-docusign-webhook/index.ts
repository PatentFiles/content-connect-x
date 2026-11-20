/** DocuSign Connect completion receiver. Authenticates HMAC over exact bytes and independently
 * checks the DocuSign envelope before archiving signed PDF, certificate, and individual signatures.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {providerFetch,providerSettings} from '../agreement-packets/docuSignProvider.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const guid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;};
const unbase=s=>{try{return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}catch{return new Uint8Array();}};
async function hash(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
async function archive(db,path,bytes){
 if(bytes.length<10||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('DocuSign did not return a PDF');
 const {error}=await db.storage.from('signed-agreements').upload(path,bytes,{contentType:'application/pdf',upsert:false});
 if(error){
  const {data:objects, error:check}=await db.storage.from('signed-agreements').list(path.split('/').slice(0,-1).join('/'),{search:path.split('/').at(-1)});
  if(check||!objects?.some(f=>f.name===path.split('/').at(-1)))throw error;
 }
}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!service)return reply({error:'Backend unavailable'},503);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const cfg=await providerSettings(db);
 if(!cfg.accountId||!cfg.hmac)return reply({error:'DocuSign signing credentials unavailable'},503);
 const raw=await req.text();
 if(raw.length>500000)return reply({error:'Webhook payload too large'},413);
 const signatures=Array.from({length:4},(_,i)=>req.headers.get('x-docusign-signature-'+(i+1))).filter(Boolean);
 const hkey=await crypto.subtle.importKey('raw',new TextEncoder().encode(cfg.hmac),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=new Uint8Array(await crypto.subtle.sign('HMAC',hkey,new TextEncoder().encode(raw)));
 if(!signatures.some(x=>same(expected,unbase(x))))return reply({error:'Invalid DocuSign signature'},401);
 let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid callback'},400);}
 const envelopeId=body?.data?.envelopeId,accountId=body?.data?.accountId;
 if(!guid(envelopeId)||accountId!==cfg.accountId)return reply({error:'DocuSign account mismatch'},403);
 const type=String(body?.event||'').toLowerCase();
 if(!['envelope-completed','envelope-voided','envelope-declined','envelope-delivered'].includes(type))return reply({ignored:true});
 const {data:packet,error:lookupError}=await db.from('signature_envelopes')
  .select('id,contract_id,collaboration_id,status,provider_envelope_id')
  .eq('provider_envelope_id',envelopeId).maybeSingle();
 if(lookupError)return reply({error:'Packet lookup unavailable'},503);
 if(!packet)return reply({ignored:true});
 const eventHash=await hash(new TextEncoder().encode(raw));
 const {data:prior}=await db.from('ccx_signature_provider_events')
  .select('id,processed_at').eq('event_hash',eventHash).maybeSingle();
 if(prior?.processed_at)return reply({ok:true,duplicate:true});
 if(!prior){
  const {error:insertError}=await db.from('ccx_signature_provider_events')
   .insert({envelope_id:packet.id,event_hash:eventHash,event_type:type});
  if(insertError)return reply({error:'Callback record unavailable'},503);
 }
 try{
  const remote=await providerFetch(db,'/envelopes/'+encodeURIComponent(envelopeId));
  const details=await remote.json();
  if(details.envelopeId!==envelopeId)return reply({error:'Provider envelope mismatch'},503);
  if(type==='envelope-completed'){
   if(details.status!=='completed')return reply({error:'DocuSign has not confirmed completion'},503);
   if(packet.status!=='completed'){
    const [pdf,cert,recipientResponse]=await Promise.all([
     providerFetch(db,'/envelopes/'+encodeURIComponent(envelopeId)+'/documents/combined',{headers:{Accept:'application/pdf'}}),
     providerFetch(db,'/envelopes/'+encodeURIComponent(envelopeId)+'/documents/certificate',{headers:{Accept:'application/pdf'}}),
     providerFetch(db,'/envelopes/'+encodeURIComponent(envelopeId)+'/recipients')
    ]);
    const signed=new Uint8Array(await pdf.arrayBuffer()),certificate=new Uint8Array(await cert.arrayBuffer());
    const recipients=await recipientResponse.json();
    const folder='collaborations/'+packet.collaboration_id+'/'+envelopeId;
    const pdfPath=folder+'/signed-agreement.pdf',certificatePath=folder+'/certificate.pdf';
    await archive(db,pdfPath,signed);await archive(db,certificatePath,certificate);
    const documentHash=await hash(signed),certificateHash=await hash(certificate);
    const completedAt=details.completedDateTime||new Date().toISOString();
    const {error:updateError}=await db.from('signature_envelopes').update({
     status:'completed',completed_at:completedAt,completed_document_path:pdfPath,certificate_path:certificatePath,
     completed_document_sha256:documentHash,certificate_sha256:certificateHash,last_provider_event_at:new Date().toISOString()
    }).eq('id',packet.id).neq('status','completed');
    if(updateError)throw updateError;
    for(const signer of [...(recipients.signers||[])]){
     const providerId=String(signer.recipientId||'');
     const {data:row}=await db.from('signature_packet_recipients').select('member_id,role')
      .eq('envelope_id',packet.id).eq('provider_recipient_id',providerId).maybeSingle();
     if(!row||!['signer','approver'].includes(row.role)||signer.status!=='completed')continue;
     await db.from('signature_packet_recipients').update({status:'signed',signed_at:signer.signedDateTime||completedAt})
      .eq('envelope_id',packet.id).eq('member_id',row.member_id);
     const {error:signatureError}=await db.from('contract_signatures').upsert({
      contract_id:packet.contract_id,signer_id:row.member_id,signed_content_hash:documentHash,accepted_at:signer.signedDateTime||completedAt
     },{onConflict:'contract_id,signer_id',ignoreDuplicates:true});
     if(signatureError)throw signatureError;
    }
    await db.from('contracts').update({status:'signed',locked_at:completedAt}).eq('id',packet.contract_id).eq('status','draft');
    await db.from('signature_packet_audit').insert({envelope_id:packet.id,event_type:'docusign_completed',
     metadata:{provider_envelope_id:envelopeId,pdf_sha256:documentHash,certificate_sha256:certificateHash}});
    const {data:members}=await db.from('collaboration_members').select('user_id').eq('collaboration_id',packet.collaboration_id);
    for(const m of members||[]){
     await db.from('member_notifications').insert({recipient_id:m.user_id,kind:'contract_updates',
      title:'Collaboration agreement signed',details:{envelope_id:packet.id,collaboration_id:packet.collaboration_id}});
    }
   }
  }else if(type==='envelope-declined'||type==='envelope-voided'){
   if(['declined','voided'].includes(details.status)&&packet.status!=='completed'){
    await db.from('signature_envelopes').update({status:details.status,last_provider_event_at:new Date().toISOString()})
      .eq('id',packet.id).neq('status','completed');
    await db.from('signature_packet_audit').insert({envelope_id:packet.id,event_type:'docusign_'+details.status,
     metadata:{provider_envelope_id:envelopeId}});
   }
  }else if(type==='envelope-delivered'&&details.status==='delivered'&&packet.status==='sent'){
   await db.from('signature_envelopes').update({status:'delivered',last_provider_event_at:new Date().toISOString()})
    .eq('id',packet.id).eq('status','sent');
  }
  await db.from('ccx_signature_provider_events').update({processed_at:new Date().toISOString()}).eq('event_hash',eventHash);
  return reply({processed:true});
 }catch(error){
  console.error('Collaboration DocuSign callback reconciliation required',String(error).slice(0,200));
  return reply({error:'Provider event requires retry/reconciliation'},503);
 }
});