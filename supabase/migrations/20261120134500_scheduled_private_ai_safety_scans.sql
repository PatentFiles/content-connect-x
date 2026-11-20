-- Weekly automated AI safety scans using a dedicated randomly generated job secret.
-- No OpenAI credential, service-role key, or callable administrator token is embedded in SQL.
create or replace function public.ccx_secret_name_valid(p_name text)
returns boolean language sql immutable set search_path='' as $$
 select p_name=any(array[
  'yoti_token','yoti_sdk_id','pass_partner_token',
  'ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt',
  'ccbill_relay_secret','ccbill_event_timezone',
  'docusign_account_id','docusign_integration_key','docusign_user_id','docusign_private_key','docusign_hmac',
  'openai_api_key','ai_agent_cron_key',
  'email_api_token','email_sender','webpush_vapid_private',
  'maps_server_key','openmoderate_api_key','sentry_dsn','flagsmith_environment'
 ]);
$$;
do $setup$
begin
 if not exists (select 1 from vault.decrypted_secrets where name='ccx_runtime_ai_agent_cron_key') then
  perform vault.create_secret(
   encode(extensions.gen_random_bytes(32),'hex'),
   'ccx_runtime_ai_agent_cron_key',
   'Private Content Connect X AI safety weekly cron credential',
   null
  );
 end if;
end $setup$;
-- The secret is read only when the DB scheduler executes. It is never committed.
select cron.schedule(
 'ccx_ai_safety_weekly',
 '15 3 * * 0',
 $job$
 select net.http_post(
   url:='https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/ai-agent-worker',
   headers:=jsonb_build_object(
     'Content-Type','application/json',
     'X-CCX-CRON-KEY', public.ccx_secret_get('ai_agent_cron_key')
   ),
   body:='{"action":"safety_scan"}'::jsonb,
   timeout_milliseconds:=30000
 ) as request_id;
 $job$
);
