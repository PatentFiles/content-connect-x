-- Repair the established CCX database; do not switch to the duplicate Bolt project.
-- Additive only: preserve profile data, account status, reviewer decisions and RLS.
ALTER TABLE public.member_profiles
 ADD COLUMN IF NOT EXISTS real_name text,
 ADD COLUMN IF NOT EXISTS stage_name text,
 ADD COLUMN IF NOT EXISTS company_name text,
 ADD COLUMN IF NOT EXISTS representative_name text,
 ADD COLUMN IF NOT EXISTS cover_path text,
 ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN public.member_profiles.real_name IS 'Owner-only onboarding identity name. Never include in public directory responses.';
COMMENT ON COLUMN public.member_profiles.stage_name IS 'Professional stage name supplied during onboarding; not evidence of verified identity.';
COMMENT ON COLUMN public.member_profiles.company_name IS 'Optional professional business name, required by the studio onboarding UI.';
COMMENT ON COLUMN public.member_profiles.representative_name IS 'Studio representative name. Owner-only profile data.';

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_verification_requests ENABLE ROW LEVEL SECURITY;
-- Clients may read their own review state, but only protected backend functions
-- may create/update review records. Explicit grants supplement existing RLS.
REVOKE ALL ON public.age_verification_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.age_verification_requests FROM authenticated;
GRANT SELECT ON public.age_verification_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.age_verification_requests TO service_role;
REVOKE ALL ON public.member_profiles FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.member_profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.member_profiles TO authenticated;

DO $$
DECLARE missing text[];
BEGIN
 SELECT array_agg(required) INTO missing
 FROM unnest(ARRAY['id','display_name','role_type','bio','city','state','country','avatar_path','cover_path','real_name','stage_name','company_name','representative_name','profile_complete','updated_at']) required
 WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='member_profiles' AND c.column_name=required);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Onboarding schema is incomplete: %',missing; END IF;
END $$;
-- Ensure the REST API sees the new columns without waiting for cache expiry.
NOTIFY pgrst, 'reload schema';
