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
  'platform-extras','media-gateway','integration-health'
];
for(const name of functions){
  const res=await fetch(project+'/functions/v1/'+name,{
    method:'POST',headers:{'content-type':'application/json'},
    body:'{}',signal:AbortSignal.timeout(15000)
  });
  assert.equal(res.status,401,name+' must reject unauthenticated requests');
  process.stdout.write('PASS '+name+' returns 401 to anonymous callers\n');
}
process.stdout.write('\nAll '+functions.length+' unauthenticated gateway checks passed.\n');
