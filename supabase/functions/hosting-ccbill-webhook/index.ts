/** Rental capture requires the entire event authenticated by the provider-IP relay. */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {flexConfigured,verifyPurchaseDigest} from './ccbill.ts';
import {optionalProviderSetting} from './providerConfig.mjs';
import {readCallbackBody,verifyRelay,parseEvent,moneyCents,providerTime,hexHash,uuid} from '../_shared/ccbillPolicy.mjs';
const out=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return out({error:'POST required'},405);
 if(!flexConfigured()||optionalProviderSetting('CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED')!=='true')return out({error:'Financial release gate closed'},503);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return out({error:'Service unavailable'},503);
 try{
  const raw=await readCallbackBody(req);if(raw.length>65536)return out({error:'Payload too large'},413);
  if(!await verifyRelay(req,raw,'rental',Deno.env.get('CCBILL_WEBHOOK_RELAY_SECRET')))return out({error:'Untrusted provider callback'},401);
  const data=parseEvent(raw,req.headers.get('content-type')||'',req.headers.get('x-ccx-query')||'');
  if(String(data.clientAccnum)!==Deno.env.get('CCBILL_CLIENT_ACCNUM')||String(data.clientSubacc)!==Deno.env.get('CCBILL_CLIENT_SUBACC'))return out({error:'Merchant mismatch'},403);
  if(data.eventType!=='NewSaleSuccess')return out({error:'This rental event needs a separate supported reconciliation workflow'},422);
  if(!verifyPurchaseDigest(data.subscriptionId,1,String(data.dynamicPricingValidationDigest||'')))return out({error:'Invalid approval digest'},401);
  const nonce=data['X-ccx_booking'];if(!uuid(nonce)||!data.transactionId)return out({error:'Unknown checkout'},400);
  if(String(data.subscriptionCurrencyCode)!=='840')return out({error:'Wrong booking currency'},409);
  const cents=moneyCents(data.subscriptionInitialPrice),at=providerTime(data.timestamp,Deno.env.get('CCBILL_EVENT_TIMEZONE'));
  const normalized={nonce,transaction:data.transactionId,subscription:data.subscriptionId,cents,currency:'USD',at};
  const db=createClient(url,key);
  const {data:result,error}=await db.rpc('ccx_capture_rental_event',{p_nonce:nonce,p_transaction:data.transactionId,
   p_event_id:'NewSaleSuccess:'+data.transactionId,p_amount:cents,p_hash:hexHash(JSON.stringify(normalized)),p_occurred:at});
  if(error)return out({error:'Payment event requires retry or merchant reconciliation'},503);
  return out(result,result.status==='reconciliation_required'?202:200);
 }catch{return out({error:'Provider callback did not validate'},400);}
});
