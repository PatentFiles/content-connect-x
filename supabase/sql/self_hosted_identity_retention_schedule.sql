-- Apply only after self_hosted_identity_v2.sql, on project yxuqbygykpfbioslljlf.
-- Does NOT enable uploads, manufacture approvals, or select a retention period.
-- The private maintenance token remains in Supabase Vault, never in GitHub.
begin;
update public.ccx_idv_config set worker_origin='https://ccx-identity-worker-staging.up.railway.app' where singleton and not enabled;
-- Idempotently replace the named schedule; do not change unrelated cron jobs.
do $$ declare existing bigint; begin
 for existing in select jobid from cron.job where jobname='ccx-identity-evidence-retention' loop
  perform cron.unschedule(existing);
 end loop;
end $$;
select cron.schedule('ccx-identity-evidence-retention','*/15 * * * *',$job$
 select net.http_post(
  url := 'https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/identity-verification',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='ccx_idv_maintenance_token' limit 1)),
  body := '{"action":"purge"}'::jsonb,
  timeout_milliseconds := 60000
 );
$job$);
commit;
-- After installation, verify cron.job, cron.job_run_details and the actual HTTP
-- response status. Scheduling success alone is not proof of deleted Storage bytes.
-- Existing legal_hold records are excluded; a concurrent hold/purge acceptance
-- test and a documented hold procedure remain required before activation.
