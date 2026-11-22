-- Optional availability blocks. Only the owner can manage dates. A public
-- profile preview may display date-only availability through the authenticated
-- directory gateway, never through direct cross-user Data API access.
create table if not exists public.ccx_calendar_blocks(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 starts_on date not null,
 ends_on date not null,
 created_at timestamptz not null default now(),
 constraint ccx_calendar_blocks_date_range check(ends_on>=starts_on and ends_on<=starts_on+365)
);
create index if not exists ccx_calendar_blocks_owner_range_idx on public.ccx_calendar_blocks(user_id,starts_on,ends_on);
alter table public.ccx_calendar_blocks enable row level security;
revoke all on public.ccx_calendar_blocks from public,anon,authenticated;
grant select,insert,delete on public.ccx_calendar_blocks to authenticated;
grant all on public.ccx_calendar_blocks to service_role;
drop policy if exists ccx_calendar_blocks_owner_select on public.ccx_calendar_blocks;
drop policy if exists ccx_calendar_blocks_owner_insert on public.ccx_calendar_blocks;
drop policy if exists ccx_calendar_blocks_owner_delete on public.ccx_calendar_blocks;
create policy ccx_calendar_blocks_owner_select on public.ccx_calendar_blocks for select to authenticated using((select auth.uid())=user_id);
create policy ccx_calendar_blocks_owner_insert on public.ccx_calendar_blocks for insert to authenticated with check((select auth.uid())=user_id);
create policy ccx_calendar_blocks_owner_delete on public.ccx_calendar_blocks for delete to authenticated using((select auth.uid())=user_id);
notify pgrst,'reload schema';