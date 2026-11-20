-- Uniform testing policy enforcement on all agreement creation paths.
create or replace function ccx_workspace_private.ccx_assert_collaboration_testing(p_collaboration uuid)
returns void language plpgsql security definer set search_path='' as $$
declare policy public.ccx_collab_testing_policies;missing_count integer;
begin
 select * into policy from public.ccx_collab_testing_policies where collaboration_id=p_collaboration;
 if not found or not policy.requires_testing then return; end if;
 if policy.deadline_at is not null and policy.deadline_at<now() then
  raise exception 'The collaboration testing deadline has passed' using errcode='23514';
 end if;
 select count(*) into missing_count
 from public.collaboration_members m
 left join lateral (
  select c.id from public.ccx_testing_credentials c
  where c.user_id=m.user_id and c.status='verified' and c.expires_at>now()
    and c.tested_at>=now()-make_interval(days=>policy.tested_within_days)
  order by c.tested_at desc limit 1
 ) evidence on true
 where m.collaboration_id=p_collaboration and m.membership_role='creator' and evidence.id is null;
 if missing_count>0 then
  raise exception 'Every creator must hold current verified testing credentials' using errcode='23514';
 end if;
end $$;
revoke all on function ccx_workspace_private.ccx_assert_collaboration_testing(uuid) from public,anon,authenticated;
create or replace function ccx_workspace_private.ccx_check_contract_testing()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform ccx_workspace_private.ccx_assert_collaboration_testing(new.collaboration_id);
 return new;
end $$;
drop trigger if exists ccx_contract_test_policy on public.contracts;
create trigger ccx_contract_test_policy before insert on public.contracts
 for each row execute function ccx_workspace_private.ccx_check_contract_testing();
drop trigger if exists ccx_envelope_test_policy on public.signature_envelopes;
create trigger ccx_envelope_test_policy before insert on public.signature_envelopes
 for each row execute function ccx_workspace_private.ccx_check_contract_testing();
-- Update expired credential statuses and proactively notify owners.
create or replace function ccx_workspace_private.ccx_expire_testing_credentials()
returns void language plpgsql security definer set search_path='' as $$
begin
 with expired as (
  update public.ccx_testing_credentials c set status='expired'
  where c.status='verified' and c.expires_at<=now()
  returning c.id,c.user_id
 )
 insert into public.member_notifications(recipient_id,kind,title,details)
 select user_id,'testing_deadline','Your testing credential has expired',
 jsonb_build_object('credential_id',id) from expired;
 with approaching as (
  select c.id,c.user_id,c.expires_at from public.ccx_testing_credentials c
  where c.status='verified' and c.expires_at>now() and c.expires_at<=now()+interval '7 days'
 ),unique_alert as (
  insert into public.ccx_testing_expiry_alerts(credential_id,alert_type)
   select id,'seven_days' from approaching on conflict do nothing returning credential_id
 )
 insert into public.member_notifications(recipient_id,kind,title,details)
 select c.user_id,'testing_deadline','Testing credential expires soon',
 jsonb_build_object('credential_id',c.id,'expires_at',c.expires_at)
 from approaching c join unique_alert a on a.credential_id=c.id;
end $$;
create table if not exists public.ccx_testing_expiry_alerts(
 credential_id uuid not null references public.ccx_testing_credentials(id) on delete cascade,
 alert_type text not null, created_at timestamptz not null default now(),
 primary key(credential_id,alert_type));
alter table public.ccx_testing_expiry_alerts enable row level security;
revoke all on table public.ccx_testing_expiry_alerts from public,anon,authenticated;
revoke all on function ccx_workspace_private.ccx_expire_testing_credentials() from public,anon,authenticated;
select cron.schedule('ccx_testing_daily_expiry','0 7 * * *',
 $$select ccx_workspace_private.ccx_expire_testing_credentials();$$)
where not exists(select 1 from cron.job where jobname='ccx_testing_daily_expiry');