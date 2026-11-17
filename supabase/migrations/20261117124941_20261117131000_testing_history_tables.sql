/*
# Create testing history tables

1. New Tables
- `ccx_clearance_document_submissions`: tracks private testing document uploads with status, review notes, and timestamps. Owner-scoped via RLS.
- `ccx_clearance_events`: persistent log of every clearance status change (manual admin review, PASS sync, etc.) with timestamps for historical searching.

2. Security
- RLS enabled on both tables.
- `ccx_clearance_document_submissions`: SELECT only for owner; all writes go through the service role (edge function).
- `ccx_clearance_events`: SELECT only for owner; inserts via service role only.
- Grants restricted: authenticated gets SELECT only so the Data API can read own history.

3. Important notes
- These tables are referenced by the ccx-integrations edge function but were missing from the live database.
- The edge function handles all writes using the service role key, so no INSERT/UPDATE/DELETE grants are needed for authenticated.
- This migration is additive and idempotent.
*/

CREATE TABLE IF NOT EXISTS public.ccx_clearance_document_submissions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE CHECK(length(storage_path) BETWEEN 20 AND 600),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','under_review','verified_offsite','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text CHECK(length(review_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ccx_clearance_documents_user_idx
  ON public.ccx_clearance_document_submissions(user_id, created_at DESC);

ALTER TABLE public.ccx_clearance_document_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccx_clearance_document_user_read" ON public.ccx_clearance_document_submissions;
CREATE POLICY "ccx_clearance_document_user_read" ON public.ccx_clearance_document_submissions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.ccx_clearance_document_submissions FROM anon, authenticated;
GRANT SELECT ON public.ccx_clearance_document_submissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ccx_clearance_document_submissions TO service_role;

CREATE TABLE IF NOT EXISTS public.ccx_clearance_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual_admin'
    CHECK(source IN ('manual_admin','pass_sync','provider_review','system')),
  clearance_confirmed boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ccx_clearance_events_user_idx
  ON public.ccx_clearance_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ccx_clearance_events_date_idx
  ON public.ccx_clearance_events(user_id, created_at);

ALTER TABLE public.ccx_clearance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccx_clearance_event_user_read" ON public.ccx_clearance_events;
CREATE POLICY "ccx_clearance_event_user_read" ON public.ccx_clearance_events
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.ccx_clearance_events FROM anon, authenticated;
GRANT SELECT ON public.ccx_clearance_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ccx_clearance_events TO service_role;

-- Storage bucket for private clearance documents
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ccx-private-clearance', 'ccx-private-clearance', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
