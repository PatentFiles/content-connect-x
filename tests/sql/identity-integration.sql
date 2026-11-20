-- DISPOSABLE CI DATABASE ONLY. The guards deliberately reject production names.
-- Auth, Storage and Vault below are fixtures. Actual identity migration functions
-- are loaded unchanged. No HTTP calls, real users, images or credentials are used.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database()<>'ccx_idv_ci' OR inet_server_addr() IS NULL THEN
  RAISE EXCEPTION 'Use the disposable ccx_idv_ci CI service, never production';
 END IF;
END $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA vault;
CREATE SCHEMA extensions;
CREATE SCHEMA ccx_internal;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA public,auth,storage,extensions TO anon,authenticated,service_role;
CREATE TABLE public.account_security(user_id uuid PRIMARY KEY REFERENCES auth.users,admin boolean DEFAULT false,banned boolean DEFAULT false,suspended boolean DEFAULT false);
CREATE TABLE public.member_profiles(id uuid PRIMARY KEY REFERENCES auth.users,real_name text,display_name text);
CREATE TABLE public.age_verification_requests(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users,status text,provider text,provider_session_id text,verification_method text,evidence_reference text,id_document_path text,selfie_document_path text,verified_at timestamptz,expires_at timestamptz);
CREATE TABLE public.member_admissions(id uuid DEFAULT gen_random_uuid(),user_id uuid UNIQUE REFERENCES auth.users,verification_id uuid);
CREATE TABLE public.ccx_age_provider_sessions(user_id uuid,provider_session_id text,provider text,mode text,policy_version text);
CREATE FUNCTION ccx_internal.record_age_admission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND (NEW.expires_at IS NULL OR NEW.expires_at>now()) THEN
  INSERT INTO public.member_admissions(user_id,verification_id) VALUES(NEW.user_id,NEW.id) ON CONFLICT(user_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_age_admission AFTER INSERT OR UPDATE OF status ON public.age_verification_requests FOR EACH ROW EXECUTE FUNCTION ccx_internal.record_age_admission();
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
-- Deliberately broad fixture policy: identity restrictive policies must still win.
CREATE POLICY broad_fixture_access ON storage.objects TO anon,authenticated USING(true) WITH CHECK(true);
CREATE TABLE vault.secrets(id uuid DEFAULT gen_random_uuid(),name text UNIQUE,decrypted_secret text,description text);
CREATE VIEW vault.decrypted_secrets AS SELECT * FROM vault.secrets;
CREATE FUNCTION vault.create_secret(secret text,name text,description text) RETURNS uuid LANGUAGE sql AS $$
 INSERT INTO vault.secrets(decrypted_secret,name,description) VALUES(secret,name,description) RETURNING id
$$;
GRANT SELECT ON public.account_security,public.member_admissions,public.ccx_age_provider_sessions TO service_role;
GRANT SELECT,UPDATE ON public.member_profiles TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.age_verification_requests TO service_role;

\ir ../../supabase/sql/self_hosted_identity_v2.sql
\ir ../../supabase/sql/self_hosted_identity_retention_hardening.sql
\ir ../../supabase/migrations/20261119212000_identity_selective_retake.sql
\ir ../../supabase/migrations/20261119230000_identity_review_mfa_case_workflow.sql
\ir ../../supabase/migrations/20261120195550_account_name_verification_binding.sql
\ir ../../supabase/migrations/20261120195550_account_name_verification_binding.sql
\ir ../../supabase/migrations/20261120204000_first_party_age_approval_guard.sql

CREATE TABLE public.ci_cases(kind text PRIMARY KEY,uid uuid,sid uuid);
INSERT INTO public.ci_cases SELECT kind,gen_random_uuid(),gen_random_uuid() FROM unnest(ARRAY['adult','minor','birthday','failed','held']) kind;
INSERT INTO auth.users SELECT uid FROM public.ci_cases;
INSERT INTO public.account_security(user_id) SELECT uid FROM public.ci_cases;
INSERT INTO public.member_profiles(id,real_name,display_name) SELECT uid,CASE WHEN kind='held' THEN 'Different Registered Name' ELSE 'Test Example' END,'Public Stage Name' FROM public.ci_cases;
GRANT SELECT ON public.ci_cases TO service_role;
INSERT INTO storage.objects(bucket_id,name) VALUES('ccx-identity-evidence','synthetic.jpg'),('other-bucket','visible.jpg');

DO $$ BEGIN
 IF has_table_privilege('authenticated','public.ccx_idv_sessions','SELECT') OR has_function_privilege('authenticated','public.ccx_idv_transition(uuid,uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'FAIL browser authority'; END IF;
 IF (SELECT public FROM storage.buckets WHERE id='ccx-identity-evidence') THEN RAISE EXCEPTION 'FAIL public bucket'; END IF;
 IF public.ccx_idv_eligible_on('2008-02-29')<>'2026-03-02'::date OR public.ccx_idv_eligible_on('2008-12-31')<>'2027-01-01'::date THEN RAISE EXCEPTION 'FAIL calendar policy'; END IF;
END $$;
SET ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='ccx-identity-evidence')<>0 THEN RAISE EXCEPTION 'FAIL evidence visible through broad policy'; END IF;
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='other-bucket')<>1 THEN RAISE EXCEPTION 'FAIL unrelated storage changed'; END IF;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('ccx-identity-evidence','forged.jpg');RAISE EXCEPTION 'FAIL browser upload accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ DECLARE t record; BEGIN
 SELECT * INTO t FROM public.ci_cases LIMIT 1;
 BEGIN PERFORM public.ccx_idv_transition(t.uid,t.sid,'start','{}');RAISE EXCEPTION 'FAIL disabled start';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%VERIFICATION_UNAVAILABLE%' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
