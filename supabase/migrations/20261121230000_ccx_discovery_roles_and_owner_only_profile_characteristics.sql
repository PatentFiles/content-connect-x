-- Private, owner-controlled discovery attributes. All values are self-reported and opt-in.
-- The private directory Edge Function may match opted-in records but ordinary clients
-- can neither enumerate other members' records nor read raw values.
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_role_type_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_role_type_check CHECK (role_type IN ('creator','photographer','videographer','video_editor','agent','studio','host','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental','chef','spa_provider'));
ALTER TABLE public.membership_plan_catalog DROP CONSTRAINT IF EXISTS membership_plan_catalog_role_type_check;
ALTER TABLE public.membership_plan_catalog ADD CONSTRAINT membership_plan_catalog_role_type_check CHECK (role_type IN ('creator','photographer','videographer','video_editor','agent','studio','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental','chef','spa_provider'));
CREATE TABLE IF NOT EXISTS public.member_discovery_attributes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age_years integer CHECK (age_years BETWEEN 18 AND 100),
  height_cm integer CHECK (height_cm BETWEEN 100 AND 250),
  weight_kg numeric(5,1) CHECK (weight_kg BETWEEN 25 AND 350),
  ethnicity text CHECK (ethnicity IN ('black','white','asian','hispanic_latino','middle_eastern','native_indigenous','mixed','other')),
  penis_inches numeric(4,1) CHECK (penis_inches BETWEEN 1 AND 16),
  circumcision text CHECK (circumcision IN ('circumcised','uncircumcised')),
  breast_size text CHECK (breast_size IN ('AA','A','B','C','D','DD','DDD','E','F','G','H','I','J','K+')),
  visible_in_discovery boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.member_discovery_attributes IS 'Self-reported optional member characteristics, OWNER ONLY. Edge directory service may match opt-in values; never disclose identity documents or raw rows.';
CREATE INDEX IF NOT EXISTS member_discovery_attributes_visible_idx ON public.member_discovery_attributes (visible_in_discovery) WHERE visible_in_discovery;
ALTER TABLE public.member_discovery_attributes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_discovery_attributes FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.member_discovery_attributes TO authenticated;
GRANT ALL ON public.member_discovery_attributes TO service_role;
DROP POLICY IF EXISTS member_discovery_attrs_owner_select ON public.member_discovery_attributes;
DROP POLICY IF EXISTS member_discovery_attrs_owner_insert ON public.member_discovery_attributes;
DROP POLICY IF EXISTS member_discovery_attrs_owner_update ON public.member_discovery_attributes;
DROP POLICY IF EXISTS member_discovery_attrs_owner_delete ON public.member_discovery_attributes;
CREATE POLICY member_discovery_attrs_owner_select ON public.member_discovery_attributes FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY member_discovery_attrs_owner_insert ON public.member_discovery_attributes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY member_discovery_attrs_owner_update ON public.member_discovery_attributes FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY member_discovery_attrs_owner_delete ON public.member_discovery_attributes FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
NOTIFY pgrst, 'reload schema';
