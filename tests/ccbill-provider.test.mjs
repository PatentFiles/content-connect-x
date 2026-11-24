import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {recurringCheckout,prepaidCheckout,moneyCents,relaySignature,relayMessage,verifyRelay,parseEvent,providerTime,membershipEvent} from '../supabase/functions/_shared/ccbillPolicy.mjs';
import {membershipConfig} from '../supabase/functions/_shared/membershipBillingConfig.mjs';
import worker,{allowedSource} from '../deploy/ccbill-relay/worker.mjs';
const cfg={account:'900100',subaccount:'0001',flexId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',salt:'test-salt-not-real',cents:1999,nonce:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
const event=()=>({clientAccnum:'900100',clientSubacc:'0001',eventType:'NewSaleSuccess',subscriptionId:'90000000000000000001',transactionId:'000000000001',timestamp:'2026-11-01 12:00:00',
 subscriptionInitialPrice:'19.99',subscriptionRecurringPrice:'19.99',subscriptionCurrencyCode:'840',initialPeriod:'30',recurringPeriod:'30',nextRenewalDate:'2026-12-01','X-ccx_membership':cfg.nonce});
test('recurring form digest uses CCBill documented parameter order and server amount',()=>{
 const u=new URL(recurringCheckout(cfg));assert.equal(u.origin,'https://api.ccbill.com');
 assert.equal(u.searchParams.get('formDigest'),createHash('md5').update('19.993019.993099840'+cfg.salt).digest('hex'));
 assert.equal(u.searchParams.get('X-ccx_membership'),cfg.nonce);assert.equal(u.searchParams.get('clientSubacc'),'0001');
 assert.throws(()=>recurringCheckout({...cfg,cents:19.99}));assert.throws(()=>recurringCheckout({...cfg,days:365}));
});
test('provider decimal amounts do not silently round or accept scientific notation',()=>{
 assert.equal(moneyCents('19.99'),1999);
 for(const v of ['1e3','19.999','-19.99','NaN','19',null])assert.throws(()=>moneyCents(v));
});
test('webhook signature covers full body, query, scope, media type and freshness',async()=>{
 const secret='test-only-'.repeat(5),ts=String(Math.floor(Date.now()/1000)),raw=JSON.stringify(event()),query='eventType=NewSaleSuccess';
 const sig=await relaySignature(secret,relayMessage('membership',ts,query,'application/json',raw));
 const req=new Request('https://example.test',{method:'POST',headers:{'x-ccx-timestamp':ts,'x-ccx-signature':sig,'x-ccx-query':query,'content-type':'application/json'},body:raw});
 assert.equal(await verifyRelay(req,raw,'membership',secret),true);
 assert.equal(await verifyRelay(req,raw.replace('19.99','99.99'),'membership',secret),false);
 assert.equal(await verifyRelay(req,raw,'rental',secret),false);
 assert.equal(await verifyRelay(req,raw,'membership',secret,Date.now()+400000),false);
 const edited=new Request(req,{headers:{...Object.fromEntries(req.headers),'x-ccx-query':'eventType=Refund'}});
 assert.equal(await verifyRelay(edited,raw,'membership',secret),false);
});
test('callback parsing rejects spoofed duplicate fields and unsafe numeric IDs',()=>{
 assert.equal(parseEvent(JSON.stringify(event()),'application/json','eventType=NewSaleSuccess').subscriptionInitialPrice,'19.99');
 assert.throws(()=>parseEvent(JSON.stringify(event()),'application/json','eventType=Refund'));
 assert.throws(()=>parseEvent('clientAccnum=900100&clientSubacc=0001&eventType=a&eventType=b','application/x-www-form-urlencoded',''));
 assert.throws(()=>parseEvent(JSON.stringify({...event(),subscriptionId:90000000000000000000}),'application/json',''));
});
test('new sale uses subscriptionInitialPrice and renewal uses billedAmount, not an invented alias',()=>{
 const e=membershipEvent(event(),cfg,'America/Phoenix');assert.equal(e.amount_cents,1999);assert.equal(e.subscription_id,'90000000000000000001');
 assert.throws(()=>membershipEvent({...event(),subscriptionInitialPrice:undefined,initialPrice:'19.99'},cfg,'America/Phoenix'));
 const renewed=membershipEvent({...event(),eventType:'RenewalSuccess',billedAmount:'19.99',billedCurrencyCode:'840'},cfg,'America/Phoenix');
 assert.equal(renewed.amount_cents,1999);
 assert.throws(()=>membershipEvent({...event(),subscriptionCurrencyCode:'978'},cfg,'America/Phoenix'));
 assert.throws(()=>membershipEvent({...event(),clientSubacc:'0002'},cfg,'America/Phoenix'));
});
test('provider timezone is explicit and impossible dates are not normalized',()=>{
 assert.equal(providerTime('2026-11-01 12:00:00','America/Phoenix'),'2026-11-01T19:00:00.000Z');
 assert.throws(()=>providerTime('2026-02-30 12:00:00','America/Phoenix'));
 assert.throws(()=>providerTime('2026-03-08 02:30:00','America/New_York'));
 assert.throws(()=>providerTime('2026-11-01 12:00:00',''));
});
test('merchant approvals cannot become true merely from credentials or public data',()=>{
 const env={CCBILL_CLIENT_ACCNUM:cfg.account,CCBILL_MEMBERSHIP_SUBACC:cfg.subaccount,CCBILL_MEMBERSHIP_FLEX_ID:cfg.flexId,CCBILL_MEMBERSHIP_SALT:cfg.salt,CCBILL_WEBHOOK_RELAY_SECRET:'a'.repeat(40),CCBILL_EVENT_TIMEZONE:'America/Phoenix'};
 assert.equal(membershipConfig(k=>env[k]).ready,false);
 assert.equal(membershipConfig(k=>({...env,CCBILL_MEMBERSHIP_APPROVED:'true',CCBILL_MEMBERSHIP_LIVE_APPROVED:'true'})[k]).ready,true);
});
test('relay rejects non-provider sources without contacting any backend',async()=>{
 for(const ip of ['127.0.0.1','64.38.212.0','64.38.212.255','64.38.212.1.evil','10.1.2.3'])assert.equal(allowedSource(ip),false);
 for(const ip of ['64.38.212.1','64.38.215.254','64.38.240.21','64.38.241.11'])assert.equal(allowedSource(ip),true);
 const req=new Request('https://relay.test/membership',{method:'POST',headers:{'cf-connecting-ip':'64.38.212.1'},body:'{}'});
 assert.equal((await worker.fetch(req,{})).status,403,'a forged header outside Cloudflare is not trusted');
});

test('prepaid checkout digest is single billing and does not request rebills',()=>{
 for(const [days,cents] of [[180,10795],[365,19190]]){
  const u=new URL(prepaidCheckout({...cfg,days,cents}));
  assert.equal(u.searchParams.get('initialPeriod'),String(days));
  assert.equal(u.searchParams.get('formDigest'),createHash('md5').update((cents/100).toFixed(2)+days+'840'+cfg.salt).digest('hex'));
  for(const field of ['recurringPrice','recurringPeriod','numRebills'])assert.equal(u.searchParams.has(field),false);
 }
 assert.throws(()=>prepaidCheckout({...cfg,days:30}));
});
test('prepaid sale carries exact term and rejects recurring configuration',()=>{
 for(const days of [180,365]){
  const data={...event(),initialPeriod:String(days),recurringPeriod:'0',subscriptionRecurringPrice:'0.00',rebills:'0',nextRenewalDate:undefined};
  const e=membershipEvent(data,cfg,'America/Phoenix');
  assert.equal(e.billing_mode,'prepaid');assert.equal(e.period_days,days);
  assert.equal(Date.parse(e.period_end)-Date.parse(e.occurred_at),days*86400000);
  assert.throws(()=>membershipEvent({...data,rebills:'99'},cfg,'America/Phoenix'));
  assert.throws(()=>membershipEvent({...data,rebills:undefined},cfg,'America/Phoenix'));
  assert.throws(()=>membershipEvent({...data,recurringPeriod:'30'},cfg,'America/Phoenix'));
 }
});
