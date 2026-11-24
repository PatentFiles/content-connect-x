-- The provider identifier can transition once from a placeholder to an
-- approved processor; subsequently it cannot change with an existing intent.
CREATE OR REPLACE FUNCTION public.guard_hosting_intent_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.booking_id IS DISTINCT FROM OLD.booking_id
  OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
  OR NEW.currency IS DISTINCT FROM OLD.currency
  OR NEW.kind IS DISTINCT FROM OLD.kind
  OR (NEW.provider IS DISTINCT FROM OLD.provider AND OLD.provider<>'unconfigured') THEN
   RAISE EXCEPTION 'Captured booking amount, currency and provider are immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TABLE IF NOT EXISTS public.hosting_payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.property_booking_requests(id),
 intent_id uuid NOT NULL REFERENCES public.booking_payment_intents(id),
 provider text NOT NULL CHECK(provider='ccbill'),
 checkout_nonce uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','completed','failed','expired')),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(checkout_nonce)
);
ALTER TABLE public.hosting_payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_checkout_attempts ON public.hosting_payment_attempts FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.property_booking_requests b
  WHERE b.id=booking_id AND b.requester_id=(SELECT auth.uid())));
