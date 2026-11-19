/** Participant-authored post-production statements only.
 * This endpoint cannot change a contract, consent, booking or another member's
 * record. The authenticated actor is server-derived and rechecked by PostgreSQL.
 */
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const errors={
 ACTUALS_NOT_PARTICIPANT:['Only accepted participants may access this private record.',403],
 ACTUALS_INVALID_ACTION:['Select a supported statement action.',400],
 ACTUALS_INVALID_CONTENT:['Enter a professional work summary between 5 and 4,000 characters.',400],
 ACTUALS_IDEMPOTENCY_REUSED:['This submission reference belongs to a different statement. Refresh and try again.',409],
 ACTUALS_NOT_YET_AVAILABLE:['Completion statements are available only after the production end time. Cancelled projects cannot be confirmed as completed.',409],
 ACTUALS_REVISION_LIMIT:['Too many revisions have been submitted. Contact support.',409]
};
async function bodyJson(request){
 if(Number(request.headers.get('content-length')||0)>16384)throw Error('too_large');
 if(!request.body)return null;
 const reader=request.body.getReader();let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)throw Error('too_large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const data=new Uint8Array(size);let offset=0;for(const v of chunks){data.set(v,offset);offset+=v.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(data));}catch{return null;}
}
function publicStatement(row){
 if(!row||typeof row!=='object')return null;
 return {id:row.id,collaboration_id:row.collaboration_id,actor_id:row.actor_id,
  revision:row.revision,plan_version:row.plan_version,
  work_completed:row.work_completed,deliverables_completed:row.deliverables_completed,
  differences_or_concerns:row.differences_or_concerns,recorded_at:row.recorded_at};
}
export function createActualsHandler({authenticate,call}){
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
   const user=await authenticate(request);
   if(!user?.id||user.is_anonymous)return reply({error:'Sign in required'},401);
   const body=await bodyJson(request);
   if(!body||typeof body!=='object'||Array.isArray(body)||!UUID.test(body.collaboration_id)
      || !['list','submit'].includes(body.action))return reply({error:'Invalid collaboration or action'},400);
   if(body.action==='submit'&&(!UUID.test(body.idempotency_key)
      ||typeof body.work_completed!=='string'||body.work_completed.trim().length<5
      ||body.work_completed.length>4000
      ||typeof body.deliverables_completed!=='string'||body.deliverables_completed.length>4000
      ||typeof body.differences_or_concerns!=='string'||body.differences_or_concerns.length>4000))
     return reply({error:'Complete the professional summary and check field lengths.'},400);
   const {data,error}=await call({
     p_actor:user.id,p_collaboration:body.collaboration_id,p_action:body.action,
     p_idempotency:body.action==='submit'?body.idempotency_key:null,
     p_work:body.action==='submit'?body.work_completed:null,
     p_deliverables:body.action==='submit'?body.deliverables_completed:'',
     p_differences:body.action==='submit'?body.differences_or_concerns:''
   });
   if(error){
    const key=Object.keys(errors).find(code=>String(error.message||'').includes(code));
    const [msg,status]=key?errors[key]:['The private completion record could not be loaded or saved.',503];
    return reply({error:msg},status);
   }
   if(body.action==='list'&&Array.isArray(data?.statements))
    return reply({statements:data.statements.map(publicStatement).filter(Boolean)});
   if(body.action==='submit'&&data?.statement&&typeof data.replayed==='boolean')
    return reply({statement:publicStatement(data.statement),replayed:data.replayed});
   return reply({error:'The completion record could not be confirmed.'},503);
  }catch(error){
   return reply({error:error?.message==='too_large'?'Request too large.':'Completion statements are temporarily unavailable.'},error?.message==='too_large'?413:503);
  }
 };
}
