-- Yoti-only new signup admission. Existing admissions and historic evidence remain unchanged.
ALTER TABLE public.ccx_age_provider_sessions ADD COLUMN IF NOT EXISTS policy_version text;
DROP POLICY IF EXISTS "own verification uploads" ON storage.objects;
CREATE TABLE IF NOT EXISTS public.ccx_yoti_start_limits (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 window_started_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE public.ccx_yoti_start_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_yoti_start_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ccx_yoti_start_limits TO service_role;
CREATE OR REPLACE FUNCTION public.ccx_reserve_yoti_start(p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE entry public.ccx_yoti_start_limits;
BEGIN
 IF p_user IS NULL THEN RETURN false; END IF;
 INSERT INTO public.ccx_yoti_start_limits(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO entry FROM public.ccx_yoti_start_limits WHERE user_id=p_user FOR UPDATE;
 IF entry.window_started_at<now()-interval '1 hour' THEN
  UPDATE public.ccx_yoti_start_limits SET window_started_at=now(),attempts=1 WHERE user_id=p_user; RETURN true;
 END IF;
 IF entry.attempts>=5 THEN RETURN false; END IF;
 UPDATE public.ccx_yoti_start_limits SET attempts=attempts+1 WHERE user_id=p_user;RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ccx_reserve_yoti_start(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_reserve_yoti_start(uuid) TO service_role;

CREATE OR REPLACE FUNCTION ccx_internal.require_yoti_new_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
  IF NEW.provider IS DISTINCT FROM 'yoti' OR NEW.verification_method IS DISTINCT FROM 'DOC_SCAN'
    OR NEW.verified_at IS NULL OR coalesce(length(NEW.evidence_reference),0)=0 OR NOT EXISTS(
     SELECT 1 FROM public.ccx_age_provider_sessions s WHERE s.user_id=NEW.user_id
     AND s.provider_session_id=NEW.provider_session_id AND s.provider='yoti' AND s.mode='age_gate' AND s.policy_version='document_selfie_v1'
    ) THEN RAISE EXCEPTION 'New age approvals require a bound Yoti Doc Scan result'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ccx_internal.require_yoti_new_approval() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ccx_yoti_approval_only ON public.age_verification_requests;
CREATE TRIGGER ccx_yoti_approval_only BEFORE INSERT OR UPDATE OF status ON public.age_verification_requests
 FOR EACH ROW EXECUTE FUNCTION ccx_internal.require_yoti_new_approval();

CREATE OR REPLACE FUNCTION public.ccx_finish_yoti_session(p_user uuid,p_session uuid,p_status text,p_method text,p_evidence text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.ccx_age_provider_sessions; verification uuid;
BEGIN
 SELECT * INTO s FROM public.ccx_age_provider_sessions WHERE id=p_session AND user_id=p_user AND mode='age_gate' AND policy_version='document_selfie_v1' FOR UPDATE;
 IF NOT FOUND OR p_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid verification session'; END IF;
 IF s.status NOT IN ('pending','processing','provider_error') THEN RETURN jsonb_build_object('status',s.status,'method',s.method); END IF;
 IF p_status NOT IN ('pending','processing','age_confirmed','review_required','rejected','expired','provider_error') THEN RAISE EXCEPTION 'Invalid provider status'; END IF;
 IF p_status='age_confirmed' THEN
  IF p_method IS DISTINCT FROM 'DOC_SCAN' OR coalesce(length(p_evidence),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Document and selfie evidence required'; END IF;
  INSERT INTO public.age_verification_requests(user_id,status,provider,provider_session_id,verification_method,evidence_reference,verified_at,reviewed_at)
   VALUES(p_user,'approved','yoti',s.provider_session_id,'DOC_SCAN',p_evidence,now(),now())
   ON CONFLICT(provider_session_id) DO UPDATE SET status='approved',verified_at=coalesce(age_verification_requests.verified_at,now()),
    evidence_reference=excluded.evidence_reference,reviewed_at=now()
   RETURNING id INTO verification;
 END IF;
 UPDATE public.ccx_age_provider_sessions SET status=p_status,method=nullif(p_method,''),evidence_id=p_evidence,
  age_threshold_passed=(p_status='age_confirmed'),provider_response_hash=p_hash,verification_request_id=verification,
  confirmed_at=CASE WHEN p_status='age_confirmed' THEN now() ELSE NULL END WHERE id=s.id;
 RETURN jsonb_build_object('status',p_status,'method',p_method,'age_verified',p_status='age_confirmed');
END $$;
REVOKE ALL ON FUNCTION public.ccx_finish_yoti_session(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_finish_yoti_session(uuid,uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION ccx_internal.bootstrap_signup_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.account_security(user_id,admin,banned,suspended) VALUES(NEW.id,false,false,false) ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO public.member_profiles(id,display_name,role_type,profile_complete)
  VALUES(NEW.id,left(trim(coalesce(NEW.raw_user_meta_data->>'display_name','')),80),'creator',false) ON CONFLICT(id) DO NOTHING;
 -- User-editable metadata can set only presentation data, never role, admin or admission.
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ccx_internal.bootstrap_signup_account() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