-- Synthetic approval markers are confined to this isolated disposable database.
UPDATE public.ccx_idv_config SET enabled=true,worker_origin='https://ci-fixture.up.railway.app',notice_version='CI-ONLY',notice_text=repeat('CI fixture, not a legal notice. ',4),retention_days=1,security_approved_at=now(),privacy_approved_at=now();
SET ROLE service_role;
DO $$
DECLARE t record; s jsonb; h text:=repeat('a',64); parts jsonb; k text; birth date; other_uid uuid;
BEGIN
 FOR t IN SELECT * FROM public.ci_cases ORDER BY kind LOOP
  s:=public.ccx_idv_transition(t.uid,t.sid,'start',jsonb_build_object('legal_name',CASE WHEN t.kind='adult' THEN 'Different Example' ELSE 'Test Example' END,'document_type','passport','issuing_country','US','consent_version','CI-ONLY','consent_hash',encode(extensions.digest(repeat('CI fixture, not a legal notice. ',4),'sha256'),'hex')));
  IF s->>'status'<>'collecting' OR EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid) THEN RAISE EXCEPTION 'FAIL premature admission';END IF;
  SELECT uid INTO other_uid FROM public.ci_cases WHERE uid<>t.uid LIMIT 1;
  BEGIN PERFORM public.ccx_idv_transition(other_uid,t.sid,'cancel');RAISE EXCEPTION 'FAIL cross-account transition';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%SESSION_NOT_FOUND%' THEN RAISE;END IF;END;
  BEGIN PERFORM public.ccx_idv_transition(t.uid,t.sid,'begin',jsonb_build_object('job_hash',h));RAISE EXCEPTION 'FAIL missing evidence';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%EVIDENCE_INCOMPLETE%' THEN RAISE;END IF;END;
  parts:='{}';
  FOREACH k IN ARRAY ARRAY['front','selfie','capture'] LOOP
   parts:=parts||jsonb_build_object(k,jsonb_build_object('path',t.uid||'/'||t.sid||'/'||k||'.fixture','sha256',h));
   INSERT INTO public.ccx_idv_uploads(path,session_id) VALUES(t.uid||'/'||t.sid||'/'||k||'.fixture',t.sid);
  END LOOP;
  s:=public.ccx_idv_transition(t.uid,t.sid,'upload',jsonb_build_object('parts',parts));
  BEGIN PERFORM public.ccx_idv_transition(t.uid,t.sid,'upload',jsonb_build_object('parts',jsonb_set(parts,'{front,sha256}',to_jsonb(repeat('b',64)))));RAISE EXCEPTION 'FAIL replaced evidence';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%EVIDENCE_IMMUTABLE%' THEN RAISE;END IF;END;
  s:=public.ccx_idv_transition(t.uid,t.sid,'begin',jsonb_build_object('job_hash',h));
  s:=public.ccx_idv_transition(NULL,t.sid,'claim',jsonb_build_object('job_hash',h));
  BEGIN PERFORM public.ccx_idv_transition(NULL,t.sid,'claim',jsonb_build_object('job_hash',h));RAISE EXCEPTION 'FAIL reusable capability';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%INVALID_CAPABILITY%' THEN RAISE;END IF;END;
  birth:=CASE t.kind WHEN 'minor' THEN ((now() AT TIME ZONE 'UTC')::date-interval '17 years')::date WHEN 'birthday' THEN ((now() AT TIME ZONE 'UTC')::date-interval '18 years')::date ELSE '1990-01-01'::date END;
  s:=public.ccx_idv_transition(t.uid,t.sid,'finish',jsonb_build_object('job_hash',h,'report_hash',h,'checks_passed',t.kind<>'failed','extracted_name','Test Example','document_number','CI-NOT-AN-ID-'||t.kind,'dob',birth,'document_expiry','2090-01-01','reason','fixture_failed_check'));
  IF t.kind='adult' THEN
   IF s->>'status'<>'name_mismatch' OR EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid) THEN RAISE EXCEPTION 'FAIL name mismatch admitted';END IF;
   s:=public.ccx_idv_transition(t.uid,t.sid,'confirm_name','{"legal_name":"Test Example"}');
   IF s->>'status'<>'approved' OR NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid) THEN RAISE EXCEPTION 'FAIL corrected identity admission';END IF;
   IF (SELECT display_name FROM public.member_profiles WHERE id=t.uid)<>'Public Stage Name' THEN RAISE EXCEPTION 'FAIL stage name overwritten';END IF;
   BEGIN UPDATE public.member_profiles SET real_name='Forged Name' WHERE id=t.uid;RAISE EXCEPTION 'FAIL verified name editable';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%verified legal name%' THEN RAISE;END IF;END;
  ELSIF t.kind IN ('minor','birthday') THEN
   IF s->>'status'<>'age_restricted' OR EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid) THEN RAISE EXCEPTION 'FAIL age restriction';END IF;
   IF t.kind='birthday' AND (s->>'eligible_on')::date<>(now() AT TIME ZONE 'UTC')::date+1 THEN RAISE EXCEPTION 'FAIL birthday wait';END IF;
   s:=public.ccx_idv_transition(t.uid,gen_random_uuid(),'start','{}');
   IF s->>'status'<>'age_restricted' THEN RAISE EXCEPTION 'FAIL repeated attempt age bypass';END IF;
  ELSIF t.kind='held' THEN
   IF s->>'status'<>'name_mismatch' OR EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid) THEN RAISE EXCEPTION 'FAIL registered account-name mismatch granted admission';END IF;
   IF (SELECT real_name FROM public.member_profiles WHERE id=t.uid)<>'Different Registered Name' THEN RAISE EXCEPTION 'FAIL account name overwritten';END IF;
  ELSIF t.kind='failed' THEN
   IF s->>'status'<>'review_required' OR EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t.uid) THEN RAISE EXCEPTION 'FAIL incomplete check admitted';END IF;
  END IF;
 END LOOP;
