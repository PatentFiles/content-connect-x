-- Closing the gap between cleaning/setup buffers and host blackout intervals.
-- The same property row is locked for concurrent booking and block changes.
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
   AND p.starts_at<(NEW.ends_at+make_interval(mins=>after_minutes))
   AND p.ends_at>(NEW.starts_at-make_interval(mins=>before_minutes))
 ) THEN RAISE EXCEPTION 'Rental slot blocked by host or operational buffers'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_blocking_booked_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE before_minutes integer; after_minutes integer;
BEGIN
 PERFORM 1 FROM public.properties WHERE id=NEW.property_id FOR UPDATE;
 SELECT setup_buffer_minutes,cleanup_buffer_minutes INTO before_minutes,after_minutes
 FROM public.properties WHERE id=NEW.property_id;
 IF EXISTS (
   SELECT 1 FROM public.property_booking_requests b
   WHERE b.property_id=NEW.property_id AND b.status IN ('requested','accepted')
   AND (b.starts_at-make_interval(mins=>before_minutes))<NEW.ends_at
   AND (b.ends_at+make_interval(mins=>after_minutes))>NEW.starts_at
 ) THEN RAISE EXCEPTION 'Block overlaps an existing reservation or production buffer'; END IF;
 RETURN NEW;
END $$;