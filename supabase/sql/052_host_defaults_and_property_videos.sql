-- Host Connect reusable defaults + private property video assets.
-- No direct browser writes to either table; protected Edge Functions authorize owner/admin.
CREATE TABLE IF NOT EXISTS public.host_listing_defaults (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.host_listing_defaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.host_listing_defaults FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.property_videos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 uploader_id uuid NOT NULL REFERENCES auth.users(id),
 storage_path text NOT NULL UNIQUE,
 mime_type text NOT NULL CHECK(mime_type IN ('video/mp4','video/webm')),
 caption text NOT NULL DEFAULT '' CHECK(length(caption)<=250),
 position integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_videos_property ON public.property_videos(property_id,status,position);
ALTER TABLE public.property_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_videos FROM PUBLIC,anon,authenticated;

-- A private, 40MB per-video bucket; no anonymous storage policies are installed.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('property-videos','property-videos',false,41943040,ARRAY['video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
