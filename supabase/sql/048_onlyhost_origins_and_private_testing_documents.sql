-- OnlyHost publication attribution + protected performer testing-document review.
ALTER TABLE public.properties
 ADD COLUMN IF NOT EXISTS created_via_brand text NOT NULL DEFAULT 'content_connect'
 CHECK(created_via_brand IN ('content_connect','onlyhost'));
CREATE INDEX IF NOT EXISTS ccx_properties_brand_idx
 ON public.properties(created_via_brand,status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.ccx_clearance_document_submissions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 storage_path text NOT NULL UNIQUE CHECK(length(storage_path) BETWEEN 20 AND 600),
 status text NOT NULL DEFAULT 'pending'
   CHECK(status IN ('pending','under_review','verified_offsite','rejected')),
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 review_note text CHECK(length(review_note)<=500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ccx_clearance_documents_user_idx
 ON public.ccx_clearance_document_submissions(user_id,created_at DESC);
ALTER TABLE public.ccx_clearance_document_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccx_clearance_document_user_read ON public.ccx_clearance_document_submissions
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('ccx-private-clearance','ccx-private-clearance',false,10485760,
 ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,
 allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'];

CREATE POLICY ccx_brand_domains_server_only ON public.ccx_brand_domains
 FOR SELECT TO authenticated USING(false);

REVOKE INSERT,UPDATE,DELETE ON public.ccx_clearance_document_submissions FROM anon,authenticated;
-- Never expose clinical reports, identity uploads or unverified provider receipts through public RLS.
