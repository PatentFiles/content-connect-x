-- Participant-authored post-production accounts. These records are statements,
-- not independently established facts, signed amendments or additional consent.
-- No media uploads or explicit distribution capabilities are created.
BEGIN;

CREATE TABLE public.ccx_collaboration_actual_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK(revision BETWEEN 1 AND 100),
  plan_version integer NOT NULL CHECK(plan_version>0),
  idempotency_key uuid NOT NULL,
  work_completed text NOT NULL CHECK(length(work_completed) BETWEEN 5 AND 4000),
  deliverables_completed text NOT NULL DEFAULT '' CHECK(length(deliverables_completed)<=4000),
  differences_or_concerns text NOT NULL DEFAULT '' CHECK(length(differences_or_concerns)<=4000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collaboration_id,actor_id,revision),
  UNIQUE(collaboration_id,actor_id,idempotency_key)
);
CREATE INDEX ccx_actual_statements_history ON public.ccx_collaboration_actual_statements(collaboration_id,recorded_at,id);

ALTER TABLE public.ccx_collaboration_actual_statements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_collaboration_actual_statements FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.ccx_collaboration_actual_statements TO service_role;

CREATE FUNCTION ccx_workspace_private.ccx_guard_actual_statement()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $locked$
BEGIN RAISE EXCEPTION 'Participant completion statements are immutable. Add a correction instead.'; END $locked$;
REVOKE ALL ON FUNCTION ccx_workspace_private.ccx_guard_actual_statement() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_actual_statements_immutable BEFORE UPDATE OR DELETE
 ON public.ccx_collaboration_actual_statements
 FOR EACH ROW EXECUTE FUNCTION ccx_workspace_private.ccx_guard_actual_statement();

-- Backend passes the authenticated caller's ID, but SQL independently checks
-- account admission, participation, banned/suspended state and actual schedule.
-- All member statements are visible only to other members of this collaboration.
CREATE FUNCTION public.ccx_collaboration_actual_action(
 p_actor uuid,p_collaboration uuid,p_action text,
 p_idempotency uuid DEFAULT NULL,
 p_work text DEFAULT NULL,
 p_deliverables text DEFAULT '',
 p_differences text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $actuals$
DECLARE
  c_status text;
  expected_end timestamptz;
  current_version integer;
  record_item public.ccx_collaboration_actual_statements%rowtype;
  all_items jsonb;
  next_version integer;
  normalized_work text;
  normalized_deliverables text;
  normalized_differences text;
BEGIN
 IF p_actor IS NULL OR p_collaboration IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.account_security
  WHERE user_id=p_actor AND NOT banned AND NOT suspended
 ) OR NOT EXISTS(
  SELECT 1 FROM public.member_admissions
  WHERE user_id=p_actor AND admitted_at IS NOT NULL
 ) OR NOT EXISTS(
  SELECT 1 FROM public.collaboration_members
  WHERE user_id=p_actor AND collaboration_id=p_collaboration
 ) THEN RAISE EXCEPTION 'ACTUALS_NOT_PARTICIPANT' USING ERRCODE='42501'; END IF;

 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.recorded_at,a.id),'[]'::jsonb)
    INTO all_items FROM (
     SELECT id,collaboration_id,actor_id,revision,plan_version,work_completed,
       deliverables_completed,differences_or_concerns,recorded_at
     FROM public.ccx_collaboration_actual_statements
     WHERE collaboration_id=p_collaboration ORDER BY recorded_at,id LIMIT 150
    ) a;
  RETURN jsonb_build_object('statements',all_items);
 END IF;
 IF p_action<>'submit' OR p_idempotency IS NULL THEN
  RAISE EXCEPTION 'ACTUALS_INVALID_ACTION' USING ERRCODE='22023'; END IF;

 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_collaboration::text,98744));
 normalized_work:=btrim(coalesce(p_work,''));
 normalized_deliverables:=btrim(coalesce(p_deliverables,''));
 normalized_differences:=btrim(coalesce(p_differences,''));
 IF length(normalized_work)<5 OR length(normalized_work)>4000
   OR length(normalized_deliverables)>4000 OR length(normalized_differences)>4000
   THEN RAISE EXCEPTION 'ACTUALS_INVALID_CONTENT' USING ERRCODE='22023'; END IF;
 SELECT * INTO record_item FROM public.ccx_collaboration_actual_statements
 WHERE collaboration_id=p_collaboration AND actor_id=p_actor AND idempotency_key=p_idempotency;
 IF FOUND THEN
  IF record_item.work_completed IS DISTINCT FROM normalized_work
   OR record_item.deliverables_completed IS DISTINCT FROM normalized_deliverables
   OR record_item.differences_or_concerns IS DISTINCT FROM normalized_differences
   THEN RAISE EXCEPTION 'ACTUALS_IDEMPOTENCY_REUSED' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('statement',to_jsonb(record_item)-'idempotency_key','replayed',true);
 END IF;

 SELECT c.status,p.ends_at,p.version INTO c_status,expected_end,current_version
 FROM public.collaborations c
 LEFT JOIN public.ccx_collaboration_plans p ON p.collaboration_id=c.id
 WHERE c.id=p_collaboration;
 IF c_status IS NULL OR c_status IN ('cancelled','closed')
   OR expected_end IS NULL OR expected_end>now() OR current_version IS NULL
   THEN RAISE EXCEPTION 'ACTUALS_NOT_YET_AVAILABLE' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(revision),0)+1 INTO next_version
 FROM public.ccx_collaboration_actual_statements
 WHERE collaboration_id=p_collaboration AND actor_id=p_actor;
 IF next_version>100 THEN RAISE EXCEPTION 'ACTUALS_REVISION_LIMIT' USING ERRCODE='22023'; END IF;
 INSERT INTO public.ccx_collaboration_actual_statements(
  collaboration_id,actor_id,revision,plan_version,idempotency_key,
  work_completed,deliverables_completed,differences_or_concerns)
 VALUES(p_collaboration,p_actor,next_version,current_version,p_idempotency,
  normalized_work,normalized_deliverables,normalized_differences)
 RETURNING * INTO record_item;
 RETURN jsonb_build_object('statement',to_jsonb(record_item)-'idempotency_key','replayed',false);
END $actuals$;
REVOKE ALL ON FUNCTION public.ccx_collaboration_actual_action(uuid,uuid,text,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_collaboration_actual_action(uuid,uuid,text,uuid,text,text,text) TO service_role;
COMMENT ON FUNCTION public.ccx_collaboration_actual_action(uuid,uuid,text,uuid,text,text,text) IS
 'Service-only individual post-production statements, immutable revisions, non-authoritative and independent of consent or contract changes.';
COMMIT;