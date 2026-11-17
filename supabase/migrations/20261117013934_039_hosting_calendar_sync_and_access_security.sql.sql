-- Trusted calendar synchronization metadata, scoped rate-limit guards and inventory constraints.
ALTER TABLE public.property_unavailable
 ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.hosting_calendar_connections(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS hosting_calendar_block_by_connection ON public.property_unavailable(connection_id,starts_at);
ALTER TABLE public.hosting_calendar_connections
 ADD COLUMN IF NOT EXISTS last_feed_hash text,
 ADD COLUMN IF NOT EXISTS last_successful_count integer NOT NULL DEFAULT 0 CHECK(last_successful_count>=0),
 ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','active','paused','failed')),
 ADD COLUMN IF NOT EXISTS sync_interval_minutes integer NOT NULL DEFAULT 30
  CHECK(sync_interval_minutes BETWEEN 15 AND 1440);

-- Changing equipment quantity can never invalidate existing accepted reservations.
CREATE OR REPLACE FUNCTION public.ccx_guard_addon_quantity_reduction()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE reserved integer;
BEGIN
 IF NEW.quantity<OLD.quantity THEN
  SELECT coalesce(sum(a.quantity),0) INTO reserved FROM public.hosting_booking_addons a
   JOIN public.property_booking_requests b ON b.id=a.booking_id
   WHERE a.addon_id=OLD.id AND b.status IN ('requested','accepted') AND b.ends_at>now();
  IF NEW.quantity<reserved THEN RAISE EXCEPTION 'Cannot reduce equipment below already reserved quantities'; END IF;
 END IF;
 IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN RAISE EXCEPTION 'Equipment cannot change parent property'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ccx_guard_addon_quantity_on_update ON public.hosting_addons;
CREATE TRIGGER ccx_guard_addon_quantity_on_update BEFORE UPDATE ON public.hosting_addons
 FOR EACH ROW EXECUTE FUNCTION public.ccx_guard_addon_quantity_reduction();

-- Keep suitability badges distinct from unverified host assertions.
CREATE OR REPLACE FUNCTION public.ccx_guard_suitability_review()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE prop_owner uuid;
BEGIN
 SELECT owner_id INTO prop_owner FROM public.properties WHERE id=NEW.property_id;
 IF NEW.permits_verified AND
  (NEW.reviewer_id IS NULL OR NEW.reviewer_id=prop_owner OR NEW.reviewed_at IS NULL) THEN
  RAISE EXCEPTION 'Independent validation required for venue badge';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ccx_suitability_independent_review ON public.hosting_suitability;
CREATE TRIGGER ccx_suitability_independent_review BEFORE INSERT OR UPDATE ON public.hosting_suitability
 FOR EACH ROW EXECUTE FUNCTION public.ccx_guard_suitability_review();

CREATE TABLE IF NOT EXISTS public.hosting_calendar_job_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid REFERENCES public.hosting_calendar_connections(id),
 status text NOT NULL CHECK(status IN ('success','failure','skipped')),
 added_count integer NOT NULL DEFAULT 0,
 removed_count integer NOT NULL DEFAULT 0,
 error_kind text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_calendar_job_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_calendar_owner_audit ON public.hosting_calendar_job_audit FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.hosting_calendar_connections c JOIN public.properties p
  ON p.id=c.property_id WHERE c.id=connection_id AND p.owner_id=(SELECT auth.uid())));

-- Protect against inadvertently reopening entry access after explicit revocation.
CREATE OR REPLACE FUNCTION public.ccx_guard_access_revocation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.status='revoked' AND NEW.status='active' THEN
  RAISE EXCEPTION 'Revoked crew access requires a new invitation and acceptance';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ccx_guard_revoked_crew ON public.hosting_booking_access;
CREATE TRIGGER ccx_guard_revoked_crew BEFORE UPDATE OF status ON public.hosting_booking_access
 FOR EACH ROW EXECUTE FUNCTION public.ccx_guard_access_revocation();