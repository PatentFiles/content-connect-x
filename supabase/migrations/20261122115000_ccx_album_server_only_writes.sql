-- Prevent bypass of album privacy revocation through owner-authenticated direct writes.
-- All create, rename, audience, group and delete mutations must go through
-- media-gateway so preexisting feed reposts are hidden when policy narrows.
revoke all on public.member_media_albums from PUBLIC,anon,authenticated;
grant select on public.member_media_albums to authenticated;
grant all on public.member_media_albums to service_role;
-- Existing owner-only SELECT policy stays intact; RLS remains enabled.
alter table public.member_media_albums enable row level security;
notify pgrst,'reload schema';
