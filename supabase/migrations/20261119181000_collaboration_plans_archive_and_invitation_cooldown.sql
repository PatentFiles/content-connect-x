-- Collaboration planning & anti-spam constraints. Existing signed contracts/consents are not mutated.
ALTER TABLE public.collaboration_invitations ADD COLUMN IF NOT EXISTS proposed_role text NOT NULL DEFAULT 'collaborator';
CREATE TABLE IF NOT EXISTS public.ccx_collaboration_plans (
 collaboration_id uuid PRIMARY KEY REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 starts_at timestamptz, ends_at timestamptz, timezone text NOT NULL DEFAULT 'UTC',
 city text NOT NULL DEFAULT '', venue_label text NOT NULL DEFAULT '',
 property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
 scope_of_work text NOT NULL DEFAULT '', agreed_activities text[] NOT NULL DEFAULT '{}',
 deliverables text NOT NULL DEFAULT '', usage_rights text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 updated_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ccx_plan_time_order CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at),
 CONSTRAINT ccx_plan_timezone_length CHECK (char_length(timezone) BETWEEN 1 AND 80),
 CONSTRAINT ccx_plan_bounded CHECK (char_length(city)<=160 AND char_length(venue_label)<=240 AND char_length(scope_of_work)<=6000 AND char_length(deliverables)<=6000 AND char_length(usage_rights)<=6000 AND coalesce(array_length(agreed_activities,1),0)<=60)
);
CREATE TABLE IF NOT EXISTS public.ccx_collaboration_plan_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version>0),actor_id uuid NOT NULL REFERENCES auth.users(id),
 snapshot jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(collaboration_id,version)
);
CREATE TABLE IF NOT EXISTS public.ccx_collaboration_hidden (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 hidden_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,collaboration_id)
);
CREATE TABLE IF NOT EXISTS public.ccx_collaboration_invitation_cooldowns (
 actor_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 until_at timestamptz NOT NULL,triggered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ccx_collaboration_history_project_idx ON public.ccx_collaboration_plan_history(collaboration_id,version DESC);
CREATE INDEX IF NOT EXISTS ccx_collaboration_decline_idx ON public.collaboration_invitations(invited_by,responded_at) WHERE status='declined';
CREATE INDEX IF NOT EXISTS ccx_collaboration_invited_idx ON public.collaboration_invitations(invited_by,created_at);
-- No direct client access: service gateway performs membership, account and feature validation.
ALTER TABLE public.ccx_collaboration_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_collaboration_plan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_collaboration_hidden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_collaboration_invitation_cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_collaboration_plans,public.ccx_collaboration_plan_history,public.ccx_collaboration_hidden,public.ccx_collaboration_invitation_cooldowns FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ccx_append_collaboration_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 INSERT INTO public.ccx_collaboration_plan_history(collaboration_id,version,actor_id,snapshot)
 VALUES(NEW.collaboration_id,NEW.version,NEW.updated_by,to_jsonb(NEW)-'updated_by');
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS ccx_plan_version_after_write ON public.ccx_collaboration_plans;
CREATE TRIGGER ccx_plan_version_after_write AFTER INSERT OR UPDATE ON public.ccx_collaboration_plans FOR EACH ROW EXECUTE FUNCTION public.ccx_append_collaboration_plan();
CREATE OR REPLACE FUNCTION public.ccx_deny_plan_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN RAISE EXCEPTION 'Immutable production plan history'; END $function$;
DROP TRIGGER IF EXISTS ccx_plan_history_immutable ON public.ccx_collaboration_plan_history;
CREATE TRIGGER ccx_plan_history_immutable BEFORE UPDATE OR DELETE ON public.ccx_collaboration_plan_history FOR EACH ROW EXECUTE FUNCTION public.ccx_deny_plan_history_mutation();
-- Secure all insertion paths, including service-role callers. A mutual direct
-- chat requires non-deleted messages sent by both participants, not just a chat row.
CREATE OR REPLACE FUNCTION public.ccx_guard_collaboration_invite()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
DECLARE owner_id uuid; locked_until timestamptz;
BEGIN
 IF NEW.proposed_role NOT IN ('collaborator','creator','photographer','videographer','video_editor','agent','studio') THEN RAISE EXCEPTION 'Invalid collaborator role'; END IF;
 IF NEW.proposed_role<>'collaborator' AND NEW.proposed_role IS DISTINCT FROM (SELECT role_type FROM public.member_profiles WHERE id=NEW.invitee_id) THEN RAISE EXCEPTION 'Collaborator role does not match profile'; END IF;
 IF NEW.status <> 'pending' THEN RAISE EXCEPTION 'Invitations begin pending' USING ERRCODE='42501'; END IF;
 SELECT creator_id INTO owner_id FROM public.collaborations WHERE id=NEW.collaboration_id;
 IF owner_id IS DISTINCT FROM NEW.invited_by OR NEW.invitee_id=NEW.invited_by THEN
  RAISE EXCEPTION 'Invalid collaboration invitation' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ccx-collaboration-invite:'||NEW.invited_by::text,0));
 SELECT until_at INTO locked_until FROM public.ccx_collaboration_invitation_cooldowns WHERE actor_id=NEW.invited_by;
 IF locked_until>now() THEN RAISE EXCEPTION 'Collaboration invitations temporarily paused after repeated declines' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.collaboration_invitations WHERE invited_by=NEW.invited_by AND created_at>now()-interval '24 hours')>=20 THEN
  RAISE EXCEPTION 'Daily collaboration invitation limit reached' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.member_connection_requests q
  WHERE q.status='accepted' AND ((q.requester_id=NEW.invited_by AND q.recipient_id=NEW.invitee_id) OR(q.recipient_id=NEW.invited_by AND q.requester_id=NEW.invitee_id))
 ) AND NOT EXISTS (
  SELECT 1 FROM public.conversations c
  JOIN public.conversation_members x ON x.conversation_id=c.id AND x.user_id=NEW.invited_by
  JOIN public.conversation_members y ON y.conversation_id=c.id AND y.user_id=NEW.invitee_id
  WHERE c.kind='direct'
  AND EXISTS(SELECT 1 FROM public.messages m WHERE m.conversation_id=c.id AND m.sender_id=NEW.invited_by AND m.deleted_at IS NULL AND length(trim(m.body))>=2)
  AND EXISTS(SELECT 1 FROM public.messages m WHERE m.conversation_id=c.id AND m.sender_id=NEW.invitee_id AND m.deleted_at IS NULL AND length(trim(m.body))>=2)
 ) THEN
  RAISE EXCEPTION 'A mutual friendship or two-way conversation is required before inviting' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS ccx_invite_relationship_gate ON public.collaboration_invitations;
CREATE TRIGGER ccx_invite_relationship_gate BEFORE INSERT ON public.collaboration_invitations FOR EACH ROW EXECUTE FUNCTION public.ccx_guard_collaboration_invite();
CREATE OR REPLACE FUNCTION public.ccx_record_collaboration_declines()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 IF OLD.status='pending' AND NEW.status='accepted' AND NEW.proposed_role<>'collaborator' THEN
  UPDATE public.collaboration_members SET membership_role=NEW.proposed_role WHERE collaboration_id=NEW.collaboration_id AND user_id=NEW.invitee_id;
 END IF;
 IF OLD.status='pending' AND NEW.status='declined' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('ccx-collaboration-invite:'||NEW.invited_by::text,0));
  IF (SELECT count(*) FROM public.collaboration_invitations
      WHERE invited_by=NEW.invited_by AND status='declined' AND responded_at>now()-interval '7 days')>=5 THEN
   INSERT INTO public.ccx_collaboration_invitation_cooldowns(actor_id,until_at,triggered_at)
   VALUES(NEW.invited_by,now()+interval '30 days',now())
   ON CONFLICT(actor_id) DO UPDATE SET until_at=greatest(public.ccx_collaboration_invitation_cooldowns.until_at,EXCLUDED.until_at),triggered_at=EXCLUDED.triggered_at;
  END IF;
 END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS ccx_invite_decline_cooldown ON public.collaboration_invitations;
CREATE TRIGGER ccx_invite_decline_cooldown AFTER UPDATE OF status ON public.collaboration_invitations FOR EACH ROW EXECUTE FUNCTION public.ccx_record_collaboration_declines();
-- Only a member can hide/reopen their own entry via the server; no deletion of
-- signed agreements, consent records or audit history is provided.
