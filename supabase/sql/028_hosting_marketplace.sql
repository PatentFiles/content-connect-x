-- Creator Hosting: adaptation of listing/favorites (Airbnb Clone/StayFinder),
-- conflict-safe bookings (OpenStay), and turnovers (OpenSTR).
-- Uses the existing public.properties and property_booking_requests primary records.
ALTER TABLE public.properties
 ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'film_studio'
  CHECK (category IN ('film_studio','photo_studio','house','villa','loft','set','outdoor','equipment','other')),
 ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 4 CHECK (capacity BETWEEN 1 AND 500),
 ADD COLUMN IF NOT EXISTS minimum_hours integer NOT NULL DEFAULT 2 CHECK (minimum_hours BETWEEN 1 AND 72),
 ADD COLUMN IF NOT EXISTS setup_buffer_minutes integer NOT NULL DEFAULT 30 CHECK (setup_buffer_minutes BETWEEN 0 AND 1440),
 ADD COLUMN IF NOT EXISTS cleanup_buffer_minutes integer NOT NULL DEFAULT 30 CHECK (cleanup_buffer_minutes BETWEEN 0 AND 1440),
 ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS permitted_uses text[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS rules text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
 ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
 ADD COLUMN IF NOT EXISTS approved_at timestamptz,
 ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS properties_marketplace_idx ON public.properties(status,category,city,hourly_rate);
CREATE INDEX IF NOT EXISTS properties_host_lookup_idx ON public.properties(owner_id,created_at DESC);

-- Public-facing photos remain PRIVATE in Storage, even after approval.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('property-images','property-images',false,10485760,ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=10485760,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
CREATE TABLE IF NOT EXISTS public.property_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 uploader_id uuid NOT NULL REFERENCES auth.users(id),
 storage_path text NOT NULL UNIQUE,
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 position integer NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 1000),
 caption text NOT NULL DEFAULT '' CHECK(char_length(caption)<=250),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_images_property_idx ON public.property_images(property_id,status,position);
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_property_image_metadata ON public.property_images FOR SELECT TO authenticated USING (uploader_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.property_favorites (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,property_id)
);
ALTER TABLE public.property_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favorites_own ON public.property_favorites FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.property_unavailable (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 blocked_by uuid NOT NULL REFERENCES auth.users(id),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 reason text NOT NULL DEFAULT '' CHECK(char_length(reason)<=200),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS property_unavailable_by_date ON public.property_unavailable(property_id,starts_at,ends_at);
ALTER TABLE public.property_unavailable ENABLE ROW LEVEL SECURITY;
CREATE POLICY property_owner_reads_blocks ON public.property_unavailable FOR SELECT TO authenticated USING(blocked_by=(SELECT auth.uid()));

-- Snapshot commercial terms at the time of the request. No charge is collected.
ALTER TABLE public.property_booking_requests
 ADD COLUMN IF NOT EXISTS hourly_rate_snapshot numeric(12,2) CHECK(hourly_rate_snapshot>=0),
 ADD COLUMN IF NOT EXISTS estimated_total numeric(12,2) CHECK(estimated_total>=0),
 ADD COLUMN IF NOT EXISTS crew_size integer CHECK(crew_size BETWEEN 1 AND 500),
 ADD COLUMN IF NOT EXISTS requested_use text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS property_booking_by_owner ON public.property_booking_requests(owner_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.property_turnovers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 booking_id uuid REFERENCES public.property_booking_requests(id) ON DELETE SET NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 assigned_to uuid REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','completed','cancelled')),
 due_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.property_turnovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_reads_own_turnovers ON public.property_turnovers FOR SELECT TO authenticated USING(created_by=(SELECT auth.uid()));
CREATE TABLE IF NOT EXISTS public.property_turnover_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 turnover_id uuid NOT NULL REFERENCES public.property_turnovers(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(label) BETWEEN 2 AND 200),
 done boolean NOT NULL DEFAULT false,
 done_at timestamptz,
 position integer NOT NULL DEFAULT 0,
 UNIQUE(turnover_id,label)
);
ALTER TABLE public.property_turnover_tasks ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.property_turnover_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 turnover_id uuid NOT NULL REFERENCES public.property_turnovers(id) ON DELETE CASCADE,
 uploaded_by uuid NOT NULL REFERENCES auth.users(id),
 storage_path text NOT NULL UNIQUE,
 phase text NOT NULL CHECK(phase IN ('before','after')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.property_turnover_photos ENABLE ROW LEVEL SECURITY;

-- Rich listing records intentionally have no direct public SELECT policy; an
-- authenticated Edge Function returns a sanitized listing with NO private address.
INSERT INTO public.product_feature_flags(key,enabled,allowed_tiers,description)
VALUES
 ('hosting_marketplace',true,ARRAY['free','premium'],'Age-gated listing search, host drafts, favorites and inquiries'),
 ('hosting_requests',true,ARRAY['premium'],'Nonpaid location booking requests, reviewed and accepted by hosts'),
 ('hosting_turnover',true,ARRAY['premium'],'Post-production property turnover checklists')
ON CONFLICT(key) DO NOTHING;

-- Atomic exclusion: all requested/accepted intervals reserve setup and cleanup buffers.
-- btree_gist is installed in extensions schema by an earlier migration.
ALTER TABLE public.property_booking_requests
 ADD COLUMN IF NOT EXISTS blocked_window tstzrange GENERATED ALWAYS AS
 (tstzrange(starts_at,ends_at,'[)')) STORED;
-- Existing nonoverlapping_property_booking_requests constraint remains active.
-- Time buffers are checked by booking API; a separate trigger locks the property
-- row and checks buffered intervals against all overlapping active bookings.
CREATE OR REPLACE FUNCTION public.prevent_buffered_property_bookings()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE before_minutes integer; after_minutes integer;
BEGIN
 IF NEW.status NOT IN ('requested','accepted') THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.properties WHERE id=NEW.property_id FOR UPDATE;
 SELECT setup_buffer_minutes,cleanup_buffer_minutes INTO before_minutes,after_minutes
 FROM public.properties WHERE id=NEW.property_id;
 IF EXISTS (
   SELECT 1 FROM public.property_booking_requests b
   WHERE b.property_id=NEW.property_id AND b.id<>NEW.id AND b.status IN ('requested','accepted')
   AND (b.starts_at-make_interval(mins=>before_minutes))<
       (NEW.ends_at+make_interval(mins=>after_minutes))
   AND (b.ends_at+make_interval(mins=>after_minutes))>
       (NEW.starts_at-make_interval(mins=>before_minutes))
 ) THEN RAISE EXCEPTION 'Rental slot unavailable with setup and cleaning buffers'; END IF;
 IF EXISTS (
   SELECT 1 FROM public.property_unavailable p
   WHERE p.property_id=NEW.property_id
   AND p.starts_at<NEW.ends_at AND p.ends_at>NEW.starts_at
 ) THEN RAISE EXCEPTION 'Rental slot blocked by host'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_property_booking_buffers ON public.property_booking_requests;
CREATE TRIGGER check_property_booking_buffers BEFORE INSERT OR UPDATE OF status,starts_at,ends_at
 ON public.property_booking_requests FOR EACH ROW EXECUTE FUNCTION public.prevent_buffered_property_bookings();

-- No venue can be marked publicly active without a reviewed adult-industry use policy.
-- This is a DB invariant regardless of the Edge Function used to update status.
CREATE OR REPLACE FUNCTION public.require_hosting_review()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='active' AND (NEW.approved_at IS NULL OR NEW.approved_by IS NULL
    OR cardinality(NEW.permitted_uses)=0) THEN
    RAISE EXCEPTION 'Hosted listings require administrator approval and declared permitted uses';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS require_hosting_publication_review ON public.properties;
CREATE TRIGGER require_hosting_publication_review BEFORE INSERT OR UPDATE OF status
 ON public.properties FOR EACH ROW EXECUTE FUNCTION public.require_hosting_review();