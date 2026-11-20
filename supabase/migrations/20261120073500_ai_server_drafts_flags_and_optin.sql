-- One OpenAI service credential is read ONLY by trusted Edge Functions.
-- Sensitive member interests remain consent-based, never used for advertising.
-- AI flags are advisory and cannot automatically sanction accounts or sign contracts.
BEGIN;
CREATE TABLE public.ccx_ai_match_preferences(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 opt_in boolean NOT NULL DEFAULT false,
 shared_interests text[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(coalesce(array_length(shared_interests,1),0)<=20)
);
CREATE INDEX ccx_ai_match_opted ON public.ccx_ai_match_preferences(opt_in) WHERE opt_in;
CREATE TABLE public.ccx_ai_agent_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN('bio','matches','scope_draft','safety_scan')),
 model text NOT NULL DEFAULT 'unset',
 status text NOT NULL DEFAULT 'started' CHECK(status IN('started','completed','failed')),
 target_id uuid,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 flag_count integer NOT NULL DEFAULT 0 CHECK(flag_count BETWEEN 0 AND 100)
);
CREATE INDEX ccx_ai_runs_actor_time ON public.ccx_ai_agent_runs(actor_id,created_at DESC);
CREATE TABLE public.ccx_ai_review_flags(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL REFERENCES public.ccx_ai_agent_runs(id) ON DELETE RESTRICT,
 subject_kind text NOT NULL CHECK(subject_kind IN('profile','collaboration','post')),
 subject_id uuid NOT NULL,
 severity text NOT NULL CHECK(severity IN('low','medium','high','critical')),
 category text NOT NULL CHECK(category IN('consent','safety','privacy','misrepresentation','content_rights','other')),
 redacted_summary text NOT NULL CHECK(length(redacted_summary)<=1000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','reviewed','dismissed')),
 reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ccx_ai_flags_review ON public.ccx_ai_review_flags(status,created_at DESC);
CREATE TABLE public.ccx_ai_scope_drafts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE RESTRICT,
 requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 suggested_scope text NOT NULL CHECK(length(suggested_scope) BETWEEN 5 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now(),
 model text NOT NULL,
 reviewed_for_signing boolean NOT NULL DEFAULT false
);
CREATE INDEX ccx_ai_scope_project ON public.ccx_ai_scope_drafts(collaboration_id,created_at DESC);
ALTER TABLE public.ccx_ai_match_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_ai_review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccx_ai_scope_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ccx_ai_match_preferences,public.ccx_ai_agent_runs,
 public.ccx_ai_review_flags,public.ccx_ai_scope_drafts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.ccx_ai_match_preferences TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.ccx_ai_agent_runs TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.ccx_ai_review_flags TO service_role;
GRANT SELECT,INSERT ON public.ccx_ai_scope_drafts TO service_role;
CREATE FUNCTION public.ccx_ai_scope_immutable()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'AI draft history is append-only; create a new proposal instead'; END $$;
REVOKE ALL ON FUNCTION public.ccx_ai_scope_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ccx_ai_scope_append_only BEFORE UPDATE OR DELETE ON public.ccx_ai_scope_drafts
 FOR EACH ROW EXECUTE FUNCTION public.ccx_ai_scope_immutable();
COMMENT ON TABLE public.ccx_ai_review_flags IS
 'Advisory human-review queue only. No account sanctions, identity admission, document signing, public report acknowledgement or automatic contract changes.';
COMMENT ON TABLE public.ccx_ai_match_preferences IS
 'Explicit opt-in member-shared professional interests. Never for ads, orientation inference, profiling or compulsory matching.';
COMMIT;
