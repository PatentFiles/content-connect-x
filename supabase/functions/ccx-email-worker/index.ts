/** Durable service-only notification processor. With the provider disabled,
 * it never reads jobs or sends mail. A generic template prevents leaking
 * message bodies, medical records, age documents and private reports.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {optedIn,retryAfter,resendRequest,safeSender,uuid} from './deliveryPolicy.mjs';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const same=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64||!/^[a-f0-9]{128}$/i.test(a+b))return false;
 let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
};
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),role=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!role)return reply({error:'Service unavailable'},503);
 const db=createClient(url,role);
 // Dedicated secret is independent from service_role and membership JWTs.
 const {data:workerSecret,error:secretError}=await db.rpc('ccx_secret_get',{p_name:'ccx_email_worker_key'});
 if(secretError||!same(workerSecret,req.headers.get('x-ccx-worker-key')))return reply({error:'Unauthorized'},401);
 const [{data:integration,error:providerError},{data:token},{data:sender}]=await Promise.all([
  db.from('ccx_integrations').select('enabled').eq('provider','email').maybeSingle(),
  db.rpc('ccx_secret_get',{p_name:'email_api_token'}),
  db.rpc('ccx_secret_get',{p_name:'email_sender'})
 ]);
 if(providerError||integration?.enabled!==true||!token||!safeSender(sender)){
  return reply({enabled:false,delivered:0,note:'Transactional email provider not configured'},200);
 }
 const {data:jobs,error:claimError}=await db.rpc('ccx_email_claim',{p_limit:8});
 if(claimError)return reply({error:'Queue unavailable'},503);
 let sent=0,skipped=0,retried=0,failed=0;
 for(const job of Array.isArray(jobs)?jobs:[]){
  const id=job.notification_id;
  if(!uuid(id)||!Number.isSafeInteger(Number(job.msg_id)))continue;
  const complete=async(outcome,remote=null,reason=null)=>{
   const {data,error}=await db.rpc('ccx_email_finish',{
    p_notification_id:id,p_msg_id:job.msg_id,p_outcome:outcome,
    p_remote_id:remote,p_reason:reason,p_retry_seconds:retryAfter(Number(job.read_ct)||1)
   });
   if(error)throw Error('Delivery checkpoint could not be committed');
   return data;
  };
  try{
   const {data:notice,error:noticeError}=await db.from('member_notifications')
    .select('id,recipient_id,kind').eq('id',id).maybeSingle();
   if(noticeError)throw Error('Notification lookup unavailable');
   if(!notice){await complete('skipped');skipped++;continue;}
   const [pref,security,user]=await Promise.all([
    db.from('member_notification_preferences').select('transactional_email,message_alerts,booking_reminders').eq('user_id',notice.recipient_id).maybeSingle(),
    db.from('account_security').select('banned,suspended').eq('user_id',notice.recipient_id).maybeSingle(),
    db.auth.admin.getUserById(notice.recipient_id)
   ]);
   if(pref.error||security.error||user.error)throw Error('Recipient authorization unavailable');
   if(!optedIn(pref.data,security.data,notice.kind)||!user.data?.user?.email||!user.data.user.email_confirmed_at){
    await complete('skipped');skipped++;continue;
   }
   const payload=resendRequest(id,sender,user.data.user.email,Deno.env.get('CCX_PUBLIC_ORIGIN')||'https://contentconnectx.com');
   const res=await fetch('https://api.resend.com/emails',{
    method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':'ccx-account-notice-'+id},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(9000)
   });
   if(!res.ok){
    // No response bodies or email addresses in logs.
    if(res.status===429||res.status>=500||res.status===409)throw Error('Transient email provider status '+res.status);
    await complete('failed',null,'Provider HTTP '+res.status);failed++;continue;
   }
   const answer=await res.json().catch(()=>({}));
   await complete('sent',typeof answer.id==='string'?answer.id.slice(0,120):null);sent++;
  }catch{
   try{
    const status=await complete('retry',null,'Temporary delivery failure');
    if(status?.status==='failed')failed++;else retried++;
   }catch{/* Claim expires and is retried; no loss of queue message. */}
  }
 }
 return reply({sent,skipped,retried,failed,accepted_is_not_delivery:true});
});
