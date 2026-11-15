-- Full unique index permits PostgREST upsert; PostgreSQL permits multiple NULL hashes.
DROP INDEX IF EXISTS public.property_ical_uid_unique;
CREATE UNIQUE INDEX property_ical_uid_unique ON public.property_unavailable(property_id,source_uid_hash);