-- Review eligibility derives from completed production with independent signed contracts.
CREATE TABLE IF NOT EXISTS public.collaboration_completion_votes (
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(collaboration_id,user_id)
);
ALTER TABLE public.collaboration_completion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_completion_vote ON public.collaboration_completion_votes FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE INDEX IF NOT EXISTS reviewee_published_ratings ON public.completed_collaboration_reviews(reviewee_id,status,created_at);
