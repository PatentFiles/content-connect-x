-- Unified Production Manager: teams, scheduling, events, disputes and reputation.
-- All mutations pass through authenticated Edge Functions. RLS is defense in depth.
CREATE TABLE IF NOT EXISTS public.production_teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
 description text NOT NULL DEFAULT '',
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','verified')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.production_team_members (
 team_id uuid NOT NULL REFERENCES public.production_teams(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'member' CHECK(role IN ('owner','manager','member')),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','declined','removed')),
 invited_by uuid REFERENCES auth.users(id),
 joined_at timestamptz,
 PRIMARY KEY(team_id,member_id)
);
CREATE INDEX IF NOT EXISTS team_member_lookup ON public.production_team_members(member_id,status);
CREATE TABLE IF NOT EXISTS public.production_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organizer_id uuid NOT NULL REFERENCES auth.users(id),
 team_id uuid REFERENCES public.production_teams(id) ON DELETE SET NULL,
 collaboration_id uuid REFERENCES public.collaborations(id) ON DELETE SET NULL,
 title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
 description text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '',
 timezone text NOT NULL DEFAULT 'UTC',
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 capacity integer NOT NULL DEFAULT 10 CHECK(capacity BETWEEN 1 AND 250),
 visibility text NOT NULL DEFAULT 'invite' CHECK(visibility IN ('invite','verified')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','cancelled','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS events_by_time ON public.production_events(starts_at,status);
CREATE TABLE IF NOT EXISTS public.production_event_rsvps (
 event_id uuid NOT NULL REFERENCES public.production_events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','going','maybe','declined','cancelled')),
 responded_at timestamptz,
 PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.production_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_id uuid NOT NULL REFERENCES auth.users(id),
 assigned_moderator_id uuid REFERENCES auth.users(id),
 collaboration_id uuid REFERENCES public.collaborations(id),
 booking_id uuid REFERENCES public.property_booking_requests(id),
 category text NOT NULL CHECK(category IN ('consent','safety','contract','payment','booking','harassment','other')),
 description text NOT NULL CHECK(char_length(description) BETWEEN 10 AND 5000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','mediation','resolved','dismissed')),
 resolution text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cases_by_status ON public.production_cases(status,created_at);
CREATE TABLE IF NOT EXISTS public.production_case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES public.production_cases(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 kind text NOT NULL CHECK(kind IN ('opened','note','status_changed','resolved')),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=5000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.completed_collaboration_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id),
 reviewee_id uuid NOT NULL REFERENCES auth.users(id),
 rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK(char_length(comment)<=1000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','hidden')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(collaboration_id,reviewer_id,reviewee_id),
 CHECK(reviewer_id<>reviewee_id)
);
CREATE TABLE IF NOT EXISTS public.member_saved_posts (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,post_id)
);
CREATE TABLE IF NOT EXISTS public.member_notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email_digest boolean NOT NULL DEFAULT false,
 booking_reminders boolean NOT NULL DEFAULT true,
 message_alerts boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['production_teams','production_team_members','production_events',
 'production_event_rsvps','production_cases','production_case_events',
 'completed_collaboration_reviews','member_saved_posts','member_notification_preferences'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
CREATE POLICY team_owner_read ON public.production_teams FOR SELECT TO authenticated USING(owner_id=(select auth.uid()));
CREATE POLICY team_own_membership ON public.production_team_members FOR SELECT TO authenticated USING(member_id=(select auth.uid()));
CREATE POLICY event_organizer_read ON public.production_events FOR SELECT TO authenticated USING(organizer_id=(select auth.uid()));
CREATE POLICY own_rsvp_read ON public.production_event_rsvps FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY own_case_read ON public.production_cases FOR SELECT TO authenticated USING(reporter_id=(select auth.uid()));
CREATE POLICY own_case_events_read ON public.production_case_events FOR SELECT TO authenticated USING(actor_id=(select auth.uid()));
CREATE POLICY own_review_read ON public.completed_collaboration_reviews FOR SELECT TO authenticated USING(reviewer_id=(select auth.uid()));
CREATE POLICY own_saved_posts ON public.member_saved_posts FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY own_notification_preferences ON public.member_notification_preferences FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
INSERT INTO public.product_feature_flags(key,enabled,allowed_tiers,description) VALUES
 ('production_manager',true,array['premium'],'Premium production teams, events and cases'),
 ('creator_groups',true,array['premium'],'Invite-only production teams'),
 ('event_rsvps',true,array['premium'],'Private production event registration'),
 ('verified_reviews',false,array['premium'],'Publish reviews only after validated completed shoots')
 ON CONFLICT(key) DO NOTHING;
