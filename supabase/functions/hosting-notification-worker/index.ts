import {isSupportedPushEndpoint} from './pushPolicy.mjs';
/** Authenticated, leased, retryable notifications. Provider acceptance is not inbox delivery. */
import {optionalProviderSetting} from './providerConfig.mjs';
import {validJobBearer} from './jobAuth.mjs';
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import webpush from 'npm:web-push@3.6.7';
const reply=(body:unknown,status=200)=>Response.json(body,{status});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!await validJobBearer(req.headers.get('Authorization'),Deno.env.get('HOSTING_NOTIFIER_JOB_SECRET')))
  return reply({error:'Unauthorized job'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return reply({error:'Backend not configured'},503);
 const db=createClient(url,key);
 const email=optionalProviderSetting('HOSTING_EMAIL_PROVIDER_ENABLED')==='true'&&Boolean(optionalProviderSetting('HOSTING_EMAIL_API_URL')&&optionalProviderSetting('HOSTING_EMAIL_FROM')&&Deno.env.get('HOSTING_EMAIL_API_TOKEN'));
 const push=optionalProviderSetting('HOSTING_PUSH_PROVIDER_ENABLED')==='true'&&Boolean(Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')&&Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')&&optionalProviderSetting('WEB_PUSH_SUBJECT'));
 const channels=[...(email?['email']:[]),...(push?['push']:[])];
 if(!channels.length)return reply({error:'No approved notification provider configured'},503);
 let accepted=0,failed=0,skipped=0;
 try{
  if(push)webpush.setVapidDetails(optionalProviderSetting('WEB_PUSH_SUBJECT')!,Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')!,Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')!);
  // Small bounded batch. SKIP LOCKED and a lease token prevent competing workers
  // from delivering the same live claim; abandoned claims are recovered later.
  const {data:jobs,error}=await db.rpc('ccx_claim_hosting_notifications',{p_channels:channels,p_limit:3});
  if(error)return reply({error:'Notification claim unavailable'},503);
  for(const job of jobs||[]){
   const finish=async(status:string,remote:string|null=null)=>{
    const {data,error:saveError}=await db.rpc('ccx_finish_hosting_notification',{
      p_id:job.id,p_lease:job.lease_token,p_status:status,p_remote:remote
    });
    if(saveError||data!==true)throw Error('Notification state could not be recorded');
   };
   try{
    const [prefs,security]=await Promise.all([
      db.from('member_notification_preferences').select('email_digest,booking_reminders,message_alerts').eq('user_id',job.recipient_id).maybeSingle(),
      db.from('account_security').select('banned,suspended').eq('user_id',job.recipient_id).maybeSingle()
    ]);
    if(prefs.error||security.error)throw Error('Recipient preferences unavailable');
    const template=String(job.template||'');
    if(!security.data||security.data.banned||security.data.suspended||
      template.includes('reminder')&&prefs.data?.booking_reminders===false||
      template.includes('message')&&prefs.data?.message_alerts===false||
      template.includes('digest')&&prefs.data?.email_digest!==true){
     await finish('disabled');skipped++;continue;
    }
    let remote=job.id;
    if(job.channel==='email'){
     const {data,error:addressError}=await db.auth.admin.getUserById(job.recipient_id);
     if(addressError||!data.user?.email)throw Error('Recipient unavailable');
     const target=new URL(optionalProviderSetting('HOSTING_EMAIL_API_URL')!);
     if(target.protocol!=='https:'||target.username||target.password||!target.hostname.includes('.'))throw Error('Invalid notification endpoint');
     const response=await fetch(target,{method:'POST',redirect:'error',headers:{
      'content-type':'application/json','authorization':'Bearer '+Deno.env.get('HOSTING_EMAIL_API_TOKEN'),
      'Idempotency-Key':job.event_key
     },body:JSON.stringify({from:optionalProviderSetting('HOSTING_EMAIL_FROM'),to:data.user.email,
       subject:'Content Connect X account update',text:'You have a new private account update. Sign in to view details.',reference_id:job.event_key}),
       signal:AbortSignal.timeout(8000)});
     if(!response.ok)throw Error('Email provider rejected delivery');
     remote=response.headers.get('x-message-id')||job.id;
    }else{
     const {data:devices,error:deviceError}=await db.from('hosting_push_subscriptions').select('id,endpoint,p256dh,auth_secret').eq('user_id',job.recipient_id).limit(12);
     if(deviceError)throw deviceError;
     if(!devices?.length){await finish('disabled');skipped++;continue;}
     const results=await Promise.all(devices.map(async(device:any)=>{
      try{
       if(!isSupportedPushEndpoint(device.endpoint))return false;
       const ack=await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth_secret}},
        JSON.stringify({title:'Content Connect X account update',event_id:job.event_key,url:'/Notifications'}),{TTL:1800,timeout:8000});
       return ack.statusCode>=200&&ack.statusCode<300;
      }catch(e){
       if([404,410].includes(Number((e as any)?.statusCode)))await db.from('hosting_push_subscriptions').delete().eq('id',device.id);
       return false;
      }
     }));
     if(!results.some(Boolean))throw Error('No push service accepted notification');
    }
    await finish('delivered',remote);accepted++;
   }catch{
    failed++;
    // Retain lease protection even if the external service responded before the
    // DB failed. Email providers must honor Idempotency-Key for duplicate defense.
    try{await finish('failed');}catch{/* Expiry recovers this claim on a later run. */}
   }
  }
  return reply({accepted,failed,skipped,note:'Accepted counts provider acknowledgement, not guaranteed end-user delivery.'});
 }catch{return reply({error:'Notification worker unavailable'},503);}
});
