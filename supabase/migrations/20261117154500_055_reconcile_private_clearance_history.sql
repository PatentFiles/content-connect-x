-- Reconcile two generations of the private testing-history schema.
-- 047 introduced ccx_clearance_events with provider_reference_hash and a
-- narrow source enum; a later CREATE TABLE IF NOT EXISTS could not change
-- those columns/checks. Without this migration history reads can 400/500.
-- Keep earlier records, privacy/RLS and source attribution intact.
ALTER TABLE public.ccx_clearance_events
  ADD COLUMN IF NOT EXISTS provider_reference text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.ccx_clearance_events'::regclass
      AND conname='ccx_clearance_events_source_check'
  ) THEN
    ALTER TABLE public.ccx_clearance_events
      DROP CONSTRAINT ccx_clearance_events_source_check;
  END IF;
  ALTER TABLE public.ccx_clearance_events
    ADD CONSTRAINT ccx_clearance_events_source_check
    CHECK (source IN ('pass_partner','manual_admin','pass_sync','provider_review','system'));
END $$;

ALTER TABLE public.ccx_clearance_events ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.ccx_clearance_events FROM anon,authenticated;
GRANT SELECT ON public.ccx_clearance_events TO authenticated;
