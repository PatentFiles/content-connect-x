import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityApprovalGate} from '../src/supabase/identityApprovalOnce.mjs';

test('only a server-approved session triggers completion', async () => {
 const notify=createIdentityApprovalGate();let calls=0;
 for (const status of ['collecting','processing','name_mismatch','review_required','retryable_error','age_restricted','expired']) {
  assert.equal(await notify({id:'session-1',status},()=>{calls++;}),false);
 }
 assert.equal(calls,0);
 assert.equal(await notify({id:'session-1',status:'approved'},()=>{calls++;}),true);
 assert.equal(calls,1);
});
test('repeated refresh and concurrent status polls never trigger duplicate completion',async()=>{
 const notify=createIdentityApprovalGate();let calls=0,release;
 const first=notify({id:'session-1',status:'approved'},async()=>{calls++;await new Promise(resolve=>{release=resolve;});});
 assert.equal(await notify({id:'session-1',status:'approved'},()=>{calls++;}),false);
 release();
 assert.equal(await first,true);
 assert.equal(await notify({id:'session-1',status:'approved'},()=>{calls++;}),false);
 assert.equal(calls,1);
});
test('failed callback may retry without unlocking other sessions',async()=>{
 const notify=createIdentityApprovalGate();let calls=0;
 await assert.rejects(()=>notify({id:'session-1',status:'approved'},async()=>{calls++;throw Error('navigation failed');}),/navigation failed/);
 assert.equal(await notify({id:'session-1',status:'approved'},async()=>{calls++;}),true);
 assert.equal(await notify({id:'session-2',status:'approved'},async()=>{calls++;}),true);
 assert.equal(calls,3);
});
test('missing or unapproved session cannot invoke callback',async()=>{
 const notify=createIdentityApprovalGate();let calls=0;
 assert.equal(await notify(null,()=>{calls++;}),false);
 assert.equal(await notify({status:'approved'},()=>{calls++;}),false);
 assert.equal(await notify({id:'session-1',status:'approved'},null),false);
 assert.equal(calls,0);
});
