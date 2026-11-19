import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTrustStatus} from '../supabase/functions/trust-intake/policy.mjs';
import {createTrustIntakeHandler} from '../supabase/functions/trust-intake/handler.mjs';
const reference='10000000-0000-4000-8000-000000000001',access_code='20000000-0000-4000-8000-000000000002';
const payload={action:'status',reference,access_code};
const request=body=>new Request('https://example.invalid/functions/v1/trust-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('status requests require both private UUID capability fields',()=>{
 assert.deepEqual(validateTrustStatus(payload),{reference,accessCode:access_code});
 for(const body of [{action:'status',reference},{action:'status',reference,access_code:'wrong'}, {action:'status',reference:'not-a-uuid',access_code}, {action:'status',reference,access_code,user_id:'admin'}]){
  if(body.access_code===access_code&&body.reference===reference)assert.equal(validateTrustStatus(body).accessCode,access_code);
  else assert.throws(()=>validateTrustStatus(body));
 }
});
test('status API never returns case payload, staff identity, notes or a claimed legal outcome',async()=>{
 const handler=createTrustIntakeHandler({
  submit:async()=>{throw Error('should not submit');},
  rateKey:async()=>'a'.repeat(64),
  status:async()=>({data:{verified:true,status:'reviewing',message:'A reviewer is assessing your report.',payload:{private:'do not disclose'},resolution_note:'confidential',assigned_reviewer_id:'secret',created_at:'2026-11-19T12:00:00Z'}})
 });
 const result=await handler(request(payload));
 assert.equal(result.status,200);
 assert.equal(result.headers.get('cache-control'),'no-store');
 const data=await result.json();
 assert.deepEqual(data,{verified:true,status:'reviewing',message:'A reviewer is assessing your report.',created_at:'2026-11-19T12:00:00Z',updated_at:null});
});
test('guessing the case number alone cannot disclose status',async()=>{
 let called=0;
 const handler=createTrustIntakeHandler({
  submit:async()=>{},rateKey:async()=>{called++;return 'b'.repeat(64);},
  status:async()=>({data:{verified:false}})
 });
 assert.equal((await handler(request({action:'status',reference}))).status,400);
 assert.equal(called,0);
 assert.equal((await handler(request(payload))).status,404);
 assert.equal(called,1);
});
test('status service failures and rate limits never imply a report was accepted',async()=>{
 const rate=createTrustIntakeHandler({submit:async()=>{},rateKey:async()=>'c'.repeat(64),status:async()=>({error:{code:'54000'}})});
 assert.equal((await rate(request(payload))).status,429);
 const missing=createTrustIntakeHandler({submit:async()=>{},rateKey:async()=>'d'.repeat(64)});
 assert.equal((await missing(request(payload))).status,503);
 const bad=createTrustIntakeHandler({submit:async()=>{},rateKey:async()=>'e'.repeat(64),status:async()=>({data:{verified:true,status:'approved',payload:{secret:true}}})});
 assert.equal((await bad(request(payload))).status,503);
});
test('the existing disabled intake still rejects a new submission',async()=>{
 const handler=createTrustIntakeHandler({
  submit:async()=>({error:{code:'55000'}}),
  rateKey:async()=>'f'.repeat(64),
  status:async()=>({data:{verified:false}})
 });
 const res=await handler(request({kind:'support',details:'A synthetic test issue only',idempotency_key:access_code}));
 assert.equal(res.status,503);
 assert.match((await res.json()).error,/not activated/i);
});