END $$;
RESET ROLE;
\ir ./identity-retake-assertions.sql
\ir ./identity-review-assertions.sql
UPDATE public.ccx_idv_sessions SET purge_after=now()-interval '1 day';
UPDATE public.ccx_idv_sessions SET legal_hold=true WHERE id=(SELECT sid FROM public.ci_cases WHERE kind='held');
SET ROLE service_role;
DO $$ DECLARE n integer; adult_sid uuid; held_sid uuid; BEGIN
 SELECT sid INTO adult_sid FROM public.ci_cases WHERE kind='adult';SELECT sid INTO held_sid FROM public.ci_cases WHERE kind='held';
 SELECT count(*) INTO n FROM public.ccx_idv_purge_candidates();
 IF n<>12 OR (SELECT purge_started_at FROM public.ccx_idv_sessions WHERE id=held_sid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL legal hold or candidate batch: %',n;END IF;
 BEGIN UPDATE public.ccx_idv_sessions SET legal_hold=true WHERE id=adult_sid;RAISE EXCEPTION 'FAIL late hold falsely accepted';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%DELETION_ALREADY_STARTED%' THEN RAISE;END IF;END;
 BEGIN UPDATE public.ccx_idv_sessions SET purge_started_at=NULL WHERE id=adult_sid;RAISE EXCEPTION 'FAIL deletion marker cleared';EXCEPTION WHEN OTHERS THEN IF sqlerrm NOT LIKE '%DELETION_ALREADY_STARTED%' THEN RAISE;END IF;END;
 PERFORM public.ccx_idv_finish_purge();
 IF (SELECT purged_at FROM public.ccx_idv_sessions WHERE id=adult_sid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL minimized before blob ledger cleared';END IF;
 -- This simulates a successful Storage deletion; no actual blob deletion is tested.
 DELETE FROM public.ccx_idv_uploads WHERE session_id<>held_sid;
 PERFORM public.ccx_idv_finish_purge();
 IF (SELECT count(*) FROM public.ccx_idv_sessions WHERE purged_at IS NOT NULL)<>4 THEN RAISE EXCEPTION 'FAIL purge completion';END IF;
 IF EXISTS(SELECT 1 FROM public.ccx_idv_sessions WHERE purged_at IS NOT NULL AND (legal_name<>'[deleted]' OR dob IS NOT NULL OR evidence<>'{}'::jsonb)) THEN RAISE EXCEPTION 'FAIL sensitive fields retained';END IF;
 IF EXISTS(SELECT 1 FROM public.age_verification_requests WHERE id=adult_sid AND (id_document_path IS NOT NULL OR selfie_document_path IS NOT NULL)) THEN RAISE EXCEPTION 'FAIL stale document paths';END IF;
 IF (SELECT count(*) FROM public.member_admissions)<>1 THEN RAISE EXCEPTION 'FAIL retention changed durable admission or admitted a mismatched legal identity';END IF;
 IF (SELECT count(*) FROM public.ccx_idv_events WHERE action='retention_deletion_finished')<>4 THEN RAISE EXCEPTION 'FAIL audit event missing';END IF;
 PERFORM public.ccx_idv_finish_purge();
 IF (SELECT count(*) FROM public.ccx_idv_events WHERE action='retention_deletion_finished')<>4 THEN RAISE EXCEPTION 'FAIL duplicate purge event';END IF;
END $$;
RESET ROLE;
SELECT 'PASS: actual identity migrations and transitions on disposable PostgreSQL; Auth/Storage/Vault are fixtures, real blob deletion and biometrics not tested.' AS result;
