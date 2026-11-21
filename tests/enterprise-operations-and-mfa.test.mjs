import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedAal2} from '../supabase/functions/_shared/verifiedAdminAal.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='10000000-0000-4000-8000-000000000001';
function jwt(fields={}){
 const obj={sub:id,aal:'aal2',role:'authenticated',exp:1900000000,...fields};
 const part=Buffer.from(JSON.stringify(obj)).toString('base64url');
 return 'Bearer a.'+part+'.signature';
}
test('server-validated account identity and JWT AAL2 must agree',()=>{
 assert.equal(verifiedAal2(jwt(),id,1795225000),true);
 assert.equal(verifiedAal2(jwt({aal:'aal1'}),id,1795225000),false);
 assert.equal(verifiedAal2(jwt({sub:'different'}),id,1795225000),false);
 assert.equal(verifiedAal2(jwt({exp:1000}),id,1795225000),false);
 assert.equal(verifiedAal2(jwt({role:'anon'}),id,1795225000),false);
 assert.equal(verifiedAal2('Bearer invalid',id),false);
});
test('admin operations is aggregate only and enforces MFA before service-role reads',()=>{
 const backend=read('supabase/functions/ccx-operations/index.ts');
 const admin=read('src/supabase/AdminOperations.jsx');
 const control=read('src/supabase/AdminConsole.jsx');
 assert.match(backend,/caller\.auth\.getUser\(\)/);
 assert.match(backend,/verifiedAal2\(req\.headers\.get\('Authorization'\),user\.id\)/);
 assert.match(backend,/member_admissions/);
 assert.match(backend,/ccx_trust_requests/);
 assert.match(backend,/ccx_email_delivery_summary/);
 assert.match(backend,/ccx_idv_config/);
 assert.match(backend,/ccx_ai_agent_runs/);
 assert.match(backend,/ccx_meeting_recordings/);
 assert.match(admin,/Operational readiness/);
 assert.match(admin,/ccx-operations/);
 assert.match(control,/section==='operations'&&<AdminOperations/);
 assert.doesNotMatch(backend,/select\('payload|select\('email|select\('document_path/);
});
test('sensitive provider changes require the same verified admin AAL2 session',()=>{
 const api=read('supabase/functions/ccx-integrations/index.ts');
 assert.match(api,/auth\.getUser\(\)/);
 assert.match(api,/verifiedAal2\(header,uid\)/);
 assert.match(api,/\['admin_set_secret','admin_provider_settings'\]/);
 assert.match(api,/verifiedSentryDsn/);
 assert.match(api,/Save a valid Resend API key and verified sender address/);
});
