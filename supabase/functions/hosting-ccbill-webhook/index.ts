import {optionalProviderSetting} from './providerConfig.mjs';
/**
 * CCBill webhook with the dynamicPricingValidationDigest verified against the
 * merchant's encryption salt. No return URL or browser-controlled status
 * can mark a booking paid. Unverified/unsupported events remain unprocessed.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {flexConfigured,verifyPurchaseDigest,sha256Hex} from './ccbill.ts';
const respond=(body:unknown,status=200)=>Response.json(body,{status});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async req=>{
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 if(!flexConfigured())return respond({error:'Financial release gate closed'},503);
 // An independently verified merchant event contract + payout/reconciliation procedure
 // must be attested before ANY webhook can update captured funds.
 if(optionalProviderSetting('CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED')!=='true')
  return respond({error:'Unverified webhook contract: capture disabled'},503);
 const content=await req.text();
 if(content.length>30_000)return respond({error:'Payload too large'},413);
 let body:any;
 try{
  if((req.headers.get('content-type')||'').includes('application/json'))body=JSON.parse(content);
  else body=Object.fromEntries(new URLSearchParams(content));
 }catch{return respond({error:'Malformed event'},400);}
 // The CCBill account and transaction must match the configured merchant.
 const event=String(new URL(req.url).searchParams.get('eventType')||body.eventType||'');
 if(!['NewSaleSuccess','UpSaleSuccess'].includes(event))return respond({ignored:true,note:'Unsupported event requires separate reconciliation'});
 const account=String(body.clientAccnum||''),sub=String(body.clientSubacc||'').padStart(4,'0');
 if(account!==Deno.env.get('CCBILL_CLIENT_ACCNUM')||sub!==Deno.env.get('CCBILL_CLIENT_SUBACC'))
  return respond({error:'Merchant account mismatch'},403);
 const subscriptionId=String(body.subscriptionId||'');
 const transactionId=String(body.transactionId||'');
 const digest=String(body.dynamicPricingValidationDigest||'');
 if(!subscriptionId||!/^[0-9a-z-]{8,60}$/i.test(transactionId)||
    !verifyPurchaseDigest(subscriptionId,1,digest))return respond({error:'Invalid transaction digest'},401);
 const nonce=String(body['X-ccx_booking']||body['X-ccx_attempt']||'');
 if(!uuid(nonce))return respond({error:'Unknown checkout attempt'},403);
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!secret)return respond({error:'Backend unavailable'},503);
 const db=createClient(url,secret);
 const {data:attempt,error:lookupError}=await db.from('hosting_payment_attempts')
  .select('id,booking_id,intent_id,status,expires_at').eq('checkout_nonce',nonce).maybeSingle();
 if(lookupError||!attempt||attempt.status!=='created'||Date.parse(attempt.expires_at)<Date.now())
  return respond({error:'Expired or already processed checkout attempt'},403);
 const [bookingResult,intentResult,snapshotResult]=await Promise.all([
  db.from('property_booking_requests').select('id,owner_id,requester_id,status,legal_status,payment_status').eq('id',attempt.booking_id).maybeSingle(),
  db.from('booking_payment_intents').select('id,amount_cents,status,provider').eq('id',attempt.intent_id).maybeSingle(),
  db.from('booking_policy_snapshots').select('rental_cents,deposit_cents').eq('booking_id',attempt.booking_id).maybeSingle()
 ]);
 const booking=bookingResult.data,intent=intentResult.data,snapshot=snapshotResult.data;
 if(bookingResult.error||intentResult.error||snapshotResult.error||
    !booking||!intent||!snapshot||booking.status!=='accepted'||booking.legal_status!=='signed'||
    intent.provider!=='ccbill'||intent.status!=='pending'||Number(intent.amount_cents)!==Number(snapshot.rental_cents))
  return respond({error:'Booking no longer matches authorized checkout'},409);
 // Require confirmation of the exact price, not merely a valid subscription digest.
 // Unrecognized CCBill event variants are deliberately not marked captured.
 const amount=String(body.initialPrice||body.formPrice||'');
 if(amount!== (Number(snapshot.rental_cents)/100).toFixed(2))
  return respond({error:'CCBill receipt amount did not match booking quote'},403);
 const eventId=event+':'+transactionId;
 const {data:seen,error:priorError}=await db.from('booking_payment_events')
  .select('id,processed_at').eq('provider','ccbill').eq('provider_event_id',eventId).maybeSingle();
 if(priorError)return respond({error:'Payment event log unavailable'},503);
 if(seen?.processed_at)return respond({ok:true,duplicate:true});
 if(!seen){
  const {error:eventError}=await db.from('booking_payment_events').insert({
   provider:'ccbill',provider_event_id:eventId,event_type:event,
   payload_sha256:sha256Hex(event+transactionId+attempt.booking_id+amount),
   booking_id:booking.id
  });
  if(eventError)return respond({error:'Payment event could not be recorded'},503);
 }
 try{
  const {error:captureError}=await db.from('booking_payment_intents').update({
   status:'captured',provider_intent_id:transactionId,updated_at:new Date().toISOString()
  }).eq('id',intent.id).eq('status','pending');
  if(captureError)throw captureError;
  const {error:bookingError}=await db.from('property_booking_requests')
   .update({payment_status:'captured',operational_status:'ready'}).eq('id',booking.id).eq('status','accepted');
  if(bookingError)throw bookingError;
  const payoutAmount=Number(snapshot.rental_cents); // fee = 0 until merchant payout terms are approved.
  const {data:account}=await db.from('host_payout_accounts').select('verification_status')
   .eq('owner_id',booking.owner_id).maybeSingle();
  await db.from('booking_payouts').upsert({
   booking_id:booking.id,host_id:booking.owner_id,payout_cents:payoutAmount,
   currency:'USD',status:account?.verification_status==='verified'?'pending':'held'
  },{onConflict:'booking_id',ignoreDuplicates:true});
  await db.from('hosting_payment_attempts').update({status:'completed'}).eq('id',attempt.id);
  await db.from('booking_payment_events').update({processed_at:new Date().toISOString()})
   .eq('provider','ccbill').eq('provider_event_id',eventId);
  for(const recipient of [booking.owner_id,booking.requester_id])await db.from('member_notifications').insert({
   recipient_id:recipient,kind:'hosting_paid',title:'Booking payment recorded',
   details:{booking_id:booking.id}
  });
  return respond({ok:true,note:'Provider-verified payment recorded. Host payout requires separate approved payout partner.'});
 }catch(error){
  console.error('CCBill payment reconciliation failed',error);
  return respond({error:'Payment event requires provider reconciliation'},503);
 }
});
