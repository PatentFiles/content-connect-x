-- Applied migration 20261117132004 on the established CCX Supabase project.
create table if not exists public.membership_plan_catalog (
 plan_code text primary key check(plan_code ~ '^[a-z][a-z0-9_]{2,40}$'),
 role_type text not null check(role_type in ('creator','photographer','videographer','video_editor','agent','studio')),
 tier text not null default 'premium' check(tier='premium'),
 monthly_cents integer not null check(monthly_cents>=0 and monthly_cents<=1000000),
 currency text not null default 'USD' check(currency='USD'),
 roster_seats integer check(roster_seats is null or roster_seats between 1 and 100000),
 label text not null check(length(label) between 2 and 120),
 active boolean not null default true,
 display_order integer not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.membership_plan_catalog enable row level security;
revoke all on public.membership_plan_catalog from public,anon,authenticated;
grant select on public.membership_plan_catalog to anon,authenticated;
create policy ccx_membership_plans_public_read on public.membership_plan_catalog
 for select to anon,authenticated using(active=true);
insert into public.membership_plan_catalog(plan_code,role_type,monthly_cents,roster_seats,label,display_order) values
 ('creator_pro','creator',1999,null,'Creator Premium',1),
 ('photographer_pro','photographer',2999,null,'Photographer Premium',2),
 ('videographer_pro','videographer',4999,null,'Solo Videographer Premium',3),
 ('video_editor_pro','video_editor',4999,null,'Video Editor Premium',4),
 ('agent_10','agent',4999,10,'Agent · up to 10 creators',5),
 ('agent_25','agent',9999,25,'Agent · up to 25 creators',6),
 ('agent_100plus','agent',24999,null,'Agent · 100+ creators',7),
 ('studio_pro','studio',24999,null,'Studio Premium · starting at',8)
on conflict(plan_code) do nothing;
alter table public.creator_production_preferences add column if not exists show_socials_to_premium boolean not null default false;
create table if not exists public.ccx_free_contact_targets (
 actor_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 contacted_at timestamptz not null default now(),
 primary key(actor_id,target_id),
 check(actor_id<>target_id)
);
create index if not exists ccx_free_contact_usage_idx on public.ccx_free_contact_targets(actor_id,contacted_at desc);
alter table public.ccx_free_contact_targets enable row level security;
revoke all on public.ccx_free_contact_targets from public,anon,authenticated;
grant select,insert,update on public.ccx_free_contact_targets to service_role;
create or replace function public.ccx_reserve_free_contact(p_actor uuid,p_target uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare used integer;
begin
 if p_actor is null or p_target is null or p_actor=p_target then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,782061));
 if exists(select 1 from public.ccx_free_contact_targets
 where actor_id=p_actor and target_id=p_target and contacted_at>=now()-interval '7 days') then return true; end if;
 select count(*) into used from public.ccx_free_contact_targets
 where actor_id=p_actor and contacted_at>=now()-interval '7 days';
 if used>=5 then return false; end if;
 insert into public.ccx_free_contact_targets(actor_id,target_id,contacted_at)
 values(p_actor,p_target,now())
 on conflict(actor_id,target_id) do update set contacted_at=excluded.contacted_at;
 return true;
end $$;
revoke all on function public.ccx_reserve_free_contact(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ccx_reserve_free_contact(uuid,uuid) to service_role;
alter table public.ccx_age_provider_sessions
 add column if not exists evidence_id text,
 add column if not exists age_threshold_passed boolean,
 add column if not exists provider_response_hash text,
 add column if not exists verification_request_id uuid references public.age_verification_requests(id);
alter table public.age_verification_requests
 add column if not exists provider_session_id text unique,
 add column if not exists verification_method text,
 add column if not exists evidence_reference text;
