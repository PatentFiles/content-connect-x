-- Travel calendar, member-specific friendship/introduction policy, private
-- append-only project notes and per-production work-clearance deadlines.
-- Never store medical test results or exact travel addresses.
BEGIN;

CREATE TABLE public.ccx_profile_travel (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 entry_type text NOT NULL CHECK (entry_type IN ('travel','available','unavailable')),
 city text NOT NULL CHECK(length(btrim(city)) BETWEEN 2 AND 120),
 state text NOT NULL DEFAULT '' CHECK(length(state)<=100),
 country text NOT NULL CHECK(length(btrim(country)) BETWEEN 2 AND 100),
 starts_on date NOT NULL,ends_on date NOT NULL,
 visibility text NOT NULL DEFAULT 'only_me' CHECK(visibility IN('only_me','friends','verified')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=250),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on AND ends_on<=starts_on+365),
 CHECK(starts_on >= DATE '2020-01-01')
);
CREATE INDEX ccx_profile_travel_owner_dates ON public.ccx_profile_travel(user_id,starts_on,ends_on);
ALTER TABLE public.ccx_profile_travel ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_profile_travel FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ccx_profile_travel TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ccx_profile_travel TO service_role;
CREATE POLICY "Owner and authorized adults see city-level travel"
 ON public.ccx_profile_travel FOR SELECT TO authenticated USING(
  user_id=(SELECT auth.uid())
  OR (
   (SELECT auth.uid()) IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.member_admissions x WHERE x.user_id=(SELECT auth.uid()) AND x.admitted_at IS NOT NULL)
   AND EXISTS(SELECT 1 FROM public.account_security a WHERE a.user_id=(SELECT auth.uid()) AND NOT a.banned AND NOT a.suspended)
   AND NOT EXISTS(SELECT 1 FROM public.member_blocks b WHERE
      (b.blocker_id=(SELECT auth.uid()) AND b.blocked_id=user_id)
      OR (b.blocked_id=(SELECT auth.uid()) AND b.blocker_id=user_id))
   AND (
     visibility='verified'
     OR (visibility='friends' AND EXISTS (
       SELECT 1 FROM public.member_connection_requests r WHERE r.status='accepted'
         AND ((r.requester_id=(SELECT auth.uid()) AND r.recipient_id=user_id)
           OR (r.recipient_id=(SELECT auth.uid()) AND r.requester_id=user_id))))
  )));
CREATE POLICY "Creator inserts own city-level travel" ON public.ccx_profile_travel
 FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND
  EXISTS(SELECT 1 FROM public.member_admissions v WHERE v.user_id=user_id AND v.admitted_at IS NOT NULL));
CREATE POLICY "Creator updates own city-level travel" ON public.ccx_profile_travel
 FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid()))
 WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY "Creator removes own travel" ON public.ccx_profile_travel
 FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE TABLE public.ccx_friend_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 request_policy text NOT NULL DEFAULT 'message_first'
   CHECK(request_policy IN('everyone','message_first','no_one')),
 allow_intro_messages boolean NOT NULL DEFAULT true,
 allow_nonfriend_collaboration_invites boolean NOT NULL DEFAULT false,
 friend_count_visibility text NOT NULL DEFAULT 'private'
   CHECK(friend_count_visibility IN('public','verified','private')),
 friend_request_daily_limit integer NOT NULL DEFAULT 10 CHECK(friend_request_daily_limit BETWEEN 1 AND 25),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ccx_friend_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_friend_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ccx_friend_preferences TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ccx_friend_preferences TO service_role;
CREATE POLICY "Read my friendship settings" ON public.ccx_friend_preferences
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY "Create my friendship settings" ON public.ccx_friend_preferences
 FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY "Edit my friendship settings" ON public.ccx_friend_preferences
 FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));

CREATE TABLE public.ccx_friend_introductions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'awaiting_reply' CHECK(status IN ('awaiting_reply','completed','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),responded_at timestamptz,
 CHECK(requester_id<>recipient_id)
);
CREATE INDEX ccx_friend_intro_actor ON public.ccx_friend_introductions(requester_id,created_at DESC);
CREATE INDEX ccx_friend_intro_recipient ON public.ccx_friend_introductions(recipient_id,created_at DESC);
CREATE TABLE public.ccx_friend_intro_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 introduction_id uuid NOT NULL REFERENCES public.ccx_friend_introductions(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 2 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ccx_friend_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_friend_intro_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_friend_introductions,public.ccx_friend_intro_messages
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.ccx_friend_introductions TO service_role;
GRANT SELECT,INSERT ON public.ccx_friend_intro_messages TO service_role;
CREATE FUNCTION public.ccx_friend_intro(
 p_actor uuid,p_action text,p_target uuid DEFAULT NULL,p_introduction uuid DEFAULT NULL,p_text text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $intro$
DECLARE row_item public.ccx_friend_introductions%rowtype;body text:=btrim(coalesce(p_text,''));
 items jsonb;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.member_admissions v WHERE v.user_id=p_actor AND v.admitted_at IS NOT NULL)
  OR NOT EXISTS(SELECT 1 FROM public.account_security s WHERE s.user_id=p_actor AND NOT s.banned AND NOT s.suspended)
 THEN RAISE EXCEPTION 'INTRO_NOT_VERIFIED' USING ERRCODE='42501'; END IF;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',i.id,'requester_id',i.requester_id,'recipient_id',i.recipient_id,
   'status',i.status,'created_at',i.created_at,
   'messages',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sender_id',m.sender_id,'body',m.body,'created_at',m.created_at) ORDER BY m.created_at),'[]'::jsonb)
    FROM public.ccx_friend_intro_messages m WHERE m.introduction_id=i.id))
   ORDER BY i.created_at DESC),'[]'::jsonb) INTO items
   FROM (SELECT * FROM public.ccx_friend_introductions
     WHERE requester_id=p_actor OR recipient_id=p_actor ORDER BY created_at DESC LIMIT 50) i;
  RETURN jsonb_build_object('items',items);
 END IF;
 IF p_action='start' THEN
  IF p_target IS NULL OR p_target=p_actor OR length(body) NOT BETWEEN 10 AND 1000
   THEN RAISE EXCEPTION 'INTRO_INVALID' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(least(p_actor::text,p_target::text)||greatest(p_actor::text,p_target::text),8899));
  IF NOT EXISTS(SELECT 1 FROM public.member_admissions v WHERE v.user_id=p_target AND v.admitted_at IS NOT NULL)
   OR NOT EXISTS(SELECT 1 FROM public.account_security s WHERE s.user_id=p_target AND NOT s.banned AND NOT s.suspended)
   OR EXISTS(SELECT 1 FROM public.member_blocks b WHERE
      (b.blocker_id=p_actor AND b.blocked_id=p_target) OR (b.blocked_id=p_actor AND b.blocker_id=p_target))
   OR EXISTS(SELECT 1 FROM public.ccx_friend_preferences f WHERE f.user_id=p_target AND (f.request_policy='no_one' OR NOT f.allow_intro_messages))
  THEN RAISE EXCEPTION 'INTRO_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.ccx_friend_introductions WHERE requester_id=p_actor
    AND created_at>=now()-interval '7 days')>=10 THEN
     RAISE EXCEPTION 'INTRO_RATE_LIMIT' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.ccx_friend_introductions
    WHERE (requester_id=p_actor AND recipient_id=p_target)
      OR (requester_id=p_target AND recipient_id=p_actor))
   THEN RAISE EXCEPTION 'INTRO_EXISTS' USING ERRCODE='23505'; END IF;
  INSERT INTO public.ccx_friend_introductions(requester_id,recipient_id)
   VALUES(p_actor,p_target) RETURNING * INTO row_item;
  INSERT INTO public.ccx_friend_intro_messages(introduction_id,sender_id,body)
   VALUES(row_item.id,p_actor,body);
  RETURN jsonb_build_object('id',row_item.id,'status',row_item.status);
 END IF;
 IF p_action IN('reply','decline') THEN
  IF p_introduction IS NULL THEN RAISE EXCEPTION 'INTRO_INVALID' USING ERRCODE='22023'; END IF;
  SELECT * INTO row_item FROM public.ccx_friend_introductions
   WHERE id=p_introduction AND recipient_id=p_actor FOR UPDATE;
  IF NOT FOUND OR row_item.status<>'awaiting_reply' THEN
   RAISE EXCEPTION 'INTRO_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  IF p_action='reply' THEN
   IF length(body) NOT BETWEEN 2 AND 1000 THEN RAISE EXCEPTION 'INTRO_INVALID' USING ERRCODE='22023'; END IF;
   INSERT INTO public.ccx_friend_intro_messages(introduction_id,sender_id,body) VALUES(row_item.id,p_actor,body);
  END IF;
  UPDATE public.ccx_friend_introductions SET
    status=CASE WHEN p_action='reply' THEN 'completed' ELSE 'declined' END,
    responded_at=now() WHERE id=row_item.id;
  RETURN jsonb_build_object('status',CASE WHEN p_action='reply' THEN 'completed' ELSE 'declined' END);
 END IF;
 RAISE EXCEPTION 'INTRO_INVALID' USING ERRCODE='22023';
