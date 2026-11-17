-- Agora / Orbit-inspired member media, relationships and audited moderation.
create table if not exists public.member_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 followed_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id),
 check(follower_id<>followed_id)
);
alter table public.member_follows enable row level security;
create policy "members see own following" on public.member_follows
 for select to authenticated using(follower_id=(select auth.uid()));

create table if not exists public.member_media_assets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','video/mp4')),
 caption text not null default '' check(char_length(caption)<=500),
 status text not null default 'pending' check(status in ('pending','approved','rejected','hidden')),
 visibility text not null default 'verified' check(visibility in ('verified','connections','private')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check(char_length(storage_path) between 10 and 500)
);
create index if not exists member_media_assets_owner on public.member_media_assets(owner_id,created_at desc);
create index if not exists member_media_assets_moderation on public.member_media_assets(status,created_at desc);
alter table public.member_media_assets enable row level security;
create policy "owner sees private media metadata" on public.member_media_assets
 for select to authenticated using(owner_id=(select auth.uid()));
-- No exposed member insert/update; identity and moderation are server-controlled.