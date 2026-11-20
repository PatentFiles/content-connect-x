-- Disable obsolete vendor in settings; disallow retired credential names in Vault.
update public.ccx_integrations set enabled=false,setup_status='retired',updated_at=now() where provider='yoti' and enabled is distinct from false;
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
  'openai_api_key','ai_agent_cron_key',
  'livekit_server_url','livekit_api_key','livekit_api_secret',
  'email_api_token','email_sender','webpush_vapid_private',
  'maps_server_key','openmoderate_api_key','sentry_dsn','flagsmith_environment'
 ]);
$function$;