-- Voluntary on-location check-ins for accepted collaboration participants.
-- Stores NO GPS coordinates, contact phone numbers, third-party names or documents.
-- Recording a concern does not notify emergency services or claim monitored safety.
BEGIN;

CREATE TABLE public.ccx_collaboration_safety_checkins (
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL CHECK(status IN('checked_in','safe','left','concern_recorded')),
 contact_informed_by_member boolean NOT NULL DEFAULT false,
 checked_in_at timestamptz,
 marked_safe_at timestamptz,
 left_at timestamptz,
 concern_recorded_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(collaboration_id,user_id)
);
CREATE INDEX ccx_safety_checkin_user ON public.ccx_collaboration_safety_checkins(user_id,updated_at DESC);

CREATE TABLE public.ccx_collaboration_safety_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 event_type text NOT NULL CHECK(event_type IN('checked_in','marked_safe','left','concern_recorded')),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ccx_safety_events_collab_actor ON public.ccx_collaboration_safety_events(collaboration_id,actor_id,recorded_at);
ALTER TABLE public.ccx_collaboration_safety_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_collaboration_safety_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_collaboration_safety_checkins,public.ccx_collaboration_safety_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.ccx_collaboration_safety_checkins TO service_role;
GRANT SELECT,INSERT ON public.ccx_collaboration_safety_events TO service_role;

CREATE FUNCTION public.ccx_safety_events_append_only()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
BEGIN RAISE EXCEPTION 'Safety check-in history is append-only'; END $guard$;
REVOKE ALL ON FUNCTION public.ccx_safety_events_append_only() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_safety_events_immutable BEFORE UPDATE OR DELETE
 ON public.ccx_collaboration_safety_events FOR EACH ROW EXECUTE FUNCTION public.ccx_safety_events_append_only();

