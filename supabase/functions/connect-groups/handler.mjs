/** Verified adult groups: public discovery only after site review;
 * private groups never appear in search. Membership changes are atomic RPCs.
 */
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const actions=new Set(['discover','mine','detail','create','apply','invite','accept','decline','approve','deny','remove','promote','demote','leave','requests','members','admin_queue','moderate']);
const errors={
 GROUP_NOT_VERIFIED:[403,'Complete verified adult onboarding before using groups.'],
 GROUP_NOT_FOUND:[404,'This group is unavailable or private.'],
 GROUP_PREMIUM_REQUIRED:[403,'Premium is required to create a group.'],
 GROUP_CREATE_LIMIT:[429,'You have reached the group creation limit.'],
 GROUP_INVALID_FIELDS:[400,'Enter a group title of 3–100 characters and valid description and rules.'],
 GROUP_UNAVAILABLE:[403,'Group membership is not open until the group is approved.'],
 GROUP_INVITE_ONLY:[403,'Private groups can be joined only through an invitation.'],
 GROUP_TARGET_UNAVAILABLE:[403,'This invitation cannot be sent to that member.'],
 GROUP_MEMBERSHIP_EXISTS:[409,'This member has a pending or existing group relationship.'],
 GROUP_REQUEST_NOT_PENDING:[409,'There is no pending request for that member.'],
 GROUP_NO_INVITATION:[403,'A valid personal invitation is required.'],
 GROUP_NO_REQUEST:[409,'There is no request or invitation to decline.'],
 GROUP_CANNOT_REMOVE:[403,'You cannot remove this member under your group permissions.'],
 GROUP_OWNER_ONLY:[403,'Only the group owner may change administrator roles.'],
 GROUP_ADMIN_REQUIRED:[403,'Group administrator permission is required.'],
 GROUP_INVALID_TARGET:[400,'Select another verified member.'],
 GROUP_OWNER_TRANSFER_REQUIRED:[409,'The group owner must transfer ownership before leaving.'],
 GROUP_INVALID_REVIEW:[409,'This public group is no longer awaiting platform review.'],
 GROUP_INVALID_ACTION:[400,'Unsupported group action.'],
 GROUP_REJOIN_REQUIRES_INVITE:[403,'This group requires a new administrator invitation before you can rejoin.']
};
async function parse(req){
 if(Number(req.headers.get('content-length')||0)>9000)throw Error('too_large');
 const reader=req.body?.getReader();if(!reader)return null;
 const parts=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>9000)throw Error('too_large');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const b=new Uint8Array(bytes);let n=0;for(const part of parts){b.set(part,n);n+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(b));}catch{return null;}
}
export function createGroupHandler({authenticate,assurance=async()=>null,db}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
   const user=await authenticate(req);
   if(!user?.id||user.is_anonymous)return reply({error:'Sign in required'},401);
   const body=await parse(req);
   if(!body||typeof body!=='object'||Array.isArray(body)||!actions.has(body.action))return reply({error:'Invalid group request.'},400);
   const action=body.action;
   if(['admin_queue','moderate'].includes(action)&&await assurance(req)!=='aal2')
    return reply({error:'Complete administrator two-factor authentication before moderating groups.'},403);
   if(action==='moderate'&&!['approve','reject'].includes(body.decision))return reply({error:'Choose approve or reject.'},400);
   const groupId=uuid(body.group_id)?body.group_id:null;
   if(!['discover','mine','create','admin_queue'].includes(action)&&!groupId)
    return reply({error:'Choose a valid group.'},400);
   const target=['invite','approve','deny','remove','promote','demote'].includes(action)?(uuid(body.target_user_id)?body.target_user_id:null):null;
   if(['invite','approve','deny','remove','promote','demote'].includes(action)&&!target)
    return reply({error:'Choose a valid member.'},400);
   if(action==='create'&&(!['public','private'].includes(body.visibility)||
      typeof body.name!=='string'||body.name.trim().length<3||body.name.length>100
      ||typeof body.description!=='string'||body.description.length>1000
      ||typeof body.rules!=='string'||body.rules.length>1500))
    return reply({error:'Complete the group name, privacy, description and rules.'},400);
   const args={p_actor:user.id,p_action:action,p_group:groupId,p_target:target,
    p_name:action==='create'?body.name:null,p_description:action==='create'?body.description:null,
    p_visibility:action==='create'?body.visibility:action==='moderate'&&['approve','reject'].includes(body.decision)?body.decision:null,
    p_rules:action==='create'?body.rules:null,
    p_query:action==='discover'&&typeof body.query==='string'?body.query.slice(0,60):null};
   const {data,error}=await db.rpc('ccx_group_action',args);
   if(error){
    const key=Object.keys(errors).find(code=>String(error.message||'').includes(code));
    const [message,status]=key?errors[key]:['Group operation could not be completed. Check your permissions and retry.',503];
    return reply({error:message},status);
   }
   if(!data||typeof data!=='object')return reply({error:'Group result could not be confirmed.'},503);
   if(action==='create')return reply({item:{id:data.id,state:data.state},note:data.state==='pending_platform'?
      'Your public group is awaiting platform review and cannot be searched or joined yet.':'Your private group was created. Only invited members can see it.'},201);
   if(action==='moderate')return reply({item:{id:data.id,state:data.state}});
   if(['discover','mine','requests','members','admin_queue'].includes(action))
    return reply({items:Array.isArray(data.items)?data.items:[]});
   if(action==='detail')return reply({group:data.group});
   return reply({status:data.status});
  }catch(error){return reply({error:error?.message==='too_large'?'Request too large.':'Groups are temporarily unavailable.'},error?.message==='too_large'?413:503);}
 };
}