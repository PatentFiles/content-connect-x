/**
 * Non-destructive unauthenticated smoke test. This tests only the API gateway
 * boundary; it does not establish authenticated feature correctness.
 * Run with: npm run smoke:supabase
 */
import assert from 'node:assert/strict';

const project=process.env.SUPABASE_URL||'https://yxuqbygykpfbioslljlf.supabase.co';
const functions=[
  'submit-age-verification','directory','admin-age-review','member-workflows',
  'collaboration-consent','performer-readiness','create-checkout',
  'platform-extras','media-gateway','hosting-marketplace','integration-health',
  'production-manager','agreement-packets',
  'hosting-operations','hosting-docusign','hosting-ccbill',
  'hosting-advanced','hosting-production','hosting-calendar','hosting-discovery','hosting-notification-worker'
];
for(const name of functions){
  const res=await fetch(project+'/functions/v1/'+name,{
    method:'POST',headers:{'content-type':'application/json'},
    body:'{}',signal:AbortSignal.timeout(15000)
  });
  assert.equal(res.status,401,name+' must reject unauthenticated requests');
  process.stdout.write('PASS '+name+' returns 401 to anonymous callers\n');
}
const retired=await fetch(project+'/functions/v1/stripe-webhook',{
  method:'POST',headers:{'content-type':'application/json'},body:'{}',
  signal:AbortSignal.timeout(15000)
});
assert.equal(retired.status,410,'Retired membership webhook must not accept financial events');
process.stdout.write('PASS retired membership webhook returns 410 without processing events\n');
process.stdout.write('\nAll '+functions.length+' unauthenticated gateway checks passed.\n');

// The calendar handler authenticates its token route itself (not an account JWT).
const calendar=await fetch(project+'/functions/v1/hosting-calendar?token=invalid',{
 signal:AbortSignal.timeout(15000)
});
assert.equal(calendar.status,404,'Calendar export must reject invalid capability tokens');
const wrongJob=await fetch(project+'/functions/v1/hosting-calendar',{
 method:'POST',headers:{'content-type':'application/json',authorization:'Bearer invalid-job'},
 body:JSON.stringify({action:'cron_sync'}),signal:AbortSignal.timeout(15000)
});
assert.equal(wrongJob.status,401,'Calendar must reject a forged scheduler credential');
process.stdout.write('PASS application-authenticated calendar token and job boundaries\n');
