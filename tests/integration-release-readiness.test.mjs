import test from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDERS,inspectProvider,trustedOrigin} from '../supabase/functions/integration-health/providerChecks.mjs';

test('configured payment means all current CCBill names AND financial release gates',()=>{
  const spec=PROVIDERS.adult_payment_processor;
  const env=Object.fromEntries(spec.required.map(k=>[k,'sandbox-value']));
  let status=inspectProvider('adult_payment_processor',env);
  assert.equal(status.configured,false);
  assert.ok(status.missing.includes('CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED'));
  assert.ok(status.missing.includes('HOSTING_FINANCIAL_RELEASE_APPROVED'));
  for(const key of spec.approvals)env[key]='true';
  status=inspectProvider('adult_payment_processor',env);
  assert.equal(status.configured,true);
  assert.equal(status.acceptance_verified,false);
  assert.ok(!JSON.stringify(status).includes('sandbox-value'),'Never return secret values');
  delete env.CCBILL_CLIENT_ACCNUM;
  assert.equal(inspectProvider('adult_payment_processor',env).configured,false);
});

test('DocuSign requires private signing credentials and explicit industry approval',()=>{
  const spec=PROVIDERS.docusign;
  const env=Object.fromEntries(spec.required.map(k=>[k,'private']));
  assert.equal(inspectProvider('docusign',env).configured,false);
  env.DOCUSIGN_ADULT_BUSINESS_APPROVED='true';
  assert.equal(inspectProvider('docusign',env).configured,true);
  env.DOCUSIGN_PRIVATE_KEY='';
  assert.deepEqual(inspectProvider('docusign',env).missing,['DOCUSIGN_PRIVATE_KEY']);
});

test('calendar and notification workers do not claim readiness without job secrets',()=>{
  for(const name of ['calendar_sync','transactional_email','web_push']){
    const spec=PROVIDERS[name];
    const values=Object.fromEntries(spec.required.map(k=>[k,'configured']));
    for(const key of spec.approvals)values[key]='true';
    assert.equal(inspectProvider(name,values).configured,true);
    delete values[spec.required[0]];
    assert.equal(inspectProvider(name,values).configured,false);
  }
});

test('server does not conflate client tile setup with approved routing',()=>{
  const a=inspectProvider('map_routing',{VITE_HOSTING_MAP_TILE_URL:'https://tiles.example.com/{z}/{x}/{y}'});
  assert.equal(a.configured,false);
  assert.ok(a.missing.includes('HOSTING_ROUTING_OSRM_URL'));
});

test('trusted Yoti return origin is an HTTPS origin, never a path or redirect',()=>{
  assert.equal(trustedOrigin('https://contentconnectx.com'),true);
  for(const bad of ['http://contentconnectx.com','https://localhost',
    'https://contentconnectx.com/redirect','https://contentconnectx.com/?to=x',
    'https://user:pass@contentconnectx.com']){
    assert.equal(trustedOrigin(bad),false,bad);
  }
});

test('provider readiness requires independently authenticated AAL2 before privileged reads',async()=>{
  const {verifiedAal2}=await import('../supabase/functions/_shared/verifiedAdminAal.mjs');
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../supabase/functions/integration-health/index.ts',import.meta.url),'utf8');
  assert.match(source,/import \{verifiedAal2\}/);
  assert.ok(source.indexOf('auth.auth.getUser()')<source.indexOf('verifiedAal2(token,user.id)'));
  assert.ok(source.indexOf('verifiedAal2(token,user.id)')<source.indexOf('const db=createClient(url,secret)'));
  assert.match(source,/if\(!verifiedAal2\(token,user\.id\)\)return reply\(.*403\)/);
  assert.match(source,/'Cache-Control':'no-store'/);
  const token=claims=>'Bearer e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.fixture';
  const valid={sub:'synthetic-user',aal:'aal2',exp:2000,role:'authenticated'};
  assert.equal(verifiedAal2(token(valid),'synthetic-user',1000),true);
  for(const overrides of [{aal:'aal1'},{sub:'other-user'},{exp:999},{role:'service_role'}])
    assert.equal(verifiedAal2(token({...valid,...overrides}),'synthetic-user',1000),false);
  assert.equal(verifiedAal2('Bearer malformed','synthetic-user',1000),false);
});

test('inactive optional providers neither demand secrets nor count as launch failures',async()=>{
 const {scopeProvider}=await import('../supabase/functions/integration-health/providerChecks.mjs');
 const incomplete={configured:false,missing:['EXTERNAL_KEY'],note:'Optional',acceptance_verified:false};
 const optional=scopeProvider(incomplete);
 assert.equal(optional.launch_required,false);
 assert.equal(optional.state,'optional_inactive');
 assert.deepEqual(optional.missing,[]);
 assert.equal(optional.configured,false);
 assert.equal(optional.acceptance_verified,false);
 assert.deepEqual(scopeProvider(incomplete,{selected:true}).missing,['EXTERNAL_KEY']);
 assert.deepEqual(scopeProvider(incomplete,{required:true}).missing,['EXTERNAL_KEY']);
 assert.equal(scopeProvider(incomplete,{required:true}).launch_required,true);
 assert.deepEqual(incomplete.missing,['EXTERNAL_KEY']);
});
