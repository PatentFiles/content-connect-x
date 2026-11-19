import {validateTrustRequest} from './policy.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function boundedJson(req){
 const reader=req.body?.getReader();if(!reader)throw Error('A request body is required.');
 const chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16000)throw Error('Request too large.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('Invalid request format.');}
}
export function createTrustIntakeHandler({submit,rateKey}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  let request;
  try{request=validateTrustRequest(await boundedJson(req));}catch(e){return json({error:e.message},400);}
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