END $intro$;
REVOKE ALL ON FUNCTION public.ccx_friend_intro(uuid,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_friend_intro(uuid,text,uuid,uuid,text) TO service_role;

CREATE TABLE public.ccx_collaboration_notes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 note_kind text NOT NULL DEFAULT 'manual' CHECK(note_kind IN('manual','scope_proposal','meeting_summary')),
 note_text text NOT NULL CHECK(length(btrim(note_text)) BETWEEN 2 AND 5000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ccx_collab_notes_time ON public.ccx_collaboration_notes(collaboration_id,created_at,id);
ALTER TABLE public.ccx_collaboration_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_collaboration_notes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.ccx_collaboration_notes TO authenticated;
GRANT SELECT,INSERT ON public.ccx_collaboration_notes TO service_role;
CREATE POLICY "Participants read their project notes" ON public.ccx_collaboration_notes
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.collaboration_members m
  WHERE m.collaboration_id=collaboration_id AND m.user_id=(SELECT auth.uid())));
CREATE POLICY "Participants append their own notes" ON public.ccx_collaboration_notes
 FOR INSERT TO authenticated WITH CHECK(
  author_id=(SELECT auth.uid()) AND note_kind='manual'
  AND EXISTS(SELECT 1 FROM public.collaboration_members m WHERE m.collaboration_id=collaboration_id AND m.user_id=(SELECT auth.uid()))
  AND EXISTS(SELECT 1 FROM public.member_admissions v WHERE v.user_id=(SELECT auth.uid()) AND v.admitted_at IS NOT NULL)
 );
CREATE FUNCTION public.ccx_collaboration_notes_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $immutable$
BEGIN RAISE EXCEPTION 'Project notes are append-only. Create a correction note.'; END $immutable$;
REVOKE ALL ON FUNCTION public.ccx_collaboration_notes_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_notes_append_only BEFORE UPDATE OR DELETE ON public.ccx_collaboration_notes
 FOR EACH ROW EXECUTE FUNCTION public.ccx_collaboration_notes_immutable();

CREATE TABLE public.ccx_collaboration_testing_policy (
 collaboration_id uuid PRIMARY KEY REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 required boolean NOT NULL DEFAULT false,
 verification_deadline timestamptz,
 freshness_days integer NOT NULL DEFAULT 14 CHECK(freshness_days BETWEEN 1 AND 60),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ccx_collaboration_testing_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_collaboration_testing_policy FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ccx_collaboration_testing_policy TO service_role;
-- No medical result or document ever enters this policy table.
COMMENT ON TABLE public.ccx_collaboration_testing_policy IS
 'Collaboration requirement and deadline metadata only. Medical results remain in separate private provider-reviewed records.';
-- All travel and project-note API access goes through authenticated, role-scoped
-- Edge handlers; direct browser privileges are withdrawn despite RLS defense-in-depth.
REVOKE ALL ON public.ccx_profile_travel,public.ccx_collaboration_notes FROM authenticated;
COMMIT;
