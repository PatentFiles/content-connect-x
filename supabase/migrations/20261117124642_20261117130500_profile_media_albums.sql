/*
# Add member media albums

1. New tables
- `member_media_albums`: private owner-scoped album names for organizing profile media.
- `id`, `owner_id`, `title`, `created_at`, `updated_at`.

2. Modified tables
- `member_media_assets`: adds optional `album_id` so approved media can be grouped without changing existing records.

3. Security
- Enable RLS on albums.
- Allow authenticated members to manage only their own albums.
- Album ownership is enforced by the foreign key and edge-function upload path.

4. Important notes
- Existing media remains available in the default ungrouped view.
- This migration is additive and does not remove or rewrite existing media.
*/

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
