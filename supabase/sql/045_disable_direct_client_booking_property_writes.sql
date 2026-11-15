-- Defense in depth: hosts must use server-validated property creation and updates.
-- The API currently has no direct authenticated table grants. Remove obsolete
-- policies too, preventing accidental privilege grants reopening the old path.
DROP POLICY IF EXISTS "owner creates draft property" ON public.properties;
DROP POLICY IF EXISTS "owner edits draft properties" ON public.properties;
REVOKE INSERT, UPDATE, DELETE ON public.properties FROM anon, authenticated;

-- Explicitly prevent direct client financial writes if future API grants change.
REVOKE INSERT, UPDATE, DELETE ON public.booking_payment_intents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.booking_payment_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.booking_payouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.booking_agreements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.property_booking_requests FROM anon, authenticated;

COMMENT ON TABLE public.properties IS 'Only Edge Functions may create/edit listings; browser Data API is read-only under RLS.';
