import {validateTrustRequest,validateTrustStatus} from './policy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const PUBLIC_STATUS_MESSAGE=Object.freeze({pending:'Your report is recorded and awaiting review.',reviewing:'Your report is under review.',action_required:'The report requires further action by the review team.',resolved:'The report has been marked resolved. Contact support with the reference if you need more information or wish to appeal.'});
async function boundedJson(req){
 const reader=req.body?.getReader();if(!reader)throw Error('A request body is required.');
 const chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16000)throw Error('Request too large.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('Invalid request format.');}
}
export function createTrustIntakeHandler({submit,rateKey,status}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  let raw,request;
  try{raw=await boundedJson(req);}catch(e){return json({error:e.message},400);}
  if(raw?.action==='status'){
   let lookup;
   try{lookup=validateTrustStatus(raw);}catch(e){return json({error:e.message},400);}
   if(typeof status!=='function')return json({error:'Private status lookup is not configured.'},503);
   try{
    const key=await rateKey(req);
    const {data,error}=await status(lookup.reference,lookup.accessCode,key);
    if(error){
     if(error.code==='54000')return json({error:'Too many status checks. Try again later.'},429);
     return json({error:'Status could not be checked. Try again later.'},503);
    }
    if(data?.verified!==true)return json({error:'The reference and private code could not be verified.'},404);
    const allowed=new Set(['pending','reviewing','action_required','resolved']);
    if(!allowed.has(data.status))return json({error:'Status is temporarily unavailable.'},503);
    // A verified capability can access the public-safe status only.
    return json({verified:true,status:data.status,message:PUBLIC_STATUS_MESSAGE[data.status],
     created_at:data.created_at||null,updated_at:data.updated_at||null});
   }catch{return json({error:'Status could not be checked. Try again later.'},503);}
  }
  try{request=validateTrustRequest(raw);}catch(e){return json({error:e.message},400);}
  try{
   const key=await rateKey(req);
   const {data,error}=await submit(request.payload,key,request.idempotency);
   if(error){
    if(error.code==='55000')return json({error:'Request intake is not activated. Nothing has been submitted.'},503);
    if(error.code==='54000')return json({error:'Request limit reached. Use the published contact channel.'},429);
    return json({error:'The request could not be recorded. Keep your text and try again.'},503);
   }
   if(data?.received!==true||typeof data.reference!=='string')return json({error:'No receipt was confirmed. Keep your text and try again.'},503);
   return json({received:true,reference:data.reference},201);
  }catch{return json({error:'The request could not be recorded. Keep your text and try again.'},503);}
 };
}
