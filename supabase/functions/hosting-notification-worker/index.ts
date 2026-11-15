/**
 * Hosting transactional notifications. This is a server-only, opt-in dispatcher.
 * Generic messages contain no adult content or sensitive booking information.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import webpush from 'npm:web-push@3.6.7';
const reply=(body:unknown,status=200)=>Response.json(body,{status});
const titleByTemplate:Record<string,string>={
 hosting_cancelled:'Booking cancellation',
 hosting_reschedule:'Booking schedule updated',
 hosting_refund:'Refund request update',
 hosting_claim:'Rental damage-claim update',
 hosting_verification:'Host verification update',
 hosting_signature:'Agreement signing update',
 hosting_paid:'Payment status updated',
 hosting_booking:'Booking request update',
};
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const secret=Deno.env.get('HOSTING_NOTIFIER_JOB_SECRET');
 if(!secret||!req.headers.get('Authorization')||req.headers.get('Authorization')!=='Bearer '+secret)
  return reply({error:'Unauthorized job'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return reply({error:'Backend not configured'},503);
 const db=createClient(url,key);
 const emailEnabled=Deno.env.get('HOSTING_EMAIL_PROVIDER_ENABLED')==='true'&&
   Boolean(Deno.env.get('HOSTING_EMAIL_API_URL')&&Deno.env.get('HOSTING_EMAIL_API_TOKEN')&&Deno.env.get('HOSTING_EMAIL_FROM'));
 const pushEnabled=Deno.env.get('HOSTING_PUSH_PROVIDER_ENABLED')==='true'&&
   Boolean(Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')&&Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')&&Deno.env.get('WEB_PUSH_SUBJECT'));
 if(!emailEnabled&&!pushEnabled)return reply({error:'No approved notification provider configured'},503);
 if(pushEnabled)webpush.setVapidDetails(
   Deno.env.get('WEB_PUSH_SUBJECT')!,
   Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')!,
   Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')!
 );
 const result=await db.from('hosting_notification_outbox')
  .select('id,event_key,recipient_id,channel,template,payload,attempts')
  .in('status',['queued','failed']).lte('next_attempt_at',new Date().toISOString())
  .lt('attempts',5).order('created_at').limit(35);
 if(result.error)return reply({error:'Queue unavailable'},503);
 let delivered=0,failed=0,skipped=0;
 for(const job of result.data||[]){
  if(job.channel==='email'&&!emailEnabled||job.channel==='push'&&!pushEnabled){skipped++;continue;}
  const {data:lock,error:lockError}=await db.from('hosting_notification_outbox')
   .update({status:'processing',attempts:job.attempts+1}).eq('id',job.id)
   .in('status',['queued','failed']).select('id').maybeSingle();
  if(lockError||!lock)continue;
  try{
   const {data:preferences}=await db.from('member_notification_preferences')
     .select('email_digest,booking_reminders,message_alerts').eq('user_id',job.recipient_id).maybeSingle();
   const bookingReminder=job.template.includes('reminder');
   if(bookingReminder&&preferences?.booking_reminders===false){
    await db.from('hosting_notification_outbox').update({status:'disabled'}).eq('id',job.id);
    continue;
   }
   const title=titleByTemplate[job.template]||'Content Connect X account update';
   const message='You have a new private booking update in Content Connect X. Sign in to view details.';
   let identifier='sent';
   if(job.channel==='email'){
    const address=await db.auth.admin.getUserById(job.recipient_id);
    if(address.error||!address.data.user?.email)throw Error('Account email missing');
    const destination=Deno.env.get('HOSTING_EMAIL_API_URL')!;
    const target=new URL(destination);
    if(target.protocol!=='https:'||target.username||target.password||!target.hostname.includes('.'))
     throw Error('Unapproved HTTPS notification endpoint');
    // Endpoint must implement the documented CCX generic JSON notification contract.
    // Configure it only with a provider that has accepted the platform's use case.
    const sent=await fetch(target.toString(),{
      method:'POST',headers:{'content-type':'application/json',
        authorization:'Bearer '+Deno.env.get('HOSTING_EMAIL_API_TOKEN')!},
      body:JSON.stringify({from:Deno.env.get('HOSTING_EMAIL_FROM'),to:address.data.user.email,
        subject:title,text:message,reference_id:job.event_key}),
      signal:AbortSignal.timeout(12000)
    });
    if(!sent.ok)throw Error('Email delivery gateway returned '+sent.status);
    identifier=sent.headers.get('x-message-id')||job.id;
   }else{
    const {data:devices,error:deviceError}=await db.from('hosting_push_subscriptions')
      .select('id,endpoint,p256dh,auth_secret').eq('user_id',job.recipient_id).limit(12);
    if(deviceError)throw deviceError;
    if(!devices?.length){
     await db.from('hosting_notification_outbox').update({status:'disabled'}).eq('id',job.id);
     continue;
    }
    const push=JSON.stringify({title,body:message,url:Deno.env.get('HOSTING_FRONTEND_ORIGIN')||'/'});
    let successes=0;
    for(const device of devices){
     try{
      const ack=await webpush.sendNotification({
       endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth_secret}
      },push,{TTL:1800});
      if(ack.statusCode>=200&&ack.statusCode<300)successes++;
     }catch(e){
      // Remove subscriptions that the browser's push service has invalidated.
      if([404,410].includes(Number((e as any)?.statusCode))){
       await db.from('hosting_push_subscriptions').delete().eq('id',device.id);
      }
     }
    }
    if(successes<1)throw Error('No push device accepted the message');
    identifier=job.id;
   }
   await db.from('hosting_notification_outbox').update({
     status:'delivered',sent_at:new Date().toISOString(),last_error:null
   }).eq('id',job.id);
   await db.from('hosting_notification_delivery_log').insert({
     outbox_id:job.id,delivery_provider:job.channel,remote_message_id:identifier
   });
   delivered++;
  }catch(error){
   failed++;
   const attempts=job.attempts+1;
   const minutes=Math.min(60,2**attempts);
   await db.from('hosting_notification_outbox').update({
     status:'failed',next_attempt_at:new Date(Date.now()+minutes*60000).toISOString(),
     last_error:'Delivery attempt failed'
   }).eq('id',job.id);
   console.error('Hosting notification delivery failed',job.id,String(error).slice(0,130));
  }
 }
 return reply({delivered,failed,skipped});
});
