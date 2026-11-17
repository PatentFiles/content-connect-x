-- Modular launch inventory for Content Connect X.
-- Every optional navigation page must have an administrator-controlled switch.
-- This migration preserves existing values and does not activate anything that
-- the operator has previously disabled. New/unfinished modules default off.
-- Account, age verification, privacy/consent and admin access are essential
-- security paths and MUST NOT depend on configurable marketing feature flags.
INSERT INTO public.product_feature_flags (key, enabled, allowed_tiers, description) VALUES
 ('search', false, ARRAY['free','premium']::text[], 'Creator search and filtering'),
 ('favorites', false, ARRAY['free','premium']::text[], 'Saved creators and professionals'),
 ('connections', false, ARRAY['free','premium']::text[], 'Connections and contact requests'),
 ('collaborations', false, ARRAY['premium']::text[], 'Production collaboration workspace'),
 ('testing', false, ARRAY['free','premium']::text[], 'Private testing documents and work-clearance workflows'),
 ('hosting_marketplace', false, ARRAY['free','premium']::text[], 'OnlyHost and film-location discovery'),
 ('availability', false, ARRAY['premium']::text[], 'Shoot availability and travel scheduling'),
 ('production_manager', false, ARRAY['premium']::text[], 'Production planning and team coordination'),
 ('roster', false, ARRAY['premium']::text[], 'Studio and agent roster tools'),
 ('representations', false, ARRAY['premium']::text[], 'Creator representation management'),
 ('media_gallery', false, ARRAY['premium']::text[], 'Private and approved media galleries'),
 ('creator_booking', false, ARRAY['premium']::text[], 'Creator and service-provider bookings'),
 ('creator_groups', false, ARRAY['premium']::text[], 'Creator team and group tools'),
 ('event_rsvps', false, ARRAY['premium']::text[], 'Event RSVPs and calendar events'),
 ('hosting_requests', false, ARRAY['premium']::text[], 'Hosting booking request workflow'),
 ('hosting_turnover', false, ARRAY['premium']::text[], 'Hosting turnover and readiness checks'),
 ('verified_reviews', false, ARRAY['premium']::text[], 'Verified professional reputation')
ON CONFLICT (key) DO NOTHING;
