import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261117144358_repair_onboarding_profile_schema.sql');
const gate=read('src/supabase/AgeGateOnboarding.jsx');
const app=read('src/supabase/SupabaseApp.jsx');

// These are source/schema contract guards, not a replacement for the live RLS
// tests in scripts/check-onboarding-database.sql or a real provider sandbox test.
test('the repair declares each identity and profile-media column idempotently',()=>{
 for(const name of ['real_name','stage_name','company_name','representative_name','cover_path','state']){
  assert.match(migration,new RegExp('ADD COLUMN IF NOT EXISTS '+name+' text'),name);
 }
 assert.match(migration,/NOTIFY pgrst, 'reload schema'/);
 assert.doesNotMatch(migration,/DROP\s+(TABLE|COLUMN)|DISABLE ROW LEVEL SECURITY/i);
});
test('signup proceeds to a Yoti-only age step without a second profile form',()=>{
 assert.doesNotMatch(gate,/from\('member_profiles'\)\.upsert|profile_complete|saveProfile/);
 assert.match(gate,/<YotiVerification/);
 assert.doesNotMatch(gate,/type="file"|submit-age-verification|uploadToSignedUrl/);
 assert.match(app,/full_name:fullName/);
 const entry=read('supabase/migrations/20261117232051_one_time_signup_admission_optional_mfa.sql');
 assert.match(entry,/bootstrap_signup_account/);
 assert.match(entry,/INSERT INTO public.account_security/i);
 assert.match(entry,/INSERT INTO public.member_profiles/i);
 assert.match(entry,/VALUES\(NEW.id,false,false,false\)/i);
});
test('profile reload includes all names and only selects known contract columns',()=>{
 const select=app.match(/from\('member_profiles'\)\.select\('([^']+)'\)/);
 assert.ok(select,'The account bootstrap must explicitly select profile columns');
 for(const column of select[1].split(','))assert.ok(migration.includes("'"+column+"'"),'Unknown profile read column '+column);
 for(const column of ['real_name','stage_name','company_name','representative_name'])assert.ok(select[1].split(',').includes(column));
});
test('schema repair cannot grant verification status or bypass private-row policies',()=>{
 assert.match(migration,/member_profiles ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/age_verification_requests ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public\.age_verification_requests FROM authenticated/);
 assert.match(migration,/GRANT SELECT ON public\.age_verification_requests TO authenticated/);
 assert.doesNotMatch(migration,/SET\s+status\s*=\s*'approved'/i);
});
test('live database regression probes leave no synthetic accounts or reviews behind',()=>{
 const probe=read('scripts/check-onboarding-database.sql');
 assert.match(probe,/BEGIN;/);
 assert.match(probe,/SET LOCAL ROLE authenticated;/);
 assert.match(probe,/cannot_self_approve_verification/);
 assert.match(probe,/cannot_read_other_verification/);
 assert.match(probe,/ROLLBACK;\s*$/);
 assert.doesNotMatch(probe,/\bCOMMIT\s*;/);
});
