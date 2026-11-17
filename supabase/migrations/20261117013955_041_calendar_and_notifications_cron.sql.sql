-- Automatic calendar/notification workers. Credentials are NEVER stored in SQL
-- or committed to Git. With no Vault secret configured these jobs are no-ops.
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule(
 'ccx-hosting-calendar-poll',
 '*/30 * * * *',
 $cron$
 SELECT net.http_post(
  url:='https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/hosting-calendar',
  headers:=jsonb_build_object(
   'content-type','application/json',
   'authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE name='ccx_hosting_calendar_job_secret' LIMIT 1)
  ),
  body:='{"action":"cron_sync"}'::jsonb,
  timeout_milliseconds:=12000
 ) WHERE EXISTS(SELECT 1 FROM vault.decrypted_secrets
  WHERE name='ccx_hosting_calendar_job_secret');
 $cron$
);
SELECT cron.schedule(
 'ccx-hosting-transactional-notifications',
 '*/5 * * * *',
 $cron$
 SELECT net.http_post(
  url:='https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/hosting-notification-worker',
  headers:=jsonb_build_object(
   'content-type','application/json',
   'authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE name='ccx_hosting_notification_job_secret' LIMIT 1)
  ),
  body:='{}'::jsonb,
  timeout_milliseconds:=12000
 ) WHERE EXISTS(SELECT 1 FROM vault.decrypted_secrets
  WHERE name='ccx_hosting_notification_job_secret');
 $cron$
);