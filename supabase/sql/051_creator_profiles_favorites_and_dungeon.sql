-- Restore non-destructive profile, discovery and creator-favorites capabilities.
-- All sensitive identity and creative preference fields remain owner-only.
ALTER TABLE public.member_profiles ADD COLUMN IF NOT EXISTS state text;

CREATE TABLE IF NOT EXISTS public.member_profile_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 gender_identity text NOT NULL DEFAULT '' CHECK (gender_identity IN ('','man','woman','trans_man','trans_woman','nonbinary','genderfluid','self_describe')),
 sexual_orientation text NOT NULL DEFAULT '' CHECK (sexual_orientation IN ('','straight','gay','lesbian','bisexual','pansexual','queer','asexual','questioning','self_describe')),
 pronouns text NOT NULL DEFAULT '' CHECK (char_length(pronouns)<=80),
 gender_self_description text NOT NULL DEFAULT '' CHECK (char_length(gender_self_description)<=80),
 orientation_self_description text NOT NULL DEFAULT '' CHECK (char_length(orientation_self_description)<=80),
 preferred_collaborators text[] NOT NULL DEFAULT '{}',
 content_categories text[] NOT NULL DEFAULT '{}',
 scene_pairings text[] NOT NULL DEFAULT '{}',
 specialties text[] NOT NULL DEFAULT '{}',
 available_to_travel boolean NOT NULL DEFAULT false,
 show_gender_in_discovery boolean NOT NULL DEFAULT false,
 show_categories_in_discovery boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (content_categories <@ ARRAY['standard','fetish','kink_edge']::text[]),
 CHECK (coalesce(array_length(content_categories,1),0)<=3),
 CHECK (coalesce(array_length(scene_pairings,1),0)<=12),
 CHECK (coalesce(array_length(specialties,1),0)<=16),
 CHECK (coalesce(array_length(preferred_collaborators,1),0)<=12)
);
ALTER TABLE public.member_profile_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_profile_preferences FROM PUBLIC, anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.member_profile_preferences TO authenticated;
CREATE POLICY profile_preferences_self_read ON public.member_profile_preferences
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY profile_preferences_self_insert ON public.member_profile_preferences
 FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY profile_preferences_self_update ON public.member_profile_preferences
 FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid()))
 WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY profile_preferences_self_delete ON public.member_profile_preferences
 FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));

-- Favorites store references, never cache a member's private fields.
CREATE TABLE IF NOT EXISTS public.creator_favorites (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 creator_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,creator_id), CHECK (user_id<>creator_id)
);
CREATE INDEX IF NOT EXISTS creator_favorites_latest_idx
 ON public.creator_favorites(user_id,created_at DESC);
ALTER TABLE public.creator_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_favorites FROM PUBLIC, anon;
GRANT SELECT,INSERT,DELETE ON public.creator_favorites TO authenticated;
CREATE POLICY creator_favorites_self_read ON public.creator_favorites
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY creator_favorites_self_insert ON public.creator_favorites
 FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY creator_favorites_self_delete ON public.creator_favorites
 FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));

-- Venue owners can offer dedicated specialty/dungeon filming sets.
-- Existing listings retain their original category; this only extends choices.
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_category_check;
ALTER TABLE public.properties ADD CONSTRAINT properties_category_check
 CHECK (category IN ('film_studio','photo_studio','house','villa','loft','set','outdoor','equipment','dungeon','other'));
