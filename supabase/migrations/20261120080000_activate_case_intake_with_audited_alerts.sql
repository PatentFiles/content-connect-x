
-- Accept public reports into a real case queue; do not claim review merely because a receipt exists.
alter table public.ccx_trust_settings drop constraint if exists ccx_trust_settings_check;
create table if not exists public.ccx_trust_alert_deliveries(
 request_id uuid not null references public.ccx_trust_requests(id) on delete cascade,
 admin_user_id uuid not null references auth.users(id) on delete cascade,
 alert_type text not null,
 delivered_at timestamptz not null default now(),
 primary key(request_id,admin_user_id,alert_type));
alter table public.ccx_trust_alert_deliveries enable row level security;
revoke all on table public.ccx_trust_alert_deliveries from public,anon,authenticated;
create or replace function ccx_workspace_private.ccx_trust_default_due()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.due_at:=coalesce(new.due_at,now()+case new.priority
  when 'critical' then interval '1 hour'
  when 'high' then interval '4 hours' else interval '3 days' end);
 return new;
end $$;
drop trigger if exists ccx_trust_default_due on public.ccx_trust_requests;
create trigger ccx_trust_default_due before insert on public.ccx_trust_requests
 for each row execute function ccx_workspace_private.ccx_trust_default_due();
create or replace function ccx_workspace_private.ccx_trust_alert_staff()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 with delivered as (
  insert into public.ccx_trust_alert_deliveries(request_id,admin_user_id,alert_type)
  select new.id,s.user_id,'new' from public.account_security s
  where s.admin and not s.banned and not s.suspended
  on conflict do nothing returning admin_user_id
 )
 insert into public.member_notifications(recipient_id,kind,title,details)
 select d.admin_user_id,'trust_case','New confidential report requires review',
 jsonb_build_object('case_id',new.id,'priority',new.priority,'due_at',new.due_at)
 from delivered d;
 return new;
end $$;
drop trigger if exists ccx_trust_notify_staff on public.ccx_trust_requests;
create trigger ccx_trust_notify_staff after insert on public.ccx_trust_requests
 for each row execute function ccx_workspace_private.ccx_trust_alert_staff();
create or replace function ccx_workspace_private.ccx_trust_notify_overdue()
returns void language plpgsql security definer set search_path='' as $$
begin
 with pending as (
  insert into public.ccx_trust_alert_deliveries(request_id,admin_user_id,alert_type)
  select q.id,s.user_id,'overdue' from public.ccx_trust_requests q cross join public.account_security s
  where q.status<>'resolved' and q.due_at<now() and s.admin and not s.banned and not s.suspended
  on conflict do nothing returning request_id,admin_user_id
 )
 insert into public.member_notifications(recipient_id,kind,title,details)
 select p.admin_user_id,'trust_case','Overdue confidential report requires review',
 jsonb_build_object('case_id',p.request_id,'priority','overdue') from pending p;
end $$;
revoke all on function ccx_workspace_private.ccx_trust_notify_overdue() from public,anon,authenticated;
select cron.schedule('ccx_trust_hourly_overdue','12 * * * *',
 $$select ccx_workspace_private.ccx_trust_notify_overdue();$$)
where not exists(select 1 from cron.job where jobname='ccx_trust_hourly_overdue');
update public.ccx_trust_settings set intake_enabled=true,updated_at=now() where singleton=true;
