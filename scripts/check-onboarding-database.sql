-- Run in the canonical CCX Supabase SQL editor as the database owner.
-- Every synthetic auth/profile/review row is rolled back. Never remove ROLLBACK.
-- This tests actual RLS as an authenticated (not service-role) application user.
BEGIN;
CREATE TEMP TABLE ccx_onboarding_probe_results(test text,passed boolean) ON COMMIT DROP;
GRANT INSERT,SELECT ON ccx_onboarding_probe_results TO authenticated;
SELECT set_config('ccx.probe_user',gen_random_uuid()::text,true),set_config('ccx.probe_other',gen_random_uuid()::text,true);
INSERT INTO auth.users(id,aud,role,email,created_at,updated_at)
 SELECT current_setting('ccx.probe_user')::uuid,'authenticated','authenticated','ccx-schema-probe-'||current_setting('ccx.probe_user')||'@example.invalid',now(),now()
 UNION ALL SELECT current_setting('ccx.probe_other')::uuid,'authenticated','authenticated','ccx-schema-probe-'||current_setting('ccx.probe_other')||'@example.invalid',now(),now();
INSERT INTO public.member_profiles(id,display_name) VALUES(current_setting('ccx.probe_other')::uuid,'Synthetic other user') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.age_verification_requests(user_id,status,provider) VALUES(current_setting('ccx.probe_user')::uuid,'pending','manual'),(current_setting('ccx.probe_other')::uuid,'pending','manual');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ccx.probe_user'),'role','authenticated','aal','aal1')::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE test_role text; affected integer; denied boolean;
BEGIN
 FOREACH test_role IN ARRAY ARRAY['creator','photographer','videographer','video_editor','agent','studio'] LOOP
  INSERT INTO public.member_profiles(id,display_name,role_type,real_name,stage_name,company_name,representative_name,city,state,country,profile_complete,updated_at)
   VALUES(current_setting('ccx.probe_user')::uuid,'Synthetic onboarding',test_role,'Synthetic person','Synthetic stage','Synthetic studio','Synthetic representative','Phoenix','AZ','United States',true,now())
   ON CONFLICT(id) DO UPDATE SET role_type=excluded.role_type,real_name=excluded.real_name,stage_name=excluded.stage_name,company_name=excluded.company_name,representative_name=excluded.representative_name,city=excluded.city,state=excluded.state,country=excluded.country,profile_complete=true;
  INSERT INTO ccx_onboarding_probe_results SELECT 'profile_create_update_'||test_role,EXISTS(SELECT 1 FROM public.member_profiles WHERE id=current_setting('ccx.probe_user')::uuid AND role_type=test_role AND company_name='Synthetic studio' AND state='AZ');
 END LOOP;
 INSERT INTO ccx_onboarding_probe_results SELECT 'cannot_read_other_profile',NOT EXISTS(SELECT 1 FROM public.member_profiles WHERE id=current_setting('ccx.probe_other')::uuid);
 UPDATE public.member_profiles SET display_name='Must not change' WHERE id=current_setting('ccx.probe_other')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 INSERT INTO ccx_onboarding_probe_results VALUES('cannot_update_other_profile',affected=0);
 denied:=false;
 BEGIN
  INSERT INTO public.member_profiles(id,display_name) VALUES(current_setting('ccx.probe_other')::uuid,'Must not overwrite') ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 INSERT INTO ccx_onboarding_probe_results VALUES('cannot_upsert_other_profile',denied);
 INSERT INTO ccx_onboarding_probe_results SELECT 'can_read_own_pending_verification',COUNT(*)=1 FROM public.age_verification_requests WHERE user_id=current_setting('ccx.probe_user')::uuid AND status='pending';
 INSERT INTO ccx_onboarding_probe_results SELECT 'cannot_read_other_verification',NOT EXISTS(SELECT 1 FROM public.age_verification_requests WHERE user_id=current_setting('ccx.probe_other')::uuid);
 denied:=false;
 BEGIN UPDATE public.age_verification_requests SET status='approved' WHERE user_id=current_setting('ccx.probe_user')::uuid;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 INSERT INTO ccx_onboarding_probe_results VALUES('cannot_self_approve_verification',denied);
END $$;
RESET ROLE;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM ccx_onboarding_probe_results WHERE passed IS DISTINCT FROM true) THEN
  RAISE EXCEPTION 'Onboarding database regression failed';
 END IF;
END $$;
SELECT test,passed FROM ccx_onboarding_probe_results ORDER BY test;
ROLLBACK;
