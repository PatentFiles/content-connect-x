-- Approved gallery engagement; no direct API access to interaction tables.
-- All mutation/read paths go through the authenticated media-gateway, which
-- verifies adult admission, Premium entitlement, blocking and asset visibility.
alter table public.member_media_assets add column if not exists allow_repost boolean not null default false;

create table if not exists public.ccx_gallery_likes (
 media_id uuid not null references public.member_media_assets(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(media_id,user_id)
);
create table if not exists public.ccx_gallery_comments (
 id uuid primary key default gen_random_uuid(),
 media_id uuid not null references public.member_media_assets(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 600),
 status text not null default 'published' check(status in ('published','hidden')),
 created_at timestamptz not null default now()
);
create table if not exists public.ccx_gallery_reposts (
 id uuid primary key default gen_random_uuid(),
 media_id uuid not null references public.member_media_assets(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid unique references public.community_posts(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(media_id,user_id)
);
create index if not exists ccx_gallery_comments_media_idx on public.ccx_gallery_comments(media_id,created_at desc);
create index if not exists ccx_gallery_comments_author_idx on public.ccx_gallery_comments(user_id,created_at desc);
create index if not exists ccx_gallery_reposts_media_idx on public.ccx_gallery_reposts(media_id,created_at desc);
alter table public.ccx_gallery_likes enable row level security;
alter table public.ccx_gallery_comments enable row level security;
alter table public.ccx_gallery_reposts enable row level security;
revoke all on public.ccx_gallery_likes,public.ccx_gallery_comments,public.ccx_gallery_reposts from PUBLIC,anon,authenticated;
grant all on public.ccx_gallery_likes,public.ccx_gallery_comments,public.ccx_gallery_reposts to service_role;
notify pgrst,'reload schema';