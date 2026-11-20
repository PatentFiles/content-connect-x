-- Extend existing encrypted Vault allowlist for single OpenAI key and DocuSign user identity.
create or replace function public.ccx_secret_name_valid(p_name text)
returns boolean language sql immutable set search_path='' as $$
 select p_name=any(array[
  'yoti_token','yoti_sdk_id','pass_partner_token',
  'ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt',
  'docusign_account_id','docusign_integration_key','docusign_user_id','docusign_private_key','docusign_hmac',
  'openai_api_key','email_api_token','email_sender','webpush_vapid_private',
  'maps_server_key','openmoderate_api_key','sentry_dsn','flagsmith_environment'
 ]);
$$;