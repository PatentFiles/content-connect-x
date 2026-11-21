-- Applied on the connected production database after discovering a missing profile-albums migration.
-- Safe for repeat deploy: no existing media rows are deleted or changed.
CREATE TABLE IF NOT EXISTS public.member_media_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_media_albums ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_media_albums FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_media_albums TO authenticated;

DROP POLICY IF EXISTS "member reads own media albums" ON public.member_media_albums;
CREATE POLICY "member reads own media albums" ON public.member_media_albums FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "member creates own media albums" ON public.member_media_albums;
CREATE POLICY "member creates own media albums" ON public.member_media_albums FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "member edits own media albums" ON public.member_media_albums;
CREATE POLICY "member edits own media albums" ON public.member_media_albums FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "member deletes own media albums" ON public.member_media_albums;
CREATE POLICY "member deletes own media albums" ON public.member_media_albums FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

ALTER TABLE public.member_media_assets ADD COLUMN IF NOT EXISTS album_id uuid REFERENCES public.member_media_albums(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS member_media_assets_album_idx ON public.member_media_assets(album_id, created_at DESC);
