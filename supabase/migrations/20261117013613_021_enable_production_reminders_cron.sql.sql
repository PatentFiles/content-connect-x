-- Supabase Cron: the same named job is idempotently upserted by pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('ccx-production-event-reminders','*/15 * * * *','SELECT ccx_internal.deliver_event_reminders()');