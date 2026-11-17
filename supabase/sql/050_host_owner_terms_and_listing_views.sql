-- Host Connect: explicit terms acceptance + privacy-preserving per-property view metrics.
-- Published properties remain under existing approved host/property review gates.
ALTER TABLE public.onlyhost_accounts
 ADD COLUMN IF NOT EXISTS terms_version text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS legal_capacity_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS property_authority_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS adult_production_understood boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
COMMENT ON COLUMN public.onlyhost_accounts.property_authority_confirmed IS
 'Host attests they own or have specific written owner permission; documentation is reviewed per property separately.';
CREATE TABLE IF NOT EXISTS public.hosting_listing_views (
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 viewed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(property_id, viewer_id, viewed_on),
 CONSTRAINT hosting_views_no_self_views CHECK (viewer_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS hosting_listing_views_property_date ON public.hosting_listing_views(property_id,viewed_on DESC);
ALTER TABLE public.hosting_listing_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hosting_listing_views FROM PUBLIC, anon, authenticated;
-- Only trusted, authenticated Edge Function requests may write and aggregate.
COMMENT ON TABLE public.hosting_listing_views IS 'Unique daily authenticated profile impressions, accessed by trusted hosting Edge Functions only; owner self-views are excluded at API level.';
