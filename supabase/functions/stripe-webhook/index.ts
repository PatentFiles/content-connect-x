import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

// A webhook uses Stripe's raw-body signature, not a browser JWT.
// Without STRIPE_WEBHOOK_SECRET the endpoint is disabled.
const respond=(data,status=200)=>Response.json(data,{status});
const constantEqual=(a,b)=>{
  if(typeof a!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
};
const signatureFor=async(secret,message)=>{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)))].map(v=>v.toString(16).padStart(2,'0')).join('');
};
Deno.serve(async(req)=>{
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  const webhookSecret=Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const url=Deno.env.get('SUPABASE_URL');
  const roleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!webhookSecret||!url||!roleKey)return respond({error:'Webhook not configured'},503);
  const header=req.headers.get('stripe-signature')||'';
  const segments=header.split(',').map(v=>v.trim().split('='));
  const timestamp=segments.find(v=>v[0]==='t')?.[1];
  const signatures=segments.filter(v=>v[0]==='v1').map(v=>v[1]);
  if(!timestamp||!/^\d+$/.test(timestamp)||!signatures.length||Math.abs(Date.now()/1000-Number(timestamp))>300)return respond({error:'Invalid signature'},400);
  const raw=await req.text();
  const expected=await signatureFor(webhookSecret,timestamp+'.'+raw);
  if(!signatures.some(v=>constantEqual(v,expected)))return respond({error:'Invalid signature'},400);
  let event;try{event=JSON.parse(raw);}catch{return respond({error:'Invalid JSON'},400);}
  if(typeof event?.id!=='string'||typeof event?.type!=='string')return respond({error:'Invalid event'},400);
  const db=createClient(url,roleKey);
  const {data:existing,error:lookupError}=await db.from('billing_webhook_events').select('processing_status').eq('provider_event_id',event.id).maybeSingle();
  if(lookupError)return respond({error:'Database unavailable'},503);
  if(existing?.processing_status==='processed')return respond({received:true,duplicate:true});
  const {error:logError}=await db.from('billing_webhook_events').upsert({provider_event_id:event.id,event_type:event.type,processing_status:'processing',last_error:null},{onConflict:'provider_event_id'});
  if(logError)return respond({error:'Unable to record event'},503);
  try{
    const obj=event.data?.object;
    // Only signed subscription events change member access.
    if(!event.type.startsWith('customer.subscription.')||!obj?.id){
      await db.from('billing_webhook_events').update({processing_status:'processed',processed_at:new Date().toISOString()}).eq('provider_event_id',event.id);
      return respond({received:true,ignored:true});
    }
    const subscriptionId=String(obj.id);
    const {data:prior,error:priorError}=await db.from('member_subscriptions').select('user_id,plan_id,period_end').eq('provider_subscription_id',subscriptionId).maybeSingle();
    if(priorError)throw priorError;
    const uid=obj.metadata?.user_id||prior?.user_id;
    if(typeof uid!=='string'||!/^[0-9a-f-]{36}$/i.test(uid))throw Error('Subscription account mapping missing');
    const statusMap={active:'active',trialing:'trial',past_due:'past_due',canceled:'cancelled',unpaid:'past_due',incomplete:'inactive',incomplete_expired:'expired',paused:'inactive'};
    const status=event.type==='customer.subscription.deleted'?'cancelled':statusMap[obj.status]||'inactive';
    const epoch=Number(obj.current_period_end||obj.items?.data?.[0]?.current_period_end);
    const periodEnd=Number.isFinite(epoch)&&epoch>0?new Date(epoch*1000).toISOString():prior?.period_end||null;
    const {error:saveError}=await db.from('member_subscriptions').upsert({
      user_id:uid,billing_provider:'stripe',provider_customer_id:typeof obj.customer==='string'?obj.customer:null,
      provider_subscription_id:subscriptionId,plan_id:obj.items?.data?.[0]?.price?.id||prior?.plan_id||null,
      status,period_end:periodEnd,updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    if(saveError)throw saveError;
    const {error:doneError}=await db.from('billing_webhook_events').update({processing_status:'processed',processed_at:new Date().toISOString(),last_error:null}).eq('provider_event_id',event.id);
    if(doneError)throw doneError;
    return respond({received:true});
  }catch(error){
    console.error('Billing webhook failed',error);
    await db.from('billing_webhook_events').update({processing_status:'failed',last_error:String(error).slice(0,400)}).eq('provider_event_id',event.id);
    return respond({error:'Event processing unavailable'},500);
  }
});
