-- Booking reschedules must be accepted by the other party and never
-- silently modify a signed agreement, settled payment or original price.
CREATE OR REPLACE FUNCTION public.apply_accepted_booking_reschedule()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE current_booking public.property_booking_requests%rowtype;
BEGIN
 IF NEW.status='accepted' AND OLD.status='pending' THEN
   SELECT * INTO current_booking FROM public.property_booking_requests WHERE id=NEW.booking_id FOR UPDATE;
   IF current_booking.id IS NULL OR current_booking.status<>'accepted'
     OR current_booking.legal_status NOT IN ('not_prepared','pending_signature')
     OR current_booking.payment_status NOT IN ('not_started','pending','failed')
     OR NEW.proposed_start<=now()
     OR (NEW.proposed_end-NEW.proposed_start)<>(current_booking.ends_at-current_booking.starts_at) THEN
     RAISE EXCEPTION 'Reschedule requires an unpaid, unsigned accepted booking and unchanged duration';
   END IF;
   UPDATE public.property_booking_requests SET starts_at=NEW.proposed_start,ends_at=NEW.proposed_end,
     updated_at=now() WHERE id=NEW.booking_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS apply_booking_reschedule ON public.booking_reschedule_requests;
CREATE TRIGGER apply_booking_reschedule BEFORE UPDATE OF status ON public.booking_reschedule_requests
 FOR EACH ROW EXECUTE FUNCTION public.apply_accepted_booking_reschedule();

-- Never mark a payment or agreement complete through normal booking update
-- unless its corresponding provider evidence exists.
CREATE OR REPLACE FUNCTION public.guard_hosting_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.legal_status='signed' AND OLD.legal_status IS DISTINCT FROM NEW.legal_status AND NOT EXISTS(
   SELECT 1 FROM public.booking_agreements a WHERE a.booking_id=NEW.id AND a.status='completed'
    AND a.completed_at IS NOT NULL AND a.signed_pdf_path IS NOT NULL AND a.certificate_path IS NOT NULL
 ) THEN RAISE EXCEPTION 'Signed booking requires archived DocuSign documents and certificate'; END IF;
 IF NEW.payment_status IN ('captured','partially_refunded','refunded') AND
  OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NOT EXISTS(
    SELECT 1 FROM public.booking_payment_intents p WHERE p.booking_id=NEW.id AND p.kind='rental'
     AND p.status IN ('captured','partially_refunded','refunded') AND p.provider_intent_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'Captured booking must reference confirmed external processor intent'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hosting_guard_financial_evidence ON public.property_booking_requests;
CREATE TRIGGER hosting_guard_financial_evidence BEFORE UPDATE OF legal_status,payment_status
 ON public.property_booking_requests FOR EACH ROW EXECUTE FUNCTION public.guard_hosting_evidence();

-- Immutable money values on ledger rows (transitions status only via trusted server).
CREATE OR REPLACE FUNCTION public.guard_hosting_intent_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
   OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.kind IS DISTINCT FROM OLD.kind
   OR NEW.provider IS DISTINCT FROM OLD.provider THEN
   RAISE EXCEPTION 'Payment amount and owner are immutable';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hosting_intent_immutable_amount ON public.booking_payment_intents;
CREATE TRIGGER hosting_intent_immutable_amount BEFORE UPDATE ON public.booking_payment_intents
 FOR EACH ROW EXECUTE FUNCTION public.guard_hosting_intent_amount();
