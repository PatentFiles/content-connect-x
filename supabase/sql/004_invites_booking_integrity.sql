-- Invitations let collaborators accept their own participation rather than
-- being silently added by somebody else. Writes are trusted Edge-only.
CREATE TABLE IF NOT EXISTS public.collaboration_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 invitee_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 responded_at timestamptz,
 UNIQUE(collaboration_id, invitee_id)
);
CREATE INDEX IF NOT EXISTS idx_collab_invites_invitee ON public.collaboration_invitations(invitee_id,status);
ALTER TABLE public.collaboration_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite participant can read" ON public.collaboration_invitations FOR SELECT TO authenticated USING (invitee_id=(select auth.uid()) OR invited_by=(select auth.uid()));
-- Prevent overlapping live requests even when simultaneous Edge calls race.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.property_booking_requests ADD CONSTRAINT nonoverlapping_property_booking_requests
  EXCLUDE USING gist (
    property_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('requested','accepted'));