-- Only trusted Edge code may supply the user ID. Independently re-check account
-- admission and membership inside the database, under a per-user/session lock.
CREATE FUNCTION public.ccx_collaboration_safety_action(
 p_actor uuid,p_collaboration uuid,p_action text,
 p_contact_informed boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $checkin$
DECLARE
  row_item public.ccx_collaboration_safety_checkins%rowtype;
  plan_start timestamptz;plan_end timestamptz;collab_status text;
  available boolean;outcome text;
BEGIN
 IF p_actor IS NULL OR p_collaboration IS NULL THEN
  RAISE EXCEPTION 'SAFETY_SIGN_IN_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_collaboration::text,8491));
 IF NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=p_actor AND admitted_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.account_security WHERE user_id=p_actor AND NOT banned AND NOT suspended)
    OR NOT EXISTS(SELECT 1 FROM public.collaboration_members WHERE user_id=p_actor AND collaboration_id=p_collaboration)
 THEN RAISE EXCEPTION 'SAFETY_NOT_PARTICIPANT' USING ERRCODE='42501'; END IF;
 SELECT c.status,p.starts_at,p.ends_at INTO collab_status,plan_start,plan_end
 FROM public.collaborations c
 LEFT JOIN public.ccx_collaboration_plans p ON p.collaboration_id=c.id
 WHERE c.id=p_collaboration;
 available:=(collab_status NOT IN ('cancelled','closed','archived','completed')
   AND plan_start IS NOT NULL
   AND now()>=plan_start-interval '4 hours'
   AND now()<=coalesce(plan_end,plan_start+interval '4 hours')+interval '12 hours');
 SELECT * INTO row_item FROM public.ccx_collaboration_safety_checkins
 WHERE collaboration_id=p_collaboration AND user_id=p_actor FOR UPDATE;
 IF p_action='status' THEN
  RETURN jsonb_build_object(
   'status',coalesce(row_item.status,'not_started'),
   'checked_in_at',row_item.checked_in_at,
   'marked_safe_at',row_item.marked_safe_at,
   'left_at',row_item.left_at,
   'concern_recorded_at',row_item.concern_recorded_at,
   'contact_informed_by_member',coalesce(row_item.contact_informed_by_member,false),
   'can_check_in',coalesce(available,false) AND row_item.status IS NULL,
   'schedule_available',plan_start IS NOT NULL,
   'monitored_emergency_response',false
  );
 END IF;
 IF p_action NOT IN('check_in','mark_safe','leave','record_concern') OR p_action IS NULL
   THEN RAISE EXCEPTION 'SAFETY_INVALID_ACTION' USING ERRCODE='22023'; END IF;
 IF p_action='check_in' THEN
  IF NOT coalesce(available,false) THEN
   RAISE EXCEPTION 'SAFETY_OUTSIDE_SCHEDULE' USING ERRCODE='22023'; END IF;
  IF row_item.status IS NOT NULL THEN
   IF row_item.status<>'checked_in' THEN RAISE EXCEPTION 'SAFETY_ALREADY_RECORDED' USING ERRCODE='22023'; END IF;
  ELSE
   INSERT INTO public.ccx_collaboration_safety_checkins(
     collaboration_id,user_id,status,checked_in_at,contact_informed_by_member)
   VALUES(p_collaboration,p_actor,'checked_in',now(),coalesce(p_contact_informed,false))
   RETURNING * INTO row_item;
   INSERT INTO public.ccx_collaboration_safety_events(collaboration_id,actor_id,event_type)
   VALUES(p_collaboration,p_actor,'checked_in');
  END IF;
 ELSIF p_action='mark_safe' THEN
  IF row_item.status IS NULL OR row_item.checked_in_at IS NULL
    OR row_item.status='left' THEN RAISE EXCEPTION 'SAFETY_NOT_CHECKED_IN' USING ERRCODE='22023'; END IF;
  IF row_item.status<>'safe' THEN
   UPDATE public.ccx_collaboration_safety_checkins SET status='safe',
      marked_safe_at=now(),updated_at=now()
   WHERE collaboration_id=p_collaboration AND user_id=p_actor RETURNING * INTO row_item;
   INSERT INTO public.ccx_collaboration_safety_events(collaboration_id,actor_id,event_type)
   VALUES(p_collaboration,p_actor,'marked_safe');
  END IF;
 ELSIF p_action='leave' THEN
  IF row_item.status IS NULL THEN
   INSERT INTO public.ccx_collaboration_safety_checkins(collaboration_id,user_id,status,left_at)
   VALUES(p_collaboration,p_actor,'left',now()) RETURNING * INTO row_item;
  ELSIF row_item.status<>'left' THEN
   UPDATE public.ccx_collaboration_safety_checkins SET status='left',
     left_at=now(),updated_at=now()
   WHERE collaboration_id=p_collaboration AND user_id=p_actor RETURNING * INTO row_item;
  END IF;
  IF (SELECT count(*) FROM public.ccx_collaboration_safety_events
     WHERE collaboration_id=p_collaboration AND actor_id=p_actor AND event_type='left')=0 THEN
   INSERT INTO public.ccx_collaboration_safety_events(collaboration_id,actor_id,event_type)
   VALUES(p_collaboration,p_actor,'left');
  END IF;
 ELSIF p_action='record_concern' THEN
  IF row_item.status IS NULL THEN
   INSERT INTO public.ccx_collaboration_safety_checkins(collaboration_id,user_id,status,concern_recorded_at)
   VALUES(p_collaboration,p_actor,'concern_recorded',now()) RETURNING * INTO row_item;
  ELSIF row_item.concern_recorded_at IS NULL THEN
   UPDATE public.ccx_collaboration_safety_checkins SET
     status=CASE WHEN status='left' THEN 'left' ELSE 'concern_recorded' END,
     concern_recorded_at=now(),updated_at=now()
   WHERE collaboration_id=p_collaboration AND user_id=p_actor RETURNING * INTO row_item;
  END IF;
  IF (SELECT count(*) FROM public.ccx_collaboration_safety_events
    WHERE collaboration_id=p_collaboration AND actor_id=p_actor AND event_type='concern_recorded')=0 THEN
   INSERT INTO public.ccx_collaboration_safety_events(collaboration_id,actor_id,event_type)
   VALUES(p_collaboration,p_actor,'concern_recorded');
  END IF;
 END IF;
 RETURN jsonb_build_object('status',row_item.status,'checked_in_at',row_item.checked_in_at,
   'marked_safe_at',row_item.marked_safe_at,'left_at',row_item.left_at,
   'concern_recorded_at',row_item.concern_recorded_at,
   'contact_informed_by_member',row_item.contact_informed_by_member,
   'monitored_emergency_response',false);
END $checkin$;
REVOKE ALL ON FUNCTION public.ccx_collaboration_safety_action(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_collaboration_safety_action(uuid,uuid,text,boolean) TO service_role;
COMMENT ON FUNCTION public.ccx_collaboration_safety_action(uuid,uuid,text,boolean) IS
 'Private voluntary participant self-report only. No GPS, third-party contacts, automatic consent, or monitored emergency dispatch.';
COMMIT;
