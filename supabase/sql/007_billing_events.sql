-- Billing state only changes after verified, idempotent provider webhook processing.
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
 provider_event_id text PRIMARY KEY,
 event_type text NOT NULL,
 processing_status text NOT NULL DEFAULT 'processing' CHECK(processing_status IN ('processing','processed','failed')),
 last_error text,
 processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
-- No anon or member policies. Trusted payment webhooks only.
CREATE INDEX IF NOT EXISTS idx_billing_events_status ON public.billing_webhook_events(processing_status,created_at);
