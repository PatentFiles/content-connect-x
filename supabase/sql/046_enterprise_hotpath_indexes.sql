-- Targeted indexes for the highest-frequency enterprise booking, payout and
-- notification paths. Keep advanced unused indexes until real workload exists.
DROP INDEX IF EXISTS public.messages_conversation_created;

CREATE INDEX IF NOT EXISTS ccx_booking_claim_booking_status_idx
 ON public.booking_damage_claims(booking_id,status);
CREATE INDEX IF NOT EXISTS ccx_refund_booking_status_idx
 ON public.booking_refund_requests(booking_id,status);
CREATE INDEX IF NOT EXISTS ccx_booking_agreement_signer_guest_idx
 ON public.booking_agreements(signer_guest_id);
CREATE INDEX IF NOT EXISTS ccx_booking_agreement_signer_host_idx
 ON public.booking_agreements(signer_host_id);
CREATE INDEX IF NOT EXISTS ccx_booking_agreement_template_idx
 ON public.booking_agreements(template_id);
CREATE INDEX IF NOT EXISTS ccx_refund_requested_by_idx
 ON public.booking_refund_requests(requested_by,created_at DESC);
CREATE INDEX IF NOT EXISTS ccx_damage_host_idx
 ON public.booking_damage_claims(host_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ccx_payment_attempt_booking_idx
 ON public.hosting_payment_attempts(booking_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ccx_payment_event_booking_idx
 ON public.booking_payment_events(booking_id,verified_at DESC);
CREATE INDEX IF NOT EXISTS ccx_booking_agreement_booking_status_idx
 ON public.booking_agreements(booking_id,status);
CREATE INDEX IF NOT EXISTS ccx_notifications_due_idx
 ON public.hosting_notification_outbox(status,next_attempt_at,created_at)
 WHERE status IN ('queued','failed');
CREATE INDEX IF NOT EXISTS ccx_booking_staff_status_idx
 ON public.hosting_booking_access(user_id,status);
CREATE INDEX IF NOT EXISTS ccx_staff_property_role_idx
 ON public.hosting_staff(property_id,status,role);
CREATE INDEX IF NOT EXISTS ccx_booking_insurance_submitter_idx
 ON public.hosting_booking_insurance(submitted_by);
CREATE INDEX IF NOT EXISTS ccx_incident_booking_status_idx
 ON public.hosting_incidents(booking_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS ccx_calendar_conn_property_idx
 ON public.hosting_calendar_connections(property_id,sync_enabled,next_sync_at);
CREATE INDEX IF NOT EXISTS ccx_booking_addon_asset_idx
 ON public.hosting_booking_addons(addon_id,booking_id);
