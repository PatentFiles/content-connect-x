import test from 'node:test';
import assert from 'node:assert/strict';
import {readTracking,saveTracking,normalizeTracking} from '../src/supabase/trackingPreferences.mjs';
import {TRUST_LINKS,TRUST_PAGES} from '../src/supabase/trustContent.mjs';
import {validateTrustRequest} from '../supabase/functions/trust-intake/policy.mjs';
import {createTrustIntakeHandler} from '../supabase/functions/trust-intake/handler.mjs';
const fixture={kind:'support',details:'Synthetic regression test only',idempotency_key:'00000000-0000-4000-8000-000000000001'};
const request=body=>new Request('https://fixture.invalid/trust-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('privacy preferences are opt-in, versioned and fail closed',()=>{
 const none={version:1,necessary:true,diagnostics:false,experiments:false,advertising:false};
 assert.deepEqual(readTracking({getItem:()=>null}),none);
 assert.deepEqual(readTracking({getItem:()=>'{broken'}),none);
 assert.deepEqual(readTracking({getItem:()=>{throw Error('blocked');}}),none);
 assert.deepEqual(normalizeTracking({version:0,diagnostics:true,experiments:true}),none);
 let stored;const storage={getItem:()=>stored,setItem:(k,v)=>{stored=v;}};
 saveTracking({diagnostics:true,experiments:false,advertising:true},storage);
 assert.equal(readTracking(storage).diagnostics,true);assert.equal(readTracking(storage).advertising,false);
 assert.throws(()=>saveTracking({},null));
});
test('every footer route is implemented or is the actual cookie preference screen',()=>{
 assert.equal(new Set(TRUST_LINKS.map(([slug])=>slug)).size,TRUST_LINKS.length);
 for(const [slug]of TRUST_LINKS)assert.ok(slug==='cookies'||TRUST_PAGES[slug]);
 assert.ok(TRUST_PAGES['law-enforcement'].sections.some(([,body])=>body.includes('no general real-time access')));
});
test('only allowlisted text is retained and no reporter can grant themselves access',()=>{
 const result=validateTrustRequest({...fixture,role:'admin',approved:true,user_id:'target',photo:'data:image/jpeg;base64,not-accepted'});
 assert.equal(result.payload.role,undefined);assert.equal(result.payload.photo,undefined);assert.equal(result.payload.user_id,undefined);
 assert.throws(()=>validateTrustRequest({...fixture,details:{html:'unsafe'}}));
 assert.throws(()=>validateTrustRequest({...fixture,details:'x'.repeat(4001)}));
 assert.throws(()=>validateTrustRequest({...fixture,kind:'read_all_reports'}));
});
test('NCII and agency requests require the declared information, never authorize data access',()=>{
 assert.throws(()=>validateTrustRequest({...fixture,kind:'ncii'}));
 const valid={...fixture,kind:'ncii',locator:'profile/test-only',signature:'Synthetic signer',email:'example@example.invalid',authorized:true,good_faith:true};
 assert.equal(validateTrustRequest(valid).payload.kind,'ncii');
 assert.throws(()=>validateTrustRequest({...valid,authorized:'true'}));
 assert.throws(()=>validateTrustRequest({...valid,signature:''}));
 assert.throws(()=>validateTrustRequest({...fixture,kind:'law_enforcement',email:'someone@agency.invalid'}));
});
test('HTTP intake rejects malformed and oversized bodies before calling storage',async()=>{
 let calls=0;const handler=createTrustIntakeHandler({rateKey:async()=>'',submit:async()=>{calls++;}});
 assert.equal((await handler(new Request('https://fixture.invalid',{method:'GET'}))).status,405);
 const oversized=await handler(request({...fixture,details:'x'.repeat(20000)}));assert.equal(oversized.status,400);
 assert.equal((await handler(request({action:'read',id:'private'}))).status,400);
 assert.equal(calls,0);
});
test('disabled storage cannot produce a success screen; receipts reveal no case data',async()=>{
 const disabled=createTrustIntakeHandler({rateKey:async()=>'',submit:async()=>({error:{code:'55000'}})});
 assert.equal((await disabled(request(fixture))).status,503);
 const limited=createTrustIntakeHandler({rateKey:async()=>'',submit:async()=>({error:{code:'54000'}})});
 assert.equal((await limited(request(fixture))).status,429);
 const enabled=createTrustIntakeHandler({rateKey:async()=>'',submit:async()=>({data:{received:true,reference:'synthetic-reference',payload:{private:'must not escape'}}})});
 const response=await enabled(request(fixture));assert.equal(response.status,201);
 assert.deepEqual(await response.json(),{received:true,reference:'synthetic-reference'});
 assert.equal(response.headers.get('cache-control'),'no-store');
});
