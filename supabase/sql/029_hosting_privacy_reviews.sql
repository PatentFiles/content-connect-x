-- Private guest entry details remain out of listing search.
-- Completed paid or independently verified bookings can later carry reviews.
CREATE TABLE IF NOT EXISTS public.property_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL UNIQUE REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES auth.users(id),
 rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=1200),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')),
 reviewed_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_reviews_property_idx ON public.property_reviews(property_id,status,created_at DESC);
ALTER TABLE public.property_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read_property_reviews ON public.property_reviews FOR SELECT TO authenticated
 USING(author_id=(SELECT auth.uid()));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('property-inspections','property-inspections',false,10485760,ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=10485760,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

-- Force approved properties back through review if their public claims change.
CREATE OR REPLACE FUNCTION public.require_reapproval_on_property_change()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.status='active' AND NEW.status='active' AND (
   NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description
   OR NEW.category IS DISTINCT FROM OLD.category OR NEW.city IS DISTINCT FROM OLD.city
   OR NEW.state IS DISTINCT FROM OLD.state OR NEW.country IS DISTINCT FROM OLD.country
   OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate OR NEW.permitted_uses IS DISTINCT FROM OLD.permitted_uses
   OR NEW.capacity IS DISTINCT FROM OLD.capacity OR NEW.amenities IS DISTINCT FROM OLD.amenities
   OR NEW.rules IS DISTINCT FROM OLD.rules
 ) THEN RAISE EXCEPTION 'Material public listing changes require a new review'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hosting_requires_reapproval ON public.properties;
CREATE TRIGGER hosting_requires_reapproval BEFORE UPDATE ON public.properties
 FOR EACH ROW EXECUTE FUNCTION public.require_reapproval_on_property_change();

-- Host blackout dates are serialized against requests and cannot overlap them.
CREATE OR REPLACE FUNCTION public.prevent_blocking_booked_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.properties WHERE id=NEW.property_id FOR UPDATE;
 IF EXISTS (SELECT 1 FROM public.property_booking_requests b WHERE
  b.property_id=NEW.property_id AND b.status IN ('requested','accepted')
  AND b.starts_at<NEW.ends_at AND b.ends_at>NEW.starts_at
 ) THEN RAISE EXCEPTION 'Cannot block a reserved interval'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS prevent_block_booking_conflict ON public.property_unavailable;
CREATE TRIGGER prevent_block_booking_conflict BEFORE INSERT OR UPDATE OF starts_at,ends_at
 ON public.property_unavailable FOR EACH ROW EXECUTE FUNCTION public.prevent_blocking_booked_dates();