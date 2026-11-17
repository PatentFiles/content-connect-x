-- Applied migration 20261117132747. Owner-only links, disclosed by protected Edge Function only.
create table if not exists public.member_social_links (
 user_id uuid primary key references auth.users(id) on delete cascade,
 links jsonb not null default '{}'::jsonb check(jsonb_typeof(links)='object'),
 share_with_premium boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.member_social_links enable row level security;
revoke all on public.member_social_links from public,anon,authenticated;
grant select,insert,update on public.member_social_links to authenticated;
create policy ccx_member_social_owner_read on public.member_social_links
 for select to authenticated using(user_id=(select auth.uid()));
create policy ccx_member_social_owner_insert on public.member_social_links
 for insert to authenticated with check(user_id=(select auth.uid()));
create policy ccx_member_social_owner_update on public.member_social_links
 for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
