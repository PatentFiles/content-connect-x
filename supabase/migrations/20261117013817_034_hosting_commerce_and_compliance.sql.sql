-- Hosting commerce and compliance foundations. No payment is taken or claimed
-- until the provider sends a verified and idempotently recorded confirmation.
ALTER TABLE public.properties
 ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT 'flexible'
   CHECK(cancellation_policy IN ('flexible','moderate','strict')),
 ADD COLUMN IF NOT EXISTS deposit_percent integer NOT NULL DEFAULT 0
   CHECK(deposit_percent BETWEEN 0 AND 50),
 ADD COLUMN IF NOT EXISTS required_insurance boolean NOT NULL DEFAULT false;

ALTER TABLE public.property_booking_requests
 ADD COLUMN IF NOT EXISTS legal_status text NOT NULL DEFAULT 'not_prepared'
   CHECK(legal_status IN ('not_prepared','pending_signature','signed','voided')),
 ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_started'
   CHECK(payment_status IN ('not_started','pending','authorized','captured','partially_refunded','refunded','failed')),
 ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'planning'
   CHECK(operational_status IN ('planning','ready','checked_in','checked_out','no_show','incident','closed')),
 ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

CREATE TABLE IF NOT EXISTS public.host_verification_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 business_name text NOT NULL DEFAULT '' CHECK(char_length(business_name)<=200),
 authority_type text NOT NULL CHECK(authority_type IN ('owner','authorized_manager','lease_authorized','business')),
 authority_document_path text NOT NULL CHECK(char_length(authority_document_path) BETWEEN 12 AND 480),
 insurance_document_path text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired')),
 reviewer_id uuid REFERENCES auth.users(id),
 reviewer_note text,
 verified_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(property_id,status) DEFERRABLE INITIALLY IMMEDIATE
);
-- Only one active approval; evidence revisions are append-only.
CREATE INDEX IF NOT EXISTS host_verification_owner ON public.host_verification_requests(owner_id,created_at DESC);
ALTER TABLE public.host_verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY host_verification_owner_read ON public.host_verification_requests
 FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('hosting-compliance','hosting-compliance',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,
  allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'];

CREATE TABLE IF NOT EXISTS public.booking_policy_snapshots (
 booking_id uuid PRIMARY KEY REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 cancellation_policy text NOT NULL CHECK(cancellation_policy IN ('flexible','moderate','strict')),
 deposit_cents bigint NOT NULL DEFAULT 0 CHECK(deposit_cents BETWEEN 0 AND 100000000),
 rental_cents bigint NOT NULL CHECK(rental_cents BETWEEN 0 AND 100000000),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 policy_version text NOT NULL DEFAULT 'hosting-v1',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_policy_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_policy_booking_parties_read ON public.booking_policy_snapshots FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id
  AND (b.owner_id=(SELECT auth.uid()) OR b.requester_id=(SELECT auth.uid()))));

CREATE TABLE IF NOT EXISTS public.booking_agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL UNIQUE REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 template_id uuid REFERENCES public.approved_agreement_templates(id),
 provider text NOT NULL DEFAULT 'docusign' CHECK(provider='docusign'),
 provider_envelope_id text UNIQUE,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','delivered','completed','declined','voided','error')),
 signer_host_id uuid NOT NULL REFERENCES auth.users(id),
 signer_guest_id uuid NOT NULL REFERENCES auth.users(id),
 signed_pdf_path text,
 certificate_path text,
 signed_pdf_sha256 text,
 certificate_sha256 text,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_agreement_parties_read ON public.booking_agreements FOR SELECT TO authenticated
 USING(signer_host_id=(SELECT auth.uid()) OR signer_guest_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.booking_payment_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id) ON DELETE CASCADE,
 provider text NOT NULL DEFAULT 'unconfigured',
 provider_intent_id text UNIQUE,
 amount_cents bigint NOT NULL CHECK(amount_cents>=0 AND amount_cents<=100000000),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 status text NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','pending','authorized','captured','partially_refunded','refunded','failed','voided')),
 kind text NOT NULL CHECK(kind IN ('rental','deposit')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(booking_id,kind)
);
ALTER TABLE public.booking_payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_parties_read ON public.booking_payment_intents FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id
 AND (b.owner_id=(SELECT auth.uid()) OR b.requester_id=(SELECT auth.uid()))));

CREATE TABLE IF NOT EXISTS public.booking_payment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL,
 provider_event_id text NOT NULL,
 event_type text NOT NULL,
 payload_sha256 text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 booking_id uuid REFERENCES public.property_booking_requests(id),
 UNIQUE(provider,provider_event_id)
);
ALTER TABLE public.booking_payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_payment_event_clients ON public.booking_payment_events FOR SELECT TO authenticated USING(false);

CREATE TABLE IF NOT EXISTS public.host_payout_accounts (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 provider text NOT NULL,
 provider_account_id text NOT NULL,
 verification_status text NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','disabled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.host_payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_reads_payout_account ON public.host_payout_accounts FOR SELECT TO authenticated
 USING(owner_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.booking_payouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL UNIQUE REFERENCES public.property_booking_requests(id),
 host_id uuid NOT NULL REFERENCES auth.users(id),
 payout_cents bigint NOT NULL CHECK(payout_cents>=0),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','eligible','submitted','paid','failed','held')),
 provider_payout_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz
);
ALTER TABLE public.booking_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_reads_own_payout ON public.booking_payouts FOR SELECT TO authenticated
 USING(host_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.booking_refund_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id),
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 100000000),
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 4 AND 1200),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','submitted','paid','failed')),
 provider_refund_id text UNIQUE,
 decided_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz
);
ALTER TABLE public.booking_refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_refund_requester_read ON public.booking_refund_requests FOR SELECT TO authenticated
 USING(requested_by=(SELECT auth.uid()) OR EXISTS(
 SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id AND b.owner_id=(SELECT auth.uid())
 ));

CREATE TABLE IF NOT EXISTS public.booking_damage_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id),
 host_id uuid NOT NULL REFERENCES auth.users(id),
 claimed_cents bigint NOT NULL CHECK(claimed_cents BETWEEN 1 AND 100000000),
 description text NOT NULL CHECK(char_length(description) BETWEEN 10 AND 3000),
 evidence_path text,
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','disputed','under_review','approved','rejected','paid')),
 reviewed_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_damage_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY damage_claim_owner_read ON public.booking_damage_claims FOR SELECT TO authenticated
 USING(host_id=(SELECT auth.uid()) OR EXISTS(
 SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id AND b.requester_id=(SELECT auth.uid())
 ));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('hosting-claims','hosting-claims',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,
 allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'];

CREATE TABLE IF NOT EXISTS public.booking_reschedule_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id),
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 proposed_start timestamptz NOT NULL,
 proposed_end timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),
 responded_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(proposed_end>proposed_start)
);
ALTER TABLE public.booking_reschedule_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_reschedule_parties_read ON public.booking_reschedule_requests FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b WHERE b.id=booking_id
 AND (b.owner_id=(SELECT auth.uid()) OR b.requester_id=(SELECT auth.uid()))));

CREATE TABLE IF NOT EXISTS public.hosting_notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id),
 channel text NOT NULL CHECK(channel IN ('email','push')),
 template text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','delivered','failed','disabled')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
ALTER TABLE public.hosting_notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_outbox_metadata_read ON public.hosting_notification_outbox FOR SELECT TO authenticated
 USING(recipient_id=(SELECT auth.uid()));

-- Privacy: no direct client writes to any commerce, approval, or audit table.
-- A signed-off legal agreement and a provider-confirmed capture are both needed
-- before private check-in addresses can be retrieved.
CREATE OR REPLACE FUNCTION public.hosting_guard_ready_to_checkin()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.operational_status IN ('ready','checked_in','checked_out','closed') THEN
   IF NEW.status NOT IN ('accepted','completed') OR NEW.legal_status<>'signed'
     OR NEW.payment_status NOT IN ('captured','partially_refunded') THEN
     RAISE EXCEPTION 'Booking requires completed agreement and captured charge';
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hosting_guard_checkin ON public.property_booking_requests;
CREATE TRIGGER hosting_guard_checkin BEFORE INSERT OR UPDATE OF operational_status,legal_status,payment_status,status
 ON public.property_booking_requests FOR EACH ROW EXECUTE FUNCTION public.hosting_guard_ready_to_checkin();

-- Prevent a self-approved or document-free host from publishing an active venue.
CREATE OR REPLACE FUNCTION public.require_hosting_review()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='active' AND (NEW.approved_at IS NULL OR NEW.approved_by IS NULL
    OR cardinality(NEW.permitted_uses)=0
    OR NEW.owner_id=NEW.approved_by
    OR NOT EXISTS(
     SELECT 1 FROM public.host_verification_requests h
     WHERE h.property_id=NEW.id AND h.owner_id=NEW.owner_id AND h.status='approved'
      AND (h.expires_at IS NULL OR h.expires_at>now())
    )) THEN RAISE EXCEPTION 'Host identity and property authority verification required before publication'; END IF;
 RETURN NEW;
END $$;