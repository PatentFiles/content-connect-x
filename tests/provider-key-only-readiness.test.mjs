import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const helpers=[
 'supabase/functions/agreement-packets/docuSignProvider.mjs',
 'supabase/functions/collaboration-docusign-webhook/docuSignProvider.mjs'
];
test('DocuSign signing and callback share safe production/demo account discovery',()=>{
 for(const path of helpers){
  const source=read(path);
  const matched=source.match(/export function resolveDocuSignRestBase\(profile,accountId\)\{[\s\S]*?\n\}/);
  assert.ok(matched,'Missing account-scoped regional API discovery: '+path);
  const ctx=vm.createContext({URL});
  const callback=vm.runInContext(matched[0].replace(/^export /,'')+'\nresolveDocuSignRestBase',ctx);
  assert.equal(callback({accounts:[{account_id:'012345',base_uri:'https://na3.docusign.net'}]},'012345'),
   'https://na3.docusign.net/restapi/v2.1');
  assert.equal(callback({accounts:[{account_id:'012345',base_uri:'https://demo.docusign.net'}]},'012345'),
   'https://demo.docusign.net/restapi/v2.1');
  assert.throws(()=>callback({accounts:[{account_id:'not-mine',base_uri:'https://na3.docusign.net'}]},'012345'),/not authorized/);
  assert.throws(()=>callback({accounts:[{account_id:'012345',base_uri:'https://evil.example'}]},'012345'),/untrusted/);
  assert.throws(()=>callback({accounts:[{account_id:'012345',base_uri:'http://na3.docusign.net'}]},'012345'),/untrusted/);
  assert.throws(()=>callback({accounts:[{account_id:'012345',base_uri:'https://na3.docusign.net.evil.example'}]},'012345'),/untrusted/);
  assert.match(source,/account-d\.docusign\.com/);
  assert.match(source,/account\.docusign\.com/);
  assert.match(source,/oauth\/userinfo/);
  assert.match(source,/createPrivateKey\(pem\)/);
  assert.match(source,/replace\(\/\\\\n\/g,'\\n'\)/);
  assert.doesNotMatch(source,/https:\/\/demo\.docusign\.net\/restapi\/v2\.1['"]/);
 }
});
test('CCBill and DocuSign credentials continue to use encrypted server settings only',()=>{
 const source=read('supabase/functions/ccx-integrations/index.ts');
 for(const key of ['ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt','ccbill_relay_secret',
  'docusign_account_id','docusign_integration_key','docusign_user_id','docusign_private_key','docusign_hmac'])
  assert.ok(source.includes(key),key);
 assert.match(source,/ccx_secret_set/);
 assert.match(read('supabase/functions/membership-billing/index.ts'),/membershipVaultConfig/);
 assert.match(read('supabase/functions/agreement-packets/index.ts'),/providerFetch/);
});
