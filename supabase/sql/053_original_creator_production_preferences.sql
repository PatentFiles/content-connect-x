-- Restore the original CreatorDetails categories without exposing sensitive
-- performer preferences to the public directory or other authenticated users.
CREATE TABLE IF NOT EXISTS public.creator_production_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 scene_pairings text[] NOT NULL DEFAULT '{}',
 scene_pairings_other text NOT NULL DEFAULT '' CHECK (char_length(scene_pairings_other)<=250),
 compensation_preferences text[] NOT NULL DEFAULT '{}',
 standard_acts text[] NOT NULL DEFAULT '{}',
 standard_acts_other text NOT NULL DEFAULT '' CHECK (char_length(standard_acts_other)<=250),
 fetish_acts text[] NOT NULL DEFAULT '{}',
 fetish_acts_other text NOT NULL DEFAULT '' CHECK (char_length(fetish_acts_other)<=250),
 kink_edge_acts text[] NOT NULL DEFAULT '{}',
 kink_edge_acts_other text NOT NULL DEFAULT '' CHECK (char_length(kink_edge_acts_other)<=250),
 performance_positioning text[] NOT NULL DEFAULT '{}',
 looking_for_genders text[] NOT NULL DEFAULT '{}',
 physical_details jsonb NOT NULL DEFAULT '{}'::jsonb,
 availability_type text NOT NULL DEFAULT 'local_only'
   CHECK (availability_type IN ('local_only','available_for_travel')),
 travel_regions text[] NOT NULL DEFAULT '{}',
 rates_text text NOT NULL DEFAULT '' CHECK (char_length(rates_text)<=2000),
 socials jsonb NOT NULL DEFAULT '{}'::jsonb,
 stats jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (coalesce(array_length(scene_pairings,1),0)<=30),
 CHECK (coalesce(array_length(standard_acts,1),0)<=30),
 CHECK (coalesce(array_length(fetish_acts,1),0)<=30),
 CHECK (coalesce(array_length(kink_edge_acts,1),0)<=30),
 CHECK (coalesce(array_length(performance_positioning,1),0)<=20),
 CHECK (coalesce(array_length(looking_for_genders,1),0)<=20),
 CHECK (coalesce(array_length(travel_regions,1),0)<=60),
 CHECK (jsonb_typeof(physical_details)='object'),
 CHECK (jsonb_typeof(socials)='object'),
 CHECK (jsonb_typeof(stats)='object')
);
ALTER TABLE public.creator_production_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creator_production_preferences FROM PUBLIC, anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.creator_production_preferences TO authenticated;
CREATE POLICY creator_production_self_select ON public.creator_production_preferences
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY creator_production_self_insert ON public.creator_production_preferences
 FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY creator_production_self_update ON public.creator_production_preferences
 FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid()))
 WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY creator_production_self_delete ON public.creator_production_preferences
 FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));
