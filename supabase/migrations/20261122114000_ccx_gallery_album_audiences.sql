-- Album-specific audience restrictions. Private by default to avoid exposing existing
-- member media when ownership-based album organization becomes shareable.
-- Access to photos, group membership and URLs remains mediated by media-gateway.
alter table public.member_media_albums
 add column if not exists visibility text not null default 'private',
 add column if not exists allowed_group_ids uuid[] not null default '{}'::uuid[];

alter table public.member_media_albums
 drop constraint if exists member_media_albums_visibility_check,
 add constraint member_media_albums_visibility_check
 check(visibility in ('premium','friends','groups','private')),
 drop constraint if exists member_media_albums_group_count_check,
 add constraint member_media_albums_group_count_check
 check(cardinality(allowed_group_ids)<=12 and
       (visibility='groups' or cardinality(allowed_group_ids)=0) and
       (visibility<>'groups' or cardinality(allowed_group_ids)>0));

-- Existing albums are deliberately private until their owner chooses a new audience.
-- Existing media without an album continues under its original audience,
-- with 'verified' now requiring Premium in the Edge Function.
create index if not exists member_media_albums_owner_visibility_idx
 on public.member_media_albums(owner_id,visibility);

alter table public.member_media_albums enable row level security;
revoke all on public.member_media_albums from PUBLIC,anon;
-- No cross-account direct album reads: group membership is checked by gateway.
notify pgrst,'reload schema';
