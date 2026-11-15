/** Administrative age verification review. All privileged operations check trusted database roles. */
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key||!secret)return respond({error:'Service unavailable'},503);
  const client=createClient(url,key,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return respond({error:'Unauthorized'},401);
  const admin=createClient(url,secret);
  const {data:role,error:roleError}=await admin.from('account_security').select('admin,banned,suspended').eq('user_id',user.id).maybeSingle();
  if(roleError||!role?.admin||role.banned||role.suspended)return respond({error:'Forbidden'},403);
  const body=await req.json().catch(()=>({}));
  if(body.action==='list'){
    const {data, error}=await admin.from('age_verification_requests').select('id,user_id,status,provider,created_at,verified_at,expires_at,reviewed_at').order('created_at',{ascending:false}).limit(100);
    if(error)return respond({error:'Unable to list requests'},500);
    return respond({requests:data});
  }
  if(!['approve','reject','document'].includes(body.action)||typeof body.request_id!=='string')return respond({error:'Invalid request'},400);
  const {data:record,error:findError}=await admin.from('age_verification_requests').select('id,user_id,status,id_document_path,selfie_document_path').eq('id',body.request_id).maybeSingle();
  if(findError||!record)return respond({error:'Not found'},404);
  if(body.action==='document'){
    if(record.status!=='pending'&&record.status!=='approved'&&record.status!=='rejected')return respond({error:'Invalid status'},400);
    const path=body.document_type==='id'?record.id_document_path:body.document_type==='selfie'?record.selfie_document_path:null;
    if(!path)return respond({error:'Unknown document'},400);
    const {data,error}=await admin.storage.from('age-verification').createSignedUrl(path,120);
    if(error)return respond({error:'Could not open document'},500);
    await admin.from('platform_action_audit').insert({actor_id:user.id,action:'view_age_document',target_type:'age_verification',target_id:record.id,metadata:{document_type:body.document_type}});
    return respond({url:data.signedUrl,expires_in:120});
  }
  if(record.status!=='pending')return respond({error:'Request already resolved'},409);
  // Explicit human 18+ determination is required before approval.
  if(body.action==='approve' && body.age_confirmed!==true)return respond({error:'Reviewer must confirm age 18 or older'},400);
  const status=body.action==='approve'?'approved':'rejected';
  const now=new Date().toISOString();
  const {data,error}=await admin.from('age_verification_requests').update({status,reviewer_id:user.id,reviewed_at:now,verified_at:status==='approved'?now:null}).eq('id',record.id).eq('status','pending').select('id,status').maybeSingle();
  if(error)return respond({error:'Unable to update request'},500);
  if(!data)return respond({error:'Request updated by another reviewer'},409);
  await admin.from('platform_action_audit').insert({actor_id:user.id,action:'review_age_verification',target_type:'age_verification',target_id:record.id,metadata:{status}});
  return respond(data);
});
