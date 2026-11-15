-- Draft signing packets and signer order; formal signatures require DocuSign.
-- This registry never changes contract status or fakes signatures.
ALTER TABLE public.signature_envelopes ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id);
ALTER TABLE public.signature_envelopes ADD COLUMN IF NOT EXISTS signing_order_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.signature_envelopes ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE TABLE IF NOT EXISTS public.signature_packet_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 envelope_id uuid NOT NULL REFERENCES public.signature_envelopes(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL DEFAULT 'signer' CHECK(role IN ('signer','approver','viewer')),
 routing_order integer NOT NULL DEFAULT 1 CHECK(routing_order BETWEEN 1 AND 100),
 provider_recipient_id text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','viewed','signed','declined')),
 signed_at timestamptz,
 UNIQUE(envelope_id,member_id)
);
ALTER TABLE public.signature_packet_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_reads_own_packet_recipient ON public.signature_packet_recipients FOR SELECT TO authenticated
 USING(member_id=(select auth.uid()));
CREATE TABLE IF NOT EXISTS public.signature_packet_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 envelope_id uuid NOT NULL REFERENCES public.signature_envelopes(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 event_type text NOT NULL CHECK(event_type IN ('draft_created','recipient_added','sent_to_provider','provider_event','archived','voided')),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.signature_packet_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY actor_reads_packet_audit ON public.signature_packet_audit FOR SELECT TO authenticated USING(actor_id=(select auth.uid()));
CREATE TRIGGER protect_signature_packet_audit BEFORE UPDATE OR DELETE ON public.signature_packet_audit
 FOR EACH ROW EXECUTE FUNCTION public.prevent_event_modification();
CREATE TABLE IF NOT EXISTS public.approved_agreement_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 140),
 document_type text NOT NULL CHECK(document_type IN ('performer_release','production_agreement','rights_distribution','location_agreement','amendment')),
 provider_template_id text,
 approved_at timestamptz,
 approved_by uuid REFERENCES auth.users(id),
 active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT active OR (provider_template_id IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
ALTER TABLE public.approved_agreement_templates ENABLE ROW LEVEL SECURITY;
-- Trusted administrators register attorney-reviewed templates and provider references.
CREATE POLICY deny_member_template_reads ON public.approved_agreement_templates FOR SELECT TO authenticated USING(false);
