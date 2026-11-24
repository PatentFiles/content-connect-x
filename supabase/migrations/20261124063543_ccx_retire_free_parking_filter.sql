-- Retire free parking from the compatibility catalog; preserve historical references.
UPDATE public.property_amenity_catalog SET active=false WHERE key='free_parking';
-- Existing legacy listings retain historical metadata; active catalog controls discovery.;
