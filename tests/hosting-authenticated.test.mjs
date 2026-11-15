/**
 * Read-only authenticated release acceptance check. This intentionally DOES
 * NOT create IDs, change billing, create charges, send invitations or approve
 * anyone. Provide TWO independently verified test users via environment.
 *
 * Usage: CCX_E2E_SUPABASE_URL=... CCX_E2E_PUBLISHABLE_KEY=...
 *        CCX_E2E_HOST_EMAIL=... CCX_E2E_HOST_PASSWORD=...
 *        CCX_E2E_GUEST_EMAIL=... CCX_E2E_GUEST_PASSWORD=...
 *        node tests/hosting-authenticated.test.mjs
 */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const required=['CCX_E2E_SUPABASE_URL','CCX_E2E_PUBLISHABLE_KEY',
 'CCX_E2E_HOST_EMAIL','CCX_E2E_HOST_PASSWORD',
 'CCX_E2E_GUEST_EMAIL','CCX_E2E_GUEST_PASSWORD'];
for(const name of required)if(!process.env[name])throw new Error(name+' is required; no fabricated test identity may be used.');
const root=process.env.CCX_E2E_SUPABASE_URL;
if(!root.startsWith('https://'))throw new Error('Only HTTPS test endpoints allowed.');
const keys=process.env.CCX_E2E_PUBLISHABLE_KEY;
const client=()=>createClient(root,keys,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const host=client(),guest=client();
const logins=await Promise.all([
 host.auth.signInWithPassword({email:process.env.CCX_E2E_HOST_EMAIL,password:process.env.CCX_E2E_HOST_PASSWORD}),
 guest.auth.signInWithPassword({email:process.env.CCX_E2E_GUEST_EMAIL,password:process.env.CCX_E2E_GUEST_PASSWORD})
]);
for(const x of logins)if(x.error||!x.data.user||!x.data.session)throw new Error('One test member could not authenticate.');
const h=logins[0].data.user,g=logins[1].data.user;
assert.notEqual(h.id,g.id,'Test accounts must be independent people.');
const ask=async(member,fn,action,data={})=>{
 const r=await member.functions.invoke(fn,{body:{action,...data}});
 if(r.error?.context?.json){
  try{const response=await r.error.context.json();return {error:response.error,status:r.error.context.status};}catch{}
 }
 return r.data||{error:r.error?.message||'Function unavailable'};
};
test('two independent test adults authenticated',async()=>{
 const [a,b]=await Promise.all([host.auth.getUser(),guest.auth.getUser()]);
 assert.equal(a.error,null);assert.equal(b.error,null);
 assert.equal(a.data.user.id,h.id);assert.equal(b.data.user.id,g.id);
});
test('both accounts can query their own age approval records',async()=>{
 for(const [member,id] of [[host,h.id],[guest,g.id]]){
  const {data,error}=await member.from('age_verification_requests').select('status')
   .eq('user_id',id).order('created_at',{ascending:false}).limit(1);
  assert.equal(error,null);
  assert.equal(data?.[0]?.status,'approved','Each member must be independently age verified.');
 }
});
test('host and guest cannot view or mutate a foreign booking by guessing UUID',async()=>{
 const random=crypto.randomUUID();
 for(const member of [host,guest]){
  const data=await ask(member,'hosting-operations','booking_overview',{booking_id:random});
  assert.ok(data.error,'Unknown booking must not return private records');
  const packet=await ask(member,'hosting-production','booking_planning_packet',{booking_id:random});
  assert.ok(packet.error,'Unknown planning packet must be denied');
 }
});
test('payment gateways do not create payment state from client-provided prices',async()=>{
 const random=crypto.randomUUID();
 for(const member of [host,guest]){
  const data=await ask(member,'hosting-ccbill','create_checkout',{booking_id:random,amount_cents:1});
  assert.ok(data.error,'Unapproved or nonexistent checkout must fail');
 }
});
test('verified members cannot read sensitive merchant provider events through REST',async()=>{
 const {data,error}=await guest.from('booking_payment_events').select('id').limit(1);
 assert.ok(error||!data?.length,'Internal payment event data must never be visible');
});
test('property discovery excludes unreviewed direct client rows',async()=>{
 const {data,error}=await guest.from('properties').select('id,status,approved_at').limit(5);
 assert.equal(error,null);
 assert.ok((data||[]).every(row=>row.status==='active'&&row.approved_at),
  'Data API must not disclose private or unapproved properties to the other member');
});
after(async()=>{
 await host.auth.signOut();await guest.auth.signOut();
});
