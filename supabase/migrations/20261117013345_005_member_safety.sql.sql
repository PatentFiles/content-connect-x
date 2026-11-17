-- Server-controlled safety and reporting actions.
CREATE TABLE IF NOT EXISTS public.member_blocks (
 blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (blocker_id,blocked_id),
 CHECK (blocker_id<>blocked_id)
);
CREATE TABLE IF NOT EXISTS public.member_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_id uuid NOT NULL REFERENCES auth.users(id),
 reported_id uuid NOT NULL REFERENCES auth.users(id),
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 5 AND 300),
 details text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','investigating','resolved','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_review ON public.member_reports(status,created_at DESC);
ALTER TABLE public.member_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocker reads own blocks" ON public.member_blocks FOR SELECT TO authenticated USING(blocker_id=(select auth.uid()));
CREATE POLICY "reporter reads own report" ON public.member_reports FOR SELECT TO authenticated USING(reporter_id=(select auth.uid()));
-- No direct client writes. Edge Functions enforce identity and audit changes.