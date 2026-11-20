import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const retired=[
 'src/supabase/YotiVerification.jsx',
 'supabase/functions/yoti-verification/index.ts',
 'supabase/functions/ccx-integrations/yotiPolicy.mjs',
 'supabase/functions/ccx-integrations/yotiDocScanPolicy.mjs',
 'public/yoti-logo.svg'
];
test('retired vendor has no bundled component, API route or credential entry',()=>{
 for(const path of retired)assert.equal(existsSync(path),false,path+' must be removed');
 for(const path of ['src/supabase/SupabaseApp.jsx','src/supabase/AgeGateOnboarding.jsx','src/supabase/VerificationWorkspace.jsx',
 'src/supabase/IntegrationSettings.jsx','supabase/functions/ccx-integrations/index.ts','supabase/functions/integration-health/index.ts']){
  const source=read(path);
  assert.doesNotMatch(source,/YotiVerification|yoti_start|yoti_status|YOTI_API_KEY|YOTI_SDK_ID|age\.yoti\.com|admin_yoti_origins/,'No active vendor gateway: '+path);
 }
 assert.match(read('src/supabase/AgeGateOnboarding.jsx'),/<IdentityVerification/);
 assert.match(read('src/supabase/VerificationWorkspace.jsx'),/<IdentityVerification/);
 assert.match(read('supabase/functions/integration-health/index.ts'),/services\.first_party_identity/);
});
test('Railway worker and Supabase decision policy remain pinned and independent of browser identity data',()=>{
 const worker=read('server/idv-worker/worker.mjs');
 const edge=read('supabase/functions/identity-verification/handler.mjs');
 const policy=read('supabase/functions/identity-verification/policy.mjs');
 assert.equal(read('server/idv-worker/policy.mjs'),policy);
 for(const field of ['fields_confident','cross_checked','authenticity_passed','matched','liveness_passed','frame_identity_passed'])
  assert.match(policy,new RegExp(field));
 assert.match(edge,/member_profiles'\)\.select\('real_name'/);
 assert.match(edge,/nameKey\(registered\.real_name\)!==nameKey\(suppliedName\)/);
 assert.match(edge,/crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
 assert.match(worker,/ccx_decoded_pdf417/);
 assert.match(worker,/verifyHeadTurnLiveness/);
 assert.match(worker,/FaceRecognitionService/);
 assert.match(worker,/identity-verification/);
 assert.doesNotMatch(worker,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});
test('final membership admission is transactional and bound to the registered legal name',()=>{
 const sql=read('supabase/migrations/20261120195550_account_name_verification_binding.sql');
 assert.match(sql,/registered_legal_name_mismatch/);
 assert.match(sql,/public\.member_profiles p/);
 assert.match(sql,/member_admissions|age_verification_requests/);
 assert.match(sql,/checks_passed/);
 assert.match(sql,/ccx_idv_document_blocks/);
});
test('signed-in checkout and signing keys are server-only; no Yoti in admin credential list',()=>{
 const controls=read('src/supabase/IntegrationSettings.jsx');
 const edge=read('supabase/functions/ccx-integrations/index.ts');
 assert.match(edge,/ccbill_client_account/);
 assert.match(edge,/docusign_private_key/);
 assert.match(edge,/docusign_hmac/);
 assert.doesNotMatch(controls,/yoti.*provider|Yoti return domains|age\.yoti\.com/);
 assert.match(controls,/integrationAction\('admin_set_secret'/);
 assert.doesNotMatch(controls,/VITE_CCBILL|VITE_DOCUSIGN/);
});
