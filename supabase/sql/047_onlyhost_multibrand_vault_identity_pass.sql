-- Independent OnlyHost marketplace, encrypted API settings, consent-based PASS clearance sharing.
-- Sensitive credential material remains in Supabase Vault and never enters API tables.
CREATE TABLE IF NOT EXISTS public.ccx_integrations (
 provider text PRIMARY KEY CHECK(provider IN ('yoti','pass','ccbill','docusign','email','webpush','maps','openmoderate','sentry','flagsmith')),
 enabled boolean NOT NULL DEFAULT false,
 setup_status text NOT NULL DEFAULT 'not_configured'
   CHECK(setup_status IN ('not_configured','credentials_stored','awaiting_partner','tested','approved')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=400),
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ccx_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccx_integrations_admin_read ON public.ccx_integrations FOR SELECT TO authenticated
 USING(EXISTS (SELECT 1 FROM public.account_security WHERE user_id=(SELECT auth.uid()) AND admin=true));
INSERT INTO public.ccx_integrations(provider,setup_status) VALUES
 ('yoti','not_configured'),('pass','awaiting_partner'),('ccbill','not_configured'),
 ('docusign','not_configured'),('email','not_configured'),('webpush','not_configured'),
 ('maps','not_configured'),('openmoderate','not_configured'),('sentry','not_configured'),
 ('flagsmith','not_configured')
 ON CONFLICT(provider) DO NOTHING;

-- The only named secrets accepted by admin API. Nobody may invent an arbitrary Vault key.
CREATE OR REPLACE FUNCTION public.ccx_secret_name_valid(p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT p_name=ANY(ARRAY[
  'yoti_token','yoti_sdk_id',
  'pass_partner_token',
  'ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt',
  'docusign_account_id','docusign_integration_key','docusign_private_key','docusign_hmac',
  'email_api_token','email_sender','webpush_vapid_private',
  'maps_server_key','openmoderate_api_key','sentry_dsn','flagsmith_environment'
 ]);
$$;
REVOKE ALL ON FUNCTION public.ccx_secret_name_valid(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_secret_name_valid(text) TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_secret_set(p_name text,p_secret text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret_id uuid; vault_name text;
BEGIN
 IF NOT public.ccx_secret_name_valid(p_name) OR p_secret IS NULL OR
  length(p_secret)<4 OR length(p_secret)>8192 THEN
  RAISE EXCEPTION 'Unapproved integration secret';
 END IF;
 vault_name:='ccx_runtime_'||p_name;
 SELECT id INTO secret_id FROM vault.decrypted_secrets WHERE name=vault_name LIMIT 1;
 IF secret_id IS NULL THEN
   PERFORM vault.create_secret(p_secret,vault_name,'CCX admin-entered provider configuration',NULL);
 ELSE
   PERFORM vault.update_secret(secret_id,p_secret,NULL,NULL,NULL);
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ccx_secret_set(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_secret_set(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.ccx_secret_get(p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE val text;
BEGIN
 IF NOT public.ccx_secret_name_valid(p_name) THEN RAISE EXCEPTION 'Unapproved integration secret'; END IF;
 SELECT decrypted_secret INTO val FROM vault.decrypted_secrets
 WHERE name='ccx_runtime_'||p_name LIMIT 1;
 RETURN val;
END $$;
REVOKE ALL ON FUNCTION public.ccx_secret_get(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_secret_get(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.ccx_age_provider_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 provider text NOT NULL DEFAULT 'yoti' CHECK(provider='yoti'),
 provider_session_id text NOT NULL UNIQUE,
 reference_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 mode text NOT NULL CHECK(mode IN ('age_gate','performer_identity')),
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','processing','age_confirmed','review_required','rejected','expired','provider_error')),
 method text,
 expires_at timestamptz NOT NULL,
 confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ccx_age_sessions_user_idx ON public.ccx_age_provider_sessions(user_id,created_at DESC);
ALTER TABLE public.ccx_age_provider_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccx_age_sessions_own_read ON public.ccx_age_provider_sessions
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

-- OnlyHost is an independent account experience but uses the SAME Supabase identity, properties,
-- transactions, date locks and gear-inventory locks as CCX. Separate branding is presentation only.
CREATE TABLE IF NOT EXISTS public.onlyhost_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
 agreed_to_hosting_terms_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.onlyhost_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY onlyhost_own_account_read ON public.onlyhost_accounts FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));

ALTER TABLE public.property_booking_requests
 ADD COLUMN IF NOT EXISTS source_brand text NOT NULL DEFAULT 'content_connect'
 CHECK(source_brand IN ('content_connect','onlyhost'));
CREATE INDEX IF NOT EXISTS ccx_booking_source_brand_idx ON public.property_booking_requests(source_brand,created_at DESC);

CREATE TABLE IF NOT EXISTS public.ccx_brand_domains(
 brand text NOT NULL CHECK(brand IN ('content_connect','onlyhost')),
 host_name text PRIMARY KEY CHECK(length(host_name) BETWEEN 5 AND 190),
 active boolean NOT NULL DEFAULT false,
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ccx_brand_domains ENABLE ROW LEVEL SECURITY;
-- Domain registration is manual/reviewed; no direct anonymous browser reads or edits.

CREATE TABLE IF NOT EXISTS public.ccx_pass_links(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 requested_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'awaiting_partner'
  CHECK(status IN ('awaiting_partner','pending_confirmation','connected','revoked')),
 consented_at timestamptz,
 consent_version text NOT NULL DEFAULT 'pass-status-v1',
 last_sync_at timestamptz,
 connected_at timestamptz
);
ALTER TABLE public.ccx_pass_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccx_pass_own_link_read ON public.ccx_pass_links FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.ccx_clearance_share_consents(
 collaboration_id uuid NOT NULL REFERENCES public.collaborations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 consented_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 terms_version text NOT NULL DEFAULT 'clearance-share-v1',
 PRIMARY KEY(collaboration_id,user_id)
);
ALTER TABLE public.ccx_clearance_share_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccx_clearance_share_own_read ON public.ccx_clearance_share_consents FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.ccx_clearance_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('pass_partner','manual_admin')),
 clearance_confirmed boolean NOT NULL,
 expires_at timestamptz,
 provider_reference_hash text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,source,provider_reference_hash)
);
ALTER TABLE public.ccx_clearance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccx_clearance_events_owner_read ON public.ccx_clearance_events FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));

-- New sensitive tables are accessible for reads only via owner-filtered RLS.
-- Only service-role Edge Functions may make changes.
REVOKE INSERT, UPDATE, DELETE ON public.ccx_integrations,
 public.ccx_age_provider_sessions,public.onlyhost_accounts,public.ccx_pass_links,
 public.ccx_clearance_share_consents,public.ccx_clearance_events,
 public.ccx_brand_domains FROM anon,authenticated;
