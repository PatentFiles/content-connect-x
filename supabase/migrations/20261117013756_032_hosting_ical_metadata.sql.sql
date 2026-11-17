-- Manual iCalendar import blocks only availability; never stores third-party guest identities.
ALTER TABLE public.property_unavailable
 ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','ics_upload')),
 ADD COLUMN IF NOT EXISTS source_uid_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS property_ical_uid_unique ON public.property_unavailable(property_id,source_uid_hash)
 WHERE source='ics_upload' AND source_uid_hash IS NOT NULL;