-- Integrations inspired by Cal.diy, Agora/Orbit, Fider and Flagsmith.
-- Every application table exposed to Data API has RLS enabled.
-- Public social data is disclosed only through an age-gated, filtered Edge API.

create table if not exists public.member_availability (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null default 'travel' check(kind in ('travel','shoot','studio','unavailable')),
 city text not null,
 region text,
 country text not null,
 timezone text not null default 'UTC',
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 note text not null default '',
 visibility text not null default 'verified' check(visibility in ('verified','connections','private')),
 created_at timestamptz not null default now(),
 check (ends_at>starts_at),
 check (char_length(city) between 2 and 100),
 check (char_length(country) between 2 and 100),
 check (char_length(note)<=500)
);
create index if not exists member_availability_city_time on public.member_availability(lower(city),starts_at,ends_at);
create index if not exists member_availability_owner on public.member_availability(user_id,starts_at);
alter table public.member_availability enable row level security;
create policy "member reads own availability" on public.member_availability
 for select to authenticated using(user_id=(select auth.uid()));
-- Never store exact home addresses in discoverable travel entries.

create table if not exists public.community_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 3000),
 status text not null default 'pending' check(status in ('pending','published','hidden','rejected')),
 created_at timestamptz not null default now(),
 published_at timestamptz
);
create index if not exists community_posts_feed on public.community_posts(status,published_at desc);
alter table public.community_posts enable row level security;
create policy "author sees own posts" on public.community_posts for select to authenticated
 using(author_id=(select auth.uid()));

create table if not exists public.community_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000),
 status text not null default 'pending' check(status in ('pending','published','hidden','rejected')),
 created_at timestamptz not null default now()
);
create index if not exists community_comments_post on public.community_comments(post_id,created_at);
alter table public.community_comments enable row level security;
create policy "author sees own comments" on public.community_comments for select to authenticated
 using(author_id=(select auth.uid()));

create table if not exists public.community_reactions (
 post_id uuid not null references public.community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
alter table public.community_reactions enable row level security;
create policy "member sees own reactions" on public.community_reactions for select to authenticated
 using(user_id=(select auth.uid()));

create table if not exists public.feature_feedback (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 5 and 140),
 description text not null default '' check(char_length(description)<=2000),
 status text not null default 'submitted' check(status in ('submitted','under_review','planned','in_progress','shipped','declined')),
 created_at timestamptz not null default now()
);
create index if not exists feature_feedback_status on public.feature_feedback(status,created_at desc);
alter table public.feature_feedback enable row level security;
create policy "author sees own feature feedback" on public.feature_feedback for select to authenticated
 using(creator_id=(select auth.uid()));

create table if not exists public.feature_feedback_votes (
 feedback_id uuid not null references public.feature_feedback(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(feedback_id,user_id)
);
alter table public.feature_feedback_votes enable row level security;
create policy "member sees own votes" on public.feature_feedback_votes for select to authenticated
 using(user_id=(select auth.uid()));

create table if not exists public.product_feature_flags (
 key text primary key check (char_length(key) between 3 and 80),
 enabled boolean not null default false,
 allowed_tiers text[] not null default array['premium']::text[],
 rollout_percent integer not null default 100 check(rollout_percent between 0 and 100),
 description text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.product_feature_flags enable row level security;
-- No direct user access; Edge Functions evaluate flags alongside subscription checks.
insert into public.product_feature_flags(key,enabled,allowed_tiers,description)
values
 ('creator_discovery',true,array['free','premium'],'Verified age-gated creator previews'),
 ('availability',true,array['premium'],'Travel and shoot availability'),
 ('community_feed',true,array['free','premium'],'Age-gated, moderated community feed'),
 ('community_publish',true,array['premium'],'Submit posts for moderator approval'),
 ('product_feedback',true,array['free','premium'],'Feature feedback and voting'),
 ('messages',true,array['premium'],'Mutual connection gated private conversations'),
 ('contracts',true,array['premium'],'DocuSign completion required for formal signing'),
 ('property_bookings',false,array['premium'],'Off until booking process is audited'),
 ('background_screening',false,array['premium'],'Off until qualified provider is configured')
on conflict(key) do nothing;

create table if not exists public.content_moderation_queue (
 id uuid primary key default gen_random_uuid(),
 content_type text not null check(content_type in ('post','comment','media','report')),
 content_id uuid not null,
 submitter_id uuid references auth.users(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','escalated')),
 reason text,
 reviewer_id uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(content_type,content_id)
);
create index if not exists content_moderation_pending on public.content_moderation_queue(status,created_at);
alter table public.content_moderation_queue enable row level security;
create policy "member sees own moderation submissions" on public.content_moderation_queue
 for select to authenticated using(submitter_id=(select auth.uid()));

alter table public.conversation_members add column if not exists last_read_at timestamptz;
-- Persist unread cursor only through authenticated member workflow.