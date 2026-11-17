-- Idempotent in-app production reminders; external email requires separately approved provider.
CREATE TABLE IF NOT EXISTS public.production_event_reminder_deliveries (
 event_id uuid NOT NULL REFERENCES public.production_events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 reminder_type text NOT NULL CHECK(reminder_type IN ('24h','1h')),
 delivered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,user_id,reminder_type)
);
ALTER TABLE public.production_event_reminder_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_event_reminder_delivery ON public.production_event_reminder_deliveries
 FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE SCHEMA IF NOT EXISTS ccx_internal;
REVOKE ALL ON SCHEMA ccx_internal FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION ccx_internal.deliver_event_reminders()
RETURNS integer LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE processed integer := 0;
BEGIN
 WITH due AS (
 SELECT e.id AS event_id,r.user_id,
  CASE WHEN e.starts_at <= now()+interval '1 hour' THEN '1h' ELSE '24h' END AS reminder_type
 FROM public.production_events e
 JOIN public.production_event_rsvps r ON r.event_id=e.id AND r.status='going'
 LEFT JOIN public.member_notification_preferences prefs ON prefs.user_id=r.user_id
 WHERE e.status='scheduled' AND e.starts_at>now() AND e.starts_at<=now()+interval '24 hours'
  AND COALESCE(prefs.booking_reminders,true)
 ), newly_delivered AS (
 INSERT INTO public.production_event_reminder_deliveries(event_id,user_id,reminder_type)
 SELECT event_id,user_id,reminder_type FROM due
 ON CONFLICT DO NOTHING
 RETURNING event_id,user_id,reminder_type
 )
 INSERT INTO public.member_notifications(recipient_id,kind,title,details)
 SELECT n.user_id,'event_reminder',
  CASE WHEN n.reminder_type='1h' THEN 'Production starts within 1 hour' ELSE 'Upcoming production within 24 hours' END,
  jsonb_build_object('event_id',n.event_id,'reminder_type',n.reminder_type)
 FROM newly_delivered n;
 GET DIAGNOSTICS processed=ROW_COUNT;
 RETURN processed;
END $$;
REVOKE ALL ON FUNCTION ccx_internal.deliver_event_reminders() FROM PUBLIC,anon,authenticated;