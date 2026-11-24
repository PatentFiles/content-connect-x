ALTER TABLE public.hosting_notification_outbox
 DROP CONSTRAINT IF EXISTS hosting_notification_outbox_status_check;
ALTER TABLE public.hosting_notification_outbox
 ADD CONSTRAINT hosting_notification_outbox_status_check
 CHECK(status IN ('queued','processing','delivered','failed','disabled'));
CREATE INDEX IF NOT EXISTS hosting_outbox_ready
 ON public.hosting_notification_outbox(status,next_attempt_at,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS host_payout_account_identity
 ON public.host_payout_accounts(provider,provider_account_id);
