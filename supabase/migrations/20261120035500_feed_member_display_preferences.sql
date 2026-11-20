-- Persist each member's chosen feed display and posting audience.
-- Browser requests are allowed only for the signed-in member's own row.
-- This table stores no private group membership, viewing history or activity.
begin;
create table public.ccx_feed_display_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 default_audience text not null default 'verified'
   check(default_audience in ('verified','friends','only_me')),
 feed_view text not null default 'discover'
   check(feed_view in ('discover','friends','following')),
 updated_at timestamptz not null default now()
);
alter table public.ccx_feed_display_preferences enable row level security;
revoke all on public.ccx_feed_display_preferences from PUBLIC,anon,authenticated;
grant select,insert,update on public.ccx_feed_display_preferences to authenticated;
grant select,insert,update on public.ccx_feed_display_preferences to service_role;
create policy "Member reads own feed preferences"
 on public.ccx_feed_display_preferences for select to authenticated
 using ((select auth.uid()) is not null and user_id=(select auth.uid()));
create policy "Member creates own feed preferences"
 on public.ccx_feed_display_preferences for insert to authenticated
 with check ((select auth.uid()) is not null and user_id=(select auth.uid()));
create policy "Member edits own feed preferences"
 on public.ccx_feed_display_preferences for update to authenticated
 using ((select auth.uid()) is not null and user_id=(select auth.uid()))
 with check ((select auth.uid()) is not null and user_id=(select auth.uid()));
comment on table public.ccx_feed_display_preferences is
 'Per-account persistent default post audience and home-feed view. RLS denies any other member or anonymous access.';
commit;
