/** CCBill FlexForms checkout: no card data enters Content Connect X. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {flexConfigured,buildFlexformUrl} from './ccbill.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const send=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return send({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),pub=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!pub||!secret)return send({error:'Backend unavailable'},503);
 const auth=createClient(url,pub,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return send({error:'Unauthorized'},401);
 const db=createClient(url,secret),uid=user.id;
 const [age,security,sub]=await Promise.all([
  db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
  db.from('account_security').select('banned,suspended').eq('user_id',uid).maybeSingle(),
  db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle()
 ]);
 if(age.error||security.error||sub.error||security.data?.banned||security.data?.suspended||
   !age.data?.[0]?.admitted_at)
  return send({error:'Complete account onboarding first'},403);
 if(!['active','trial'].includes(sub.data?.status)||sub.data?.period_end&&Date.parse(sub.data.period_end)<=Date.now())
  return send({error:'Active premium membership required'},403);
 const payload=await req.json().catch(()=>({}));
 if(payload.action!=='create_checkout'||!uuid(payload.booking_id))return send({error:'Invalid checkout request'},400);
 if(!flexConfigured())return send({error:'CCBill marketplace merchant and approved live form are not configured'},503);
 const {data:booking}=await db.from('property_booking_requests')
  .select('id,owner_id,requester_id,property_id,status,legal_status,payment_status')
  .eq('id',payload.booking_id).maybeSingle();
 if(!booking||booking.requester_id!==uid||booking.status!=='accepted'||booking.legal_status!=='signed'||
   !['not_started','pending','failed'].includes(booking.payment_status))return send({error:'Signed, accepted, unpaid booking required'},403);
 const {data:host}=await db.from('host_verification_requests').select('expires_at')
  .eq('property_id',booking.property_id).eq('status','approved').limit(1);
 if(!host?.some((x:any)=>!x.expires_at||Date.parse(x.expires_at)>Date.now()))
  return send({error:'Host authority verification has expired'},403);
 const {data:terms}=await db.from('booking_policy_snapshots').select('rental_cents,deposit_cents').eq('booking_id',booking.id).maybeSingle();
 const amount=Number(terms?.rental_cents||0);
 if(!Number.isSafeInteger(amount)||amount<300)return send({error:'Booking price is not payable through this form'},409);
 const {data:existing}=await db.from('booking_payment_intents').select('id,provider,status,amount_cents')
  .eq('booking_id',booking.id).eq('kind','rental').maybeSingle();
 if(existing&&existing.amount_cents!==amount)return send({error:'Previously quoted price mismatch'},409);
 let intentId:string;
 if(existing){
  if(!['not_started','failed','pending'].includes(existing.status))return send({error:'Payment already processed'},409);
  if(!['unconfigured','ccbill'].includes(existing.provider))return send({error:'Another payment provider owns this intent'},409);
  const {data,error}=await db.from('booking_payment_intents').update({
    provider:'ccbill',status:'pending',updated_at:new Date().toISOString()
  }).eq('id',existing.id).select('id').single();
  if(error)throw error;intentId=data.id;
 }else{
  const {data,error}=await db.from('booking_payment_intents').insert({
    booking_id:booking.id,provider:'ccbill',kind:'rental',amount_cents:amount,currency:'USD',status:'pending'
  }).select('id').single();
  if(error)throw error;intentId=data.id;
 }
 // This is an external hosted checkout request, NOT an authorization or capture.
 const {data:attempt,error:insertError}=await db.from('hosting_payment_attempts').insert({
  booking_id:booking.id,intent_id:intentId,provider:'ccbill',status:'created'
 }).select('id,checkout_nonce,expires_at').single();
 if(insertError)throw insertError;
 const urlToPay=buildFlexformUrl(attempt.checkout_nonce,amount);
 return send({checkout_url:urlToPay,expires_at:attempt.expires_at,
  amount_cents:amount,deposit_cents:Number(terms.deposit_cents),
  note:'External CCBill hosted form. Do not trust return redirects; confirmed webhook and reconciliation are required.'});
});
