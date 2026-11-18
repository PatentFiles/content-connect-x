import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSession} from '../supabase/functions/identity-verification/handler.mjs';
const now=Date.parse('2026-11-18T12:00:00Z');
test('expired worker lease offers a server-authorized retry',()=>{
 const record={status:'processing',expires_at:'2026-11-18T12:10:00Z',job_expires_at:'2026-11-18T11:59:59Z',evidence:{}};
 assert.equal(publicSession(record,now).status,'retryable_error');
 assert.equal(record.status,'processing');
});
test('expired processing session offers a fresh attempt, never admission',()=>{
 const result=publicSession({status:'processing',expires_at:'2026-11-18T11:59:00Z',evidence:{}},now);
 assert.equal(result.status,'expired');assert.notEqual(result.status,'approved');
});
test('unexpired processing lease remains in progress',()=>{
 assert.equal(publicSession({status:'processing',expires_at:'2026-11-18T12:10:00Z',job_expires_at:'2026-11-18T12:02:00Z',evidence:{}},now).status,'processing');
});
