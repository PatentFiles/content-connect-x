-- Production booking requests: private and paid; never disclose exact locations.
CREATE TABLE IF NOT EXISTS public.creator_booking_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 host_id uuid NOT NULL REFERENCES auth.users(id),
 requester_id uuid NOT NULL REFERENCES auth.users(id),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','declined','cancelled','completed')),
 notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(requester_id<>host_id),
 CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS creator_booking_host ON public.creator_booking_requests(host_id,starts_at);
CREATE INDEX IF NOT EXISTS creator_booking_requester ON public.creator_booking_requests(requester_id,created_at DESC);
ALTER TABLE public.creator_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_booking_participants_read ON public.creator_booking_requests
 FOR SELECT TO authenticated USING(host_id=(select auth.uid()) OR requester_id=(select auth.uid()));
-- Concurrency-safe host availability. Terminal cancelled/declined bookings don't block.
CREATE OR REPLACE FUNCTION public.prevent_overlapping_creator_booking()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.status NOT IN ('requested','confirmed') THEN RETURN NEW; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.host_id::text,1));
 IF EXISTS (SELECT 1 FROM public.creator_booking_requests b
   WHERE b.host_id=NEW.host_id AND b.status IN ('requested','confirmed')
     AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at AND b.id<>NEW.id) THEN
   RAISE EXCEPTION 'Creator booking overlaps with another request';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS prevent_creator_booking_conflicts ON public.creator_booking_requests;
CREATE TRIGGER prevent_creator_booking_conflicts BEFORE INSERT OR UPDATE OF starts_at,ends_at,status
 ON public.creator_booking_requests FOR EACH ROW EXECUTE FUNCTION public.prevent_overlapping_creator_booking();
INSERT INTO public.product_feature_flags(key,enabled,allowed_tiers,description)
 VALUES('creator_booking',true,array['premium'],'Mutually connected professional booking requests; no payment processing')
 ON CONFLICT(key) DO NOTHING;
