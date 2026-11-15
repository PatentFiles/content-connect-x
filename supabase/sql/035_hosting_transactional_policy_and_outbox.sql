
ALTER TABLE public.host_verification_requests DROP CONSTRAINT IF EXISTS host_verification_requests_property_id_status_key;
CREATE UNIQUE INDEX IF NOT EXISTS host_verification_current_pending ON public.host_verification_requests(property_id) WHERE status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS host_verification_current_approved ON public.host_verification_requests(property_id) WHERE status='approved';
CREATE OR REPLACE FUNCTION public.hosting_snapshot_booking_policy() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE policy text; pct integer; total bigint;
BEGIN
 SELECT cancellation_policy,deposit_percent INTO policy,pct FROM public.properties WHERE id=NEW.property_id;
 total:=round(coalesce(NEW.estimated_total,0)*100);
 INSERT INTO public.booking_policy_snapshots(booking_id,cancellation_policy,deposit_cents,rental_cents)
 VALUES(NEW.id,coalesce(policy,'flexible'),round(total*coalesce(pct,0)/100.0),total)
 ON CONFLICT(booking_id) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hosting_policy_snapshot_insert ON public.property_booking_requests;
CREATE TRIGGER hosting_policy_snapshot_insert AFTER INSERT ON public.property_booking_requests
 FOR EACH ROW EXECUTE FUNCTION public.hosting_snapshot_booking_policy();
CREATE OR REPLACE FUNCTION public.prevent_hosting_policy_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Booking terms snapshots cannot be altered after creation'; END $$;
DROP TRIGGER IF EXISTS booking_policy_immutable ON public.booking_policy_snapshots;
CREATE TRIGGER booking_policy_immutable BEFORE UPDATE OR DELETE ON public.booking_policy_snapshots
 FOR EACH ROW EXECUTE FUNCTION public.prevent_hosting_policy_mutation();
CREATE OR REPLACE FUNCTION public.protect_host_verification_approval() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND (NEW.reviewer_id IS NULL OR NEW.reviewer_id=NEW.owner_id OR NEW.verified_at IS NULL OR NEW.expires_at IS NULL OR NEW.expires_at<=NEW.verified_at) THEN
   RAISE EXCEPTION 'Host approval requires independent reviewer and expiration';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_host_verification ON public.host_verification_requests;
CREATE TRIGGER guard_host_verification BEFORE INSERT OR UPDATE ON public.host_verification_requests
 FOR EACH ROW EXECUTE FUNCTION public.protect_host_verification_approval();
CREATE TABLE IF NOT EXISTS public.hosting_notification_delivery_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 outbox_id uuid NOT NULL REFERENCES public.hosting_notification_outbox(id),
 delivery_provider text NOT NULL,
 remote_message_id text UNIQUE,
 response_code integer,
 delivered_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosting_notification_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY server_only_hosting_delivery_log ON public.hosting_notification_delivery_log FOR SELECT TO authenticated USING(false);
CREATE TABLE IF NOT EXISTS public.hosting_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE,
 p256dh text NOT NULL,
 auth_secret text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_success_at timestamptz
);
ALTER TABLE public.hosting_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_push_registration_metadata ON public.hosting_push_subscriptions FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE TABLE IF NOT EXISTS public.booking_docusign_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider_event_hash text NOT NULL UNIQUE,
 envelope_id text NOT NULL,
 booking_id uuid REFERENCES public.property_booking_requests(id),
 event_status text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz
);
ALTER TABLE public.booking_docusign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_booking_docusign_events ON public.booking_docusign_events FOR SELECT TO authenticated USING(false);
