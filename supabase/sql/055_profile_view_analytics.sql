-- Real profile opens: private user-level deduplication, owner-only aggregates.
-- No raw visitor rows are accessible to authenticated clients.
create table if not exists public.member_profile_view_events (
 profile_owner_id uuid not null references auth.users(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 viewed_day date not null,
 first_viewed_at timestamptz not null default now(),
 primary key(profile_owner_id,viewer_id,viewed_day),
 constraint profile_views_not_self check (profile_owner_id <> viewer_id)
);
create index if not exists profile_view_owner_day_idx
 on public.member_profile_view_events(profile_owner_id,viewed_day desc);
alter table public.member_profile_view_events enable row level security;
revoke all on public.member_profile_view_events from public, anon, authenticated;
grant select,insert on public.member_profile_view_events to service_role;

create or replace function public.ccx_profile_view_summary(p_owner uuid)
returns jsonb language sql stable security invoker set search_path='' as $fn$
 select jsonb_build_object(
  'total_views', (select count(*) from public.member_profile_view_events where profile_owner_id=p_owner),
  'views_7d', (select count(*) from public.member_profile_view_events where profile_owner_id=p_owner and viewed_day >= (now() at time zone 'utc')::date - 6),
  'views_30d', (select count(*) from public.member_profile_view_events where profile_owner_id=p_owner and viewed_day >= (now() at time zone 'utc')::date - 29),
  'unique_viewers_30d', (select count(distinct viewer_id) from public.member_profile_view_events where profile_owner_id=p_owner and viewed_day >= (now() at time zone 'utc')::date - 29),
  'daily_14d', (
   select coalesce(jsonb_agg(jsonb_build_object('date',days.day::date::text,'views',coalesce(t.views,0)) order by days.day),'[]'::jsonb)
   from generate_series((now() at time zone 'utc')::date - interval '13 days',
                        (now() at time zone 'utc')::date,interval '1 day') as days(day)
   left join (
    select viewed_day,count(*) as views from public.member_profile_view_events
    where profile_owner_id=p_owner and viewed_day >= (now() at time zone 'utc')::date - 13
    group by viewed_day
   ) t on t.viewed_day=days.day::date
  )
 );
$fn$;
revoke all on function public.ccx_profile_view_summary(uuid) from public, anon, authenticated;
grant execute on function public.ccx_profile_view_summary(uuid) to service_role;
