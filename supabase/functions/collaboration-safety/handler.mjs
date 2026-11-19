/** Voluntary safety self-reports. Never an emergency dispatch system.
 * All member authorization and state changes are enforced by service-only SQL.
 */
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const allowed=new Set(['status','check_in','mark_safe','leave','record_concern']);
const safeStatuses=new Set(['not_started','checked_in','safe','left','concern_recorded']);
const messages={
 SAFETY_NOT_PARTICIPANT:'This safety record is only available to accepted participants.',
 SAFETY_SIGN_IN_REQUIRED:'Sign in to access this check-in.',
 SAFETY_INVALID_ACTION:'Select a supported safety action.',
 SAFETY_OUTSIDE_SCHEDULE:'Check-in is available only around a confirmed scheduled production time.',
 SAFETY_ALREADY_RECORDED:'This check-in has ended. The historical record cannot be reset.',
 SAFETY_NOT_CHECKED_IN:'Check in before marking yourself safe.'
};
async function boundedJson(req){
 const reader=req.body?.getReader();if(!reader)return null;
 const bytes=[];let length=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4096)throw Error('too_large');bytes.push(value);}
 }finally{await reader.cancel().catch(()=>{});}
 const b=new Uint8Array(length);let n=0;for(const x of bytes){b.set(x,n);n+=x.length;}
 try{return JSON.parse(new TextDecoder().decode(b));}catch{return null;}
}
export function createSafetyHandler({authenticate,act}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(Number(req.headers.get('content-length')||0)>4096)return json({error:'Request too large'},413);
  try{
   const user=await authenticate(req);
   if(!user?.id||user.is_anonymous)return json({error:'Sign in required'},401);
   const body=await boundedJson(req);
   if(!body||typeof body!=='object'||Array.isArray(body)||!allowed.has(body.action)||!UUID.test(body.collaboration_id))
    return json({error:'Invalid collaboration or action'},400);
   if(body.contact_informed!==undefined&&typeof body.contact_informed!=='boolean')
    return json({error:'Invalid contact confirmation'},400);
   const {data,error}=await act(user.id,body.collaboration_id,body.action,body.contact_informed===true);
   if(error){
    const key=Object.keys(messages).find(k=>String(error.message||'').includes(k));
    return json({error:key?messages[key]:'Safety check-in is not available. No update was recorded.'},error.code==='42501'?403:error.code==='22023'?409:503);
   }
   if(!data||typeof data!=='object'||data.monitored_emergency_response!==false||!safeStatuses.has(data.status))
    return json({error:'Safety acknowledgement could not be verified. Check status before retrying.'},503);
   // A fixed allowlist prevents future DB metadata, private contact details,
   // location or another member's record from leaking into the response.
   return json({item:{status:data.status,checked_in_at:data.checked_in_at||null,
    marked_safe_at:data.marked_safe_at||null,left_at:data.left_at||null,
    concern_recorded_at:data.concern_recorded_at||null,
    contact_informed_by_member:data.contact_informed_by_member===true,
    can_check_in:data.can_check_in===true,schedule_available:data.schedule_available===true,
    monitored_emergency_response:false}});
  }catch(error){
   if(error?.message==='too_large')return json({error:'Request too large'},413);
   return json({error:'Safety check-in is unavailable. No monitored alert was sent.'},503);
  }
 };
}
