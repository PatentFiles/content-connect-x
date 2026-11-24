-- Internal scheduler credentials are generated in Vault, never entered by an operator.
-- Existing long-lived credentials are preserved. No third-party provider is enabled.
DO $managed$
DECLARE item text;
BEGIN
 FOREACH item IN ARRAY ARRAY['ccx_hosting_calendar_job_secret','ccx_hosting_notification_job_secret'] LOOP
   IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name=item) THEN
     PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),item,'CCX generated internal scheduler credential',NULL);
   END IF;
 END LOOP;
END $managed$;

CREATE OR REPLACE FUNCTION public.ccx_hosting_job_authorized(p_job text,p_hash text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_hash ~ '^[a-f0-9]{64}$' THEN EXISTS(
   SELECT 1 FROM vault.decrypted_secrets s
   WHERE s.name=CASE p_job
     WHEN 'calendar' THEN 'ccx_hosting_calendar_job_secret'
     WHEN 'notifications' THEN 'ccx_hosting_notification_job_secret'
     ELSE NULL END
     AND length(s.decrypted_secret)>=32
     AND encode(extensions.digest(s.decrypted_secret,'sha256'),'hex')=p_hash
 ) ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.ccx_hosting_job_authorized(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ccx_hosting_job_authorized(text,text) TO service_role;
