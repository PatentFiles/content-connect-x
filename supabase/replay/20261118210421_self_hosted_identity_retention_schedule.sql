-- pg_net can temporarily store Authorization headers in its request queue.
-- Its SECURITY DEFINER HTTP functions remain usable; browser roles cannot inspect secrets.
revoke select on net.http_request_queue from public,anon,authenticated;
select cron.schedule('ccx-idv-retention','17 * * * *',$job$
 select net.http_post(
  url:='https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/identity-verification',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='ccx_idv_maintenance_token')),
  body:='{"action":"purge"}'::jsonb,
  timeout_milliseconds:=15000
 );
$job$);
