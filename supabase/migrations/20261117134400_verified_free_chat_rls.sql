-- Existing subscription-only private chat policy now admits age-verified free
-- members without exposing content to unverified or restricted accounts.
-- The historical helper name is retained for RLS/realtime compatibility.
create or replace function ccx_internal.can_read_premium_chat()
returns boolean language sql stable set search_path='' as $$
 select (select auth.uid()) is not null
 and exists (
  select 1 from public.age_verification_requests latest
  where latest.user_id=(select auth.uid())
   and latest.id=(
    select a.id from public.age_verification_requests a
    where a.user_id=(select auth.uid())
    order by a.created_at desc limit 1
   )
   and latest.status='approved'
   and (latest.expires_at is null or latest.expires_at>now())
 )
 and not exists(
  select 1 from public.account_security security
  where security.user_id=(select auth.uid())
   and (security.banned or security.suspended)
 );
$$;
drop policy if exists ccx_verified_read_connections on public.member_connection_requests;
create policy ccx_verified_read_connections on public.member_connection_requests
 as restrictive for select to authenticated
 using ((select ccx_internal.can_read_premium_chat()));
