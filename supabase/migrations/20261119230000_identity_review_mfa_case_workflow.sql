-- Phase One: qualified identity review queue. No admission decisions are made here.
-- Requires self_hosted_identity_v2.sql and retention hardening. Does not
-- activate identity verification, make biometric evidence public, or permit
-- reviewers to change worker verdicts / legal ages.
BEGIN;

CREATE TABLE public.ccx_idv_review_cases (
  session_id uuid PRIMARY KEY REFERENCES public.ccx_idv_sessions(id) ON DELETE RESTRICT,
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','claimed','closed')),
  assigned_reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  disposition text CHECK(disposition IN ('fresh_capture_required','insufficient_evidence','specialist_followup')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK ((status='claimed') = (assigned_reviewer_id IS NOT NULL)),
  CHECK ((status='closed') = (closed_at IS NOT NULL)),
  CHECK (status<>'closed' OR disposition IS NOT NULL)
);
CREATE INDEX ccx_idv_review_cases_queue ON public.ccx_idv_review_cases(status,opened_at);
CREATE TABLE public.ccx_idv_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.ccx_idv_sessions(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK(action IN ('review_requested','queue_viewed','case_claimed','case_released','case_closed','evidence_access_authorized')),
  from_status text,
  to_status text,
  reason_code text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ccx_idv_review_events_case ON public.ccx_idv_review_events(session_id,recorded_at);
ALTER TABLE public.ccx_idv_review_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_idv_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_idv_review_cases,public.ccx_idv_review_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.ccx_idv_review_cases TO service_role;
GRANT SELECT,INSERT ON public.ccx_idv_review_events TO service_role;

CREATE FUNCTION ccx_internal.ccx_guard_idv_review_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
BEGIN RAISE EXCEPTION 'Identity review history is append-only'; END $guard$;
REVOKE ALL ON FUNCTION ccx_internal.ccx_guard_idv_review_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_idv_review_events_immutable BEFORE UPDATE OR DELETE
 ON public.ccx_idv_review_events FOR EACH ROW EXECUTE FUNCTION ccx_internal.ccx_guard_idv_review_event();

CREATE FUNCTION ccx_internal.ccx_idv_open_review_case()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $request$
BEGIN
 IF OLD.review_requested_at IS NULL AND NEW.review_requested_at IS NOT NULL THEN
  INSERT INTO public.ccx_idv_review_cases(session_id,requester_id)
  VALUES(NEW.id,NEW.user_id) ON CONFLICT(session_id) DO NOTHING;
  INSERT INTO public.ccx_idv_review_events(session_id,actor_id,action,to_status)
  VALUES(NEW.id,NEW.user_id,'review_requested','queued');
 END IF;
 RETURN NEW;
END $request$;
REVOKE ALL ON FUNCTION ccx_internal.ccx_idv_open_review_case() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_idv_review_requested AFTER UPDATE OF review_requested_at
 ON public.ccx_idv_sessions FOR EACH ROW EXECUTE FUNCTION ccx_internal.ccx_idv_open_review_case();

-- Preserve previously requested reviews rather than leaving them unassigned.
INSERT INTO public.ccx_idv_review_cases(session_id,requester_id,opened_at)
SELECT s.id,s.user_id,s.review_requested_at FROM public.ccx_idv_sessions s
WHERE s.review_requested_at IS NOT NULL ON CONFLICT(session_id) DO NOTHING;

-- Called ONLY by the authenticated Edge handler with server-verified p_actor
-- and current MFA (AAL2). The database independently checks active admin status,
-- onboarding, ownership and case assignment. It cannot approve any ID.
CREATE FUNCTION public.ccx_idv_review_case(
 p_actor uuid, p_session uuid, p_action text, p_disposition text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $review$
DECLARE
  case_item public.ccx_idv_review_cases%rowtype;
  summary jsonb;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.account_security
   WHERE user_id=p_actor AND admin AND NOT banned AND NOT suspended
 ) OR NOT EXISTS(
   SELECT 1 FROM public.member_admissions WHERE user_id=p_actor
 ) THEN RAISE EXCEPTION 'REVIEW_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO summary FROM(
    SELECT c.session_id AS id,c.status AS case_status,c.assigned_reviewer_id,
      c.opened_at,c.updated_at,c.disposition,c.closed_at,
      s.status AS verification_status,s.reason,s.purged_at,s.legal_hold,
      (s.evidence ? 'front') AS has_front,(s.evidence ? 'back') AS has_back,
      (s.evidence ? 'selfie') AS has_selfie
    FROM public.ccx_idv_review_cases c
    JOIN public.ccx_idv_sessions s ON s.id=c.session_id
    ORDER BY CASE c.status WHEN 'queued' THEN 0 WHEN 'claimed' THEN 1 ELSE 2 END,
      c.opened_at DESC LIMIT 100
  ) q;
  INSERT INTO public.ccx_idv_review_events(actor_id,action)
    VALUES(p_actor,'queue_viewed');
  RETURN jsonb_build_object('cases',summary,'reviewer_id',p_actor);
 END IF;
 IF p_session IS NULL THEN RAISE EXCEPTION 'REVIEW_CASE_REQUIRED' USING ERRCODE='22023'; END IF;
 SELECT * INTO case_item FROM public.ccx_idv_review_cases
 WHERE session_id=p_session FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_CASE_NOT_FOUND' USING ERRCODE='42501'; END IF;
 IF case_item.requester_id=p_actor THEN
   RAISE EXCEPTION 'INDEPENDENT_REVIEW_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_action='claim' THEN
  IF case_item.status='closed' OR (case_item.status='claimed' AND case_item.assigned_reviewer_id<>p_actor)
    THEN RAISE EXCEPTION 'REVIEW_CASE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  IF case_item.status='queued' THEN
   UPDATE public.ccx_idv_review_cases SET
     status='claimed',assigned_reviewer_id=p_actor,assigned_at=now(),updated_at=now()
   WHERE session_id=p_session RETURNING * INTO case_item;
   INSERT INTO public.ccx_idv_review_events(session_id,actor_id,action,from_status,to_status)
     VALUES(p_session,p_actor,'case_claimed','queued','claimed');
  END IF;
 ELSIF p_action='release' THEN
  IF case_item.status<>'claimed' OR case_item.assigned_reviewer_id IS DISTINCT FROM p_actor
    THEN RAISE EXCEPTION 'REVIEW_NOT_ASSIGNED' USING ERRCODE='42501'; END IF;
  UPDATE public.ccx_idv_review_cases SET status='queued',
    assigned_reviewer_id=NULL,assigned_at=NULL,updated_at=now()
  WHERE session_id=p_session RETURNING * INTO case_item;
  INSERT INTO public.ccx_idv_review_events(session_id,actor_id,action,from_status,to_status)
    VALUES(p_session,p_actor,'case_released','claimed','queued');
 ELSIF p_action IN ('close','authorize_read') THEN
  IF case_item.status<>'claimed' OR case_item.assigned_reviewer_id IS DISTINCT FROM p_actor
    THEN RAISE EXCEPTION 'REVIEW_NOT_ASSIGNED' USING ERRCODE='42501'; END IF;
  IF p_action='close' THEN
   IF p_disposition NOT IN ('fresh_capture_required','insufficient_evidence','specialist_followup') OR p_disposition IS NULL
     THEN RAISE EXCEPTION 'REVIEW_DISPOSITION_REQUIRED' USING ERRCODE='22023'; END IF;
   UPDATE public.ccx_idv_review_cases SET status='closed',assigned_reviewer_id=NULL,
     assigned_at=NULL,closed_at=now(),disposition=p_disposition,updated_at=now()
   WHERE session_id=p_session RETURNING * INTO case_item;
   INSERT INTO public.ccx_idv_review_events(session_id,actor_id,action,from_status,to_status,reason_code)
     VALUES(p_session,p_actor,'case_closed','claimed','closed',p_disposition);
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.ccx_idv_sessions
     WHERE id=p_session AND purged_at IS NULL AND purge_started_at IS NULL)
    THEN RAISE EXCEPTION 'REVIEW_EVIDENCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
   INSERT INTO public.ccx_idv_review_events(session_id,actor_id,action)
     VALUES(p_session,p_actor,'evidence_access_authorized');
  END IF;
 ELSE
  RAISE EXCEPTION 'REVIEW_UNKNOWN_ACTION' USING ERRCODE='22023';
 END IF;
 RETURN jsonb_build_object('id',case_item.session_id,'case_status',case_item.status,
   'assigned_reviewer_id',case_item.assigned_reviewer_id,'disposition',case_item.disposition);
END $review$;
REVOKE ALL ON FUNCTION public.ccx_idv_review_case(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_idv_review_case(uuid,uuid,text,text) TO service_role;
COMMENT ON FUNCTION public.ccx_idv_review_case(uuid,uuid,text,text) IS
 'Service-only scoped identity review queue. No approval, age override or identity state mutation.';
COMMIT;
