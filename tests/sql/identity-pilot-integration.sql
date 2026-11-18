-- Run after identity-integration.sql, only inside the disposable CI database.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'ccx_idv_ci' THEN RAISE EXCEPTION 'Disposable CI database required';END IF;END $$;
\ir ../../supabase/sql/identity_admin_pilot.sql
CREATE TABLE public.ci_pilot(uid uuid,sid uuid,other_uid uuid,admissions_before integer,age_rows_before integer);
INSERT INTO public.ci_pilot SELECT gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),(SELECT count(*) FROM public.member_admissions),(SELECT count(*) FROM public.age_verification_requests);
INSERT INTO auth.users SELECT uid FROM public.ci_pilot UNION ALL SELECT other_uid FROM public.ci_pilot;
INSERT INTO public.account_security(user_id,admin) SELECT uid,true FROM public.ci_pilot UNION ALL SELECT other_uid,false FROM public.ci_pilot;
INSERT INTO public.member_profiles(id,real_name,display_name) SELECT uid,'Original legal name','Original stage name' FROM public.ci_pilot;
INSERT INTO public.member_admissions(user_id) SELECT uid FROM public.ci_pilot;
UPDATE public.ci_pilot SET admissions_before=admissions_before+1;
GRANT SELECT ON public.ci_pilot TO service_role;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.ccx_idv_pilot_sessions','SELECT') OR has_function_privilege('anon','public.ccx_idv_pilot_transition(uuid,uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'FAIL pilot browser authority';END IF;
 IF (SELECT public FROM storage.buckets WHERE id='ccx-identity-pilot-evidence') THEN RAISE EXCEPTION 'FAIL pilot bucket public';END IF;
END $$;
INSERT INTO storage.objects(bucket_id,name) VALUES('ccx-identity-pilot-evidence','private-fixture.png');
SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ccx-identity-pilot-evidence') THEN RAISE EXCEPTION 'FAIL pilot file readable';END IF;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('ccx-identity-pilot-evidence','forged.png');RAISE EXCEPTION 'FAIL pilot browser upload';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ DECLARE t record;BEGIN
 SELECT * INTO t FROM public.ci_pilot;
 BEGIN PERFORM public.ccx_idv_pilot_transition(t.uid,t.sid,'start');RAISE EXCEPTION 'FAIL disabled pilot accepted';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%PILOT_UNAVAILABLE%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.ccx_idv_pilot_transition(t.other_uid,t.sid,'start');RAISE EXCEPTION 'FAIL ordinary member accepted';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%PILOT_ADMIN_REQUIRED%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
-- Test-only timestamps in disposable CI, never production privacy/security approvals.
UPDATE public.ccx_idv_pilot_config SET enabled=true,last_cleanup_at=now(),last_probe_at=now();
SET ROLE service_role;
DO $$ DECLARE t record;s jsonb;u jsonb;k text;h text:=repeat('c',64);notice text:=repeat('Synthetic CI consent fixture only. ',10);BEGIN
 SELECT * INTO t FROM public.ci_pilot;
 s:=public.ccx_idv_pilot_transition(t.uid,t.sid,'start',jsonb_build_object('legal_name','Test Owner','document_type','passport','issuing_country','US','consent_version','ccx-private-test-2026-11-18-v1','consent_notice',notice,'consent_hash',encode(extensions.digest(notice,'sha256'),'hex')));
 IF s->>'status'<>'collecting' THEN RAISE EXCEPTION 'FAIL pilot start';END IF;
 BEGIN PERFORM public.ccx_idv_pilot_transition(t.other_uid,t.sid,'cancel');RAISE EXCEPTION 'FAIL pilot cross owner';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%PILOT_SESSION_NOT_FOUND%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.ccx_idv_pilot_transition(t.uid,t.sid,'begin',jsonb_build_object('job_hash',h));RAISE EXCEPTION 'FAIL missing pilot evidence';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%PILOT_EVIDENCE_INCOMPLETE%' THEN RAISE;END IF;END;
 FOREACH k IN ARRAY ARRAY['front','selfie','capture'] LOOP
  u:=public.ccx_idv_pilot_transition(t.uid,t.sid,'reserve',jsonb_build_object('kind',k,'path',t.uid||'/'||t.sid||'/'||k||'-'||gen_random_uuid()||'.png','sha256',h,'bytes',100,'content_type','image/png'));
  s:=public.ccx_idv_pilot_transition(t.uid,t.sid,'uploaded',jsonb_build_object('path',u->>'path'));
 END LOOP;
 s:=public.ccx_idv_pilot_transition(t.uid,t.sid,'begin',jsonb_build_object('job_hash',h));
 s:=public.ccx_idv_pilot_transition(null,t.sid,'claim',jsonb_build_object('job_hash',h));
 BEGIN PERFORM public.ccx_idv_pilot_transition(null,t.sid,'claim',jsonb_build_object('job_hash',h));RAISE EXCEPTION 'FAIL pilot reused token';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%PILOT_INVALID_CAPABILITY%' THEN RAISE;END IF;END;
 s:=public.ccx_idv_pilot_transition(t.uid,t.sid,'finish',jsonb_build_object('job_hash',h,'status','name_mismatch','reason','legal_name_mismatch','expected_name','Test Correct Name','eligible_on','2008-01-01','diagnostics',jsonb_build_object('test_only',true,'admission_granted',false,'name_matches',false)));
 s:=public.ccx_idv_pilot_transition(t.uid,t.sid,'confirm_name','{"legal_name":"Test Correct Name"}');
 IF s->>'status'<>'approved' OR s->'diagnostics'->>'admission_granted'<>'false' THEN RAISE EXCEPTION 'FAIL pilot result isolation';END IF;
 IF (SELECT count(*) FROM public.member_admissions)<>t.admissions_before OR (SELECT count(*) FROM public.age_verification_requests)<>t.age_rows_before THEN RAISE EXCEPTION 'FAIL pilot changed production admission';END IF;
 IF (SELECT real_name FROM public.member_profiles WHERE id=t.uid)<>'Original legal name' OR (SELECT display_name FROM public.member_profiles WHERE id=t.uid)<>'Original stage name' THEN RAISE EXCEPTION 'FAIL pilot changed profile names';END IF;
 s:=public.ccx_idv_pilot_transition(t.uid,t.sid,'cancel');
 IF (SELECT count(*) FROM public.ccx_idv_pilot_purge_candidates())<>0 THEN RAISE EXCEPTION 'FAIL in-flight upload deletion grace';END IF;
 BEGIN PERFORM public.ccx_idv_pilot_transition(t.uid,t.sid,'uploaded',jsonb_build_object('path',u->>'path'));RAISE EXCEPTION 'FAIL writes after deletion';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%PILOT_UNAVAILABLE%' THEN RAISE;END IF;END;
 PERFORM public.ccx_idv_pilot_finish_purge();
 IF (SELECT purged_at FROM public.ccx_idv_pilot_sessions WHERE id=t.sid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL pilot minimized before blob deletion';END IF;
END $$;
RESET ROLE;
UPDATE public.ccx_idv_pilot_uploads SET reserved_at=now()-interval '11 minutes';
SET ROLE service_role;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.ccx_idv_pilot_purge_candidates())<>3 THEN RAISE EXCEPTION 'FAIL pilot deletion candidates';END IF;
 DELETE FROM public.ccx_idv_pilot_uploads;
 PERFORM public.ccx_idv_pilot_finish_purge();
 IF EXISTS(SELECT 1 FROM public.ccx_idv_pilot_sessions WHERE purged_at IS NULL OR legal_name<>'[deleted]' OR diagnostics<>'{}'::jsonb OR evidence<>'{}'::jsonb) THEN RAISE EXCEPTION 'FAIL pilot sensitive data minimization';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ccx_idv_pilot_config WHERE last_cleanup_at>now()-interval '1 minute') THEN RAISE EXCEPTION 'FAIL cleanup heartbeat';END IF;
END $$;
RESET ROLE;
SELECT 'PASS: pilot ownership, private storage RLS, one-use capabilities, name correction without admission, deletion grace and minimization on disposable PostgreSQL. Real blobs are not tested here.' AS result;
