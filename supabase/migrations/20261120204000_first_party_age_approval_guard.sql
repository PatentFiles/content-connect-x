-- Only first-party Railway-processed evidence may create new age admissions.
-- Historical evidence stays intact, but the retired provider has no admission branch.
CREATE OR REPLACE FUNCTION ccx_internal.require_first_party_idv_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
DECLARE cfg public.ccx_idv_config%rowtype; s public.ccx_idv_sessions%rowtype;
BEGIN
 IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
  IF NEW.provider IS DISTINCT FROM 'idswyft_self_hosted'
   OR NEW.verification_method IS DISTINCT FROM 'DOCUMENT_SELFIE' THEN
    RAISE EXCEPTION 'Only first-party verified document and live-selfie evidence may grant admission';
  END IF;
  IF EXISTS(SELECT 1 FROM public.ccx_idv_accounts
   WHERE user_id=NEW.user_id AND eligible_on>(now() AT TIME ZONE 'UTC')::date) THEN
    RAISE EXCEPTION 'Age restriction is active';
  END IF;
  SELECT * INTO cfg FROM public.ccx_idv_config WHERE singleton;
  SELECT * INTO s FROM public.ccx_idv_sessions WHERE id=NEW.id AND user_id=NEW.user_id;
  IF cfg.singleton IS DISTINCT FROM true OR cfg.enabled IS DISTINCT FROM true
    OR s.id IS NULL OR s.status IS DISTINCT FROM 'approved'
    OR s.checks_passed IS DISTINCT FROM true OR s.policy_version IS DISTINCT FROM 'ccx-idv-v2'
    OR s.eligible_on IS NULL OR s.dob IS NULL OR s.document_expiry IS NULL
    OR s.document_expiry<(now() AT TIME ZONE 'UTC')::date
    OR s.report_hash IS NULL OR s.eligible_on>(now() AT TIME ZONE 'UTC')::date
    OR s.report_hash IS DISTINCT FROM NEW.evidence_reference
    OR NEW.provider_session_id IS DISTINCT FROM s.id::text OR NEW.verified_at IS NULL
    OR s.extracted_name IS NULL OR s.legal_name IS NULL
    OR regexp_replace(lower(btrim(s.legal_name)),'[[:space:]]+',' ','g')
       IS DISTINCT FROM regexp_replace(lower(btrim(s.extracted_name)),'[[:space:]]+',' ','g')
    OR NOT EXISTS (
      SELECT 1 FROM public.member_profiles p
      WHERE p.id=NEW.user_id AND p.real_name IS NOT NULL
      AND regexp_replace(lower(btrim(p.real_name)),'[[:space:]]+',' ','g')
         =regexp_replace(lower(btrim(s.extracted_name)),'[[:space:]]+',' ','g')
    )
    OR NOT (s.evidence ?& array['front','selfie','capture'])
    OR (s.document_type<>'passport' AND NOT (s.evidence?'back'))
  THEN RAISE EXCEPTION 'Bound first-party identity evidence required'; END IF;
 END IF;
 RETURN NEW;
END $guard$;
DROP TRIGGER IF EXISTS ccx_yoti_approval_only ON public.age_verification_requests;
DROP TRIGGER IF EXISTS ccx_first_party_admission_guard ON public.age_verification_requests;
CREATE TRIGGER ccx_first_party_admission_guard
 BEFORE INSERT OR UPDATE OF status ON public.age_verification_requests
 FOR EACH ROW EXECUTE FUNCTION ccx_internal.require_first_party_idv_approval();
DROP FUNCTION IF EXISTS ccx_internal.require_yoti_new_approval();
REVOKE ALL ON FUNCTION ccx_internal.require_first_party_idv_approval() FROM public,anon,authenticated;
