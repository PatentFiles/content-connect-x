-- One-time account admission replaces repeated feature-specific age/MFA gates.
-- Independent age records remain factual; legacy administrator admission is NOT age verification.
CREATE TABLE IF NOT EXISTS public.member_admissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 admitted_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL CHECK (source IN ('age_verification','legacy_admin')),
 verification_id uuid REFERENCES public.age_verification_requests(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_admissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_admissions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.member_admissions TO authenticated;
GRANT ALL ON public.member_admissions TO service_role;
DROP POLICY IF EXISTS member_reads_own_admission ON public.member_admissions;
CREATE POLICY member_reads_own_admission ON public.member_admissions FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
COMMENT ON TABLE public.member_admissions IS 'Trusted one-time CCX onboarding completion. A missing row is not admitted. A legacy_admin row is access continuity, never proof of age. Clients cannot create or change admissions.';

-- A signup creates only harmless defaults, never admin status or an admission.
CREATE OR REPLACE FUNCTION ccx_internal.bootstrap_signup_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.account_security(user_id,admin,banned,suspended) VALUES(NEW.id,false,false,false)
  ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO public.member_profiles(id,display_name,role_type,profile_complete) VALUES(NEW.id,'','creator',false)
  ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ccx_internal.bootstrap_signup_account() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ccx_bootstrap_signup ON auth.users;
CREATE TRIGGER ccx_bootstrap_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION ccx_internal.bootstrap_signup_account();

CREATE OR REPLACE FUNCTION ccx_internal.record_age_admission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND (NEW.expires_at IS NULL OR NEW.expires_at>now()) THEN
  INSERT INTO public.member_admissions(user_id,source,verification_id)
   VALUES(NEW.user_id,'age_verification',NEW.id) ON CONFLICT(user_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ccx_internal.record_age_admission() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS record_age_admission ON public.age_verification_requests;
CREATE TRIGGER record_age_admission AFTER INSERT OR UPDATE OF status ON public.age_verification_requests
 FOR EACH ROW EXECUTE FUNCTION ccx_internal.record_age_admission();

INSERT INTO public.member_admissions(user_id,admitted_at,source,verification_id)
 SELECT user_id,coalesce(verified_at,created_at),'age_verification',id FROM (
  SELECT DISTINCT ON(user_id) * FROM public.age_verification_requests ORDER BY user_id,created_at DESC,id DESC
 ) latest WHERE status='approved' AND (expires_at IS NULL OR expires_at>now())
 ON CONFLICT(user_id) DO NOTHING;
-- Only the existing, database-authorized, unrestricted administrators are grandfathered.
-- Future signups, including users claiming admin in editable metadata, receive no admission.
INSERT INTO public.member_admissions(user_id,source)
 SELECT s.user_id,'legacy_admin' FROM public.account_security s JOIN auth.users u ON u.id=s.user_id
 WHERE s.admin AND NOT s.banned AND NOT s.suspended ON CONFLICT(user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION ccx_internal.can_read_premium_chat() RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.member_admissions m WHERE m.user_id=(SELECT auth.uid()))
 AND NOT EXISTS(SELECT 1 FROM public.account_security s WHERE s.user_id=(SELECT auth.uid()) AND(s.banned OR s.suspended));
$$;

CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_workspace_allowed(p_feature text DEFAULT NULL,p_roles text[] DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();a record;f record;r text;tier text:='free';h bigint:=0;ch text;
BEGIN
 IF u IS NULL THEN RETURN false; END IF;
 SELECT admin,banned,suspended INTO a FROM public.account_security WHERE user_id=u;
 IF NOT FOUND OR a.banned OR a.suspended THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=u) THEN RETURN false; END IF;
 SELECT role_type INTO r FROM public.member_profiles WHERE id=u;
 IF r IS NULL THEN RETURN false; END IF;
 IF cardinality(p_roles)>0 AND NOT(r=ANY(p_roles)) THEN RETURN false; END IF;
 IF p_feature IS NULL THEN RETURN true; END IF;
 IF a.admin OR EXISTS(SELECT 1 FROM public.member_subscriptions WHERE user_id=u AND status IN('active','trial') AND(period_end IS NULL OR period_end>now())) THEN tier:='premium'; END IF;
 SELECT enabled,allowed_tiers,rollout_percent INTO f FROM public.product_feature_flags WHERE key=p_feature;
 IF NOT FOUND OR NOT f.enabled OR NOT(tier=ANY(f.allowed_tiers)) THEN RETURN false; END IF;
 FOREACH ch IN ARRAY regexp_split_to_array(u::text||p_feature,'') LOOP h:=mod(h*31+ascii(ch),4294967296); END LOOP;
 RETURN mod(h,100)<f.rollout_percent;
END $$;

CREATE OR REPLACE FUNCTION ccx_workspace_private.ccx_member_feature_flags() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();a public.account_security;r text;v public.age_verification_requests;verified boolean:=false;admitted boolean:=false;
 tier text:='free';f record;flags jsonb:='{}';access_map jsonb:='{}';reason text;available boolean;h bigint;ch text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.account_security WHERE user_id=u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account security record is unavailable' USING ERRCODE='42501'; END IF;
 SELECT role_type INTO r FROM public.member_profiles WHERE id=u;
 SELECT * INTO v FROM public.age_verification_requests WHERE user_id=u ORDER BY created_at DESC,id DESC LIMIT 1;
 verified:=coalesce(v.status='approved' AND(v.expires_at IS NULL OR v.expires_at>now()),false);
 admitted:=EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=u);
 IF a.admin OR EXISTS(SELECT 1 FROM public.member_subscriptions WHERE user_id=u AND status IN('active','trial') AND(period_end IS NULL OR period_end>now())) THEN tier:='premium'; END IF;
 FOR f IN SELECT key,enabled,allowed_tiers,rollout_percent FROM public.product_feature_flags LOOP
  h:=0;FOR ch IN SELECT regexp_split_to_table(u::text||f.key,'') LOOP h:=mod(h*31+ascii(ch),4294967296);END LOOP;
  available:=f.enabled AND mod(h,100)<f.rollout_percent;
  reason:=CASE WHEN a.banned OR a.suspended THEN 'restricted' WHEN NOT admitted THEN 'onboarding_required'
   WHEN NOT f.enabled THEN 'disabled' WHEN NOT available THEN 'rollout_excluded'
   WHEN f.key='portfolio' AND r NOT IN('photographer','videographer','video_editor') THEN 'role_required'
   WHEN f.key='roster' AND r NOT IN('creator','agent','studio') THEN 'role_required'
   WHEN NOT tier=ANY(f.allowed_tiers) THEN 'membership_required' ELSE 'ready' END;
  flags:=flags||jsonb_build_object(f.key,available);
  access_map:=access_map||jsonb_build_object(f.key,jsonb_build_object('reason',reason,'eligible',reason='ready','enabled',f.enabled));
 END LOOP;
 RETURN jsonb_build_object('flags',flags,'access',access_map,'account',jsonb_build_object('role',r,'admin',a.admin,
  'onboarding_complete',admitted,'age_verified',verified,'verification_status',coalesce(v.status,'not_started'),
  'tier',tier,'restricted',a.banned OR a.suspended),'checked_at',now());
END $$;

-- Preserve the existing booking transactions and resource checks; replace only their signup predicates.
DO $migration$
DECLARE f record;body text;old text;updated integer:=0;
BEGIN
 old:=$old$IF NOT EXISTS (SELECT 1 FROM public.age_verification_requests v WHERE v.user_id=p_guest
  AND v.id=(SELECT latest.id FROM public.age_verification_requests latest WHERE latest.user_id=p_guest
   ORDER BY latest.created_at DESC LIMIT 1) AND v.status='approved'
  AND (v.expires_at IS NULL OR v.expires_at>now())) THEN RAISE EXCEPTION 'Guest is not verified'; END IF;$old$;
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ccx_hosting_reserve' LOOP
  body:=pg_get_functiondef(f.oid);
  IF position(old in body)>0 THEN
   EXECUTE replace(body,old,'IF NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=p_guest) THEN RAISE EXCEPTION ''Complete account onboarding first''; END IF;');
   updated:=updated+1;
  ELSIF position('public.member_admissions' in body)=0 THEN RAISE EXCEPTION 'Unexpected reservation admission definition'; END IF;
 END LOOP;
 SELECT pg_get_functiondef('ccx_workspace_private.ccx_roster_action(text,jsonb)'::regprocedure) INTO body;
 old:=$old$NOT EXISTS(SELECT 1 FROM public.age_verification_requests WHERE id=(SELECT id FROM public.age_verification_requests WHERE user_id=t ORDER BY created_at DESC,id DESC LIMIT 1) AND status='approved' AND (expires_at IS NULL OR expires_at>now()))$old$;
 IF position(old in body)>0 THEN EXECUTE replace(body,old,'NOT EXISTS(SELECT 1 FROM public.member_admissions WHERE user_id=t)');
 ELSIF position('public.member_admissions' in body)=0 THEN RAISE EXCEPTION 'Unexpected roster admission definition'; END IF;
END $migration$;
-- Mandatory signup admission no longer depends on a global bypass/testing switch.
COMMENT ON COLUMN public.member_admissions.source IS 'age_verification = trusted approval completed signup; legacy_admin = existing admin continuity only. Neither role labels nor browser state can create admission.';
NOTIFY pgrst,'reload schema';
