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
