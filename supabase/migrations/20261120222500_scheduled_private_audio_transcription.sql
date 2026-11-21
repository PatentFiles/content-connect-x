-- Only the scheduled private worker may process saved audio.
CREATE OR REPLACE FUNCTION public.ccx_secret_name_valid(p_name text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select p_name=any(array[
  'pass_partner_token',
  'ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt',
  'ccbill_relay_secret','ccbill_event_timezone',
  'docusign_account_id','docusign_integration_key','docusign_user_id','docusign_private_key','docusign_hmac',
  'openai_api_key','ai_agent_cron_key','ccx_email_worker_key','ccx_transcription_worker_key',
  'livekit_server_url','livekit_api_key','livekit_api_secret',
  'email_api_token','email_sender','webpush_vapid_private',
  'maps_server_key','openmoderate_api_key','sentry_dsn','flagsmith_environment'
 ]);
$function$;
DO $key$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets
     WHERE name='ccx_runtime_ccx_transcription_worker_key') THEN
  PERFORM public.ccx_secret_set('ccx_transcription_worker_key',
   encode(extensions.gen_random_bytes(32),'hex'));
 END IF;
END $key$;
-- Scheduled task is safe to run before OpenAI activation: the Edge function
-- returns a disabled status without claiming queued audio.
SELECT cron.schedule('ccx_private_transcription_every_five_minutes','*/5 * * * *',$schedule$
 SELECT net.http_post(
  url:='https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/ccx-transcription-worker',
  headers:=jsonb_build_object('Content-Type','application/json',
   'x-ccx-worker-key',(SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE name='ccx_runtime_ccx_transcription_worker_key' LIMIT 1)),
  body:='{}'::jsonb,timeout_milliseconds:=30000
 );
$schedule$);
