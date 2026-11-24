-- Trusted signer identities are separately verified, never sourced from editable profiles.
CREATE TABLE IF NOT EXISTS public.hosting_verified_signer_names (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 legal_name text NOT NULL CHECK(char_length(legal_name) BETWEEN 3 AND 180),
 verified_by uuid NOT NULL REFERENCES auth.users(id),
 verified_at timestamptz NOT NULL DEFAULT now(),
 method text NOT NULL CHECK(method IN ('reviewed_government_id','approved_identity_provider')),
 CHECK(user_id<>verified_by)
);
ALTER TABLE public.hosting_verified_signer_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_signer_name_read ON public.hosting_verified_signer_names FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
-- Sending starts only after a server-side CAS transition; never generate two
-- Docusign envelopes for one booking on repeated button presses.
ALTER TABLE public.booking_agreements DROP CONSTRAINT IF EXISTS booking_agreements_status_check;
ALTER TABLE public.booking_agreements ADD CONSTRAINT booking_agreements_status_check
 CHECK(status IN ('draft','sending','sent','delivered','completed','declined','voided','error'));
CREATE TABLE IF NOT EXISTS public.hosting_provider_reconciliation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL CHECK(provider IN ('docusign','merchant','notification')),
 entity_id uuid NOT NULL,
 issue text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','blocked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 UNIQUE(provider,entity_id,issue)
);
ALTER TABLE public.hosting_provider_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_reconciliation_client_reads ON public.hosting_provider_reconciliation FOR SELECT TO authenticated USING(false);
