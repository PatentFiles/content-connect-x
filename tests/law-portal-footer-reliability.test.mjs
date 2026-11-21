import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCOPES,validScopes,isCaseLive,makeCsv,reportRows,csvEscape} from '../supabase/functions/ccx-law-portal/disclosurePolicy.mjs';
import {TRUST_LINKS,TRUST_PAGES} from '../src/supabase/trustContent.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const user='10000000-0000-4000-8000-000000000001',officer='20000000-0000-4000-8000-000000000002';

test('every footer link resolves to a dedicated legal or support page with no modal interception',()=>{
 const app=read('src/supabase/TrustSite.jsx');
 assert.ok(TRUST_LINKS.length>=10);
 for(const [slug] of TRUST_LINKS){
  assert.ok(slug==='cookies'||Boolean(TRUST_PAGES[slug]),'missing trust page '+slug);
  assert.ok(!slug.includes('..'));
 }
 assert.match(app,/export function TrustFooter/);
 assert.match(app,/href=\{'\/trust\/'\+slug\}/);
 assert.match(app,/href="\/trust\/law-enforcement"/);
 assert.doesNotMatch(app,/dialog\.ccx-trust-modal|modal\.current\.showModal\(\)/);
 const browser=read('scripts/test-trust-dashboard-browser.mjs');
 assert.match(browser,/for\(const \[slug,title\] of TRUST_LINKS\)/);
 assert.match(browser,/click\(\);return true/);
});
test('scopes disallow wildcard access and every record requires unexpired officer-owned case',()=>{
 assert.equal(SCOPES.length,5);
 assert.equal(validScopes(['profile','admission']),true);
 assert.equal(validScopes(['all']),false);
 assert.equal(validScopes(['profile','profile']),false);
 const caseRow={officer_id:officer,status:'approved',subject_user_id:user,
  expires_at:'2099-01-01T00:00:00Z',approved_scopes:['profile']};
 assert.equal(isCaseLive(caseRow,officer,1795220000000),true);
 assert.equal(isCaseLive(caseRow,user,1795220000000),false);
 assert.equal(isCaseLive({...caseRow,expires_at:'2020-01-01T00:00:00Z'},officer,1795220000000),false);
 assert.equal(isCaseLive({...caseRow,status:'pending'},officer,1795220000000),false);
 assert.equal(isCaseLive({...caseRow,approved_scopes:['all']},officer,1795220000000),false);
});
test('law enforcement data never bypasses server MFA, audit, case approval or scope checks',()=>{
 const edge=read('supabase/functions/ccx-law-portal/index.ts');
 const schema=read('supabase/migrations/20261120224500_scoped_law_enforcement_cases.sql');
 assert.match(edge,/caller\.auth\.getUser\(\)/);
 assert.match(edge,/verifiedAal2\(authHeader,uid\)/);
 assert.match(edge,/isCaseLive\(item,uid\)/);
 assert.match(edge,/await log\(actionName,item\.id,subject/);
 assert.match(edge,/case_requested/);
 assert.match(edge,/authorized_process_confirmed/);
 assert.match(edge,/inviteUserByEmail/);
 assert.match(edge,/approved_scopes/);
 assert.doesNotMatch(edge,/select\('\*'\)\.from\('member_profiles'/);
 assert.match(schema,/enable row level security/i);
 assert.match(schema,/revoke all on public\.%I from PUBLIC,anon,authenticated/i);
 assert.match(schema,/ccx_law_audit_immutable/);
 assert.match(schema,/expires_at/);
});
test('csv prevents spreadsheet formula injection and includes only approved fields',()=>{
 const data={profile:[{id:user,display_name:'=HYPERLINK(\"https://bad.test\")',role_type:'creator',created_at:'2026-11-20'}]};
 const csv=makeCsv(data);
 assert.match(csv,/display_name/);
 assert.match(csv,/'=HYPERLINK/);
 assert.match(csv,/\r\n/);
 assert.equal(csvEscape('=SUM(1,2)'),"\"'=SUM(1,2)\"");
 assert.ok(reportRows(data).length>1);
});
test('officer portal is mounted before member age gate, separate from admin and professional roles',()=>{
 const boot=read('src/supabase/bootstrap.jsx');
 const admin=read('src/supabase/AdminConsole.jsx');
 const portal=read('src/supabase/LawEnforcementPortal.jsx');
 assert.match(boot,/showLawPortal/);
 assert.match(boot,/\/law-enforcement-portal/);
 assert.match(admin,/LawEnforcementAdmin/);
 assert.match(portal,/SecurityCenter/);
 assert.match(portal,/MfaChallenge/);
 assert.match(portal,/export_pdf/);
 assert.match(portal,/export_csv/);
});

test('law disclosure approval cannot renew an active case or undo revocation',()=>{
 const edge=read('supabase/functions/ccx-law-portal/index.ts');
 assert.match(edge,/item\.status==='pending'&&!\['approve','deny'\]\.includes\(decision\)/);
 assert.match(edge,/item\.status==='approved'&&decision!=='revoke'/);
 assert.match(edge,/Submit a new case for renewed access/);
});

test('law portal downloads CSV text or PDF Blob without rejecting valid CSV responses',()=>{
 const portal=read('src/supabase/LawEnforcementPortal.jsx');
 assert.match(portal,/data instanceof Blob\?data:/);
 assert.match(portal,/kind==='csv'&&typeof data==='string'/);
 assert.match(portal,/URL\.createObjectURL\(file\)/);
});
