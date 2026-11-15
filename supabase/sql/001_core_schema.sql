-- Content Connect X / Supabase foundation
-- Schema for the Supabase application; historical records are not imported automatically.
-- Staged database schema with versioned migrations.
create extension if not exists pgcrypto;

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role_type text not null default 'creator' check (role_type in ('creator','photographer','videographer','video_editor','agent','studio')),
  bio text not null default '',
  avatar_path text,
  city text,
  country text,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.account_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin boolean not null default false,
  banned boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.age_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  provider text not null default 'manual',
  id_document_path text,
  selfie_document_path text,
  reviewer_id uuid references auth.users(id),
  verified_at timestamptz,
  expires_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists age_verification_user_date on public.age_verification_requests(user_id, created_at desc);
create table if not exists public.member_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  plan_id text,
  status text not null default 'inactive' check (status in ('inactive','trial','active','past_due','cancelled','expired')),
  period_end timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.collaborations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id),
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create table if not exists public.collaboration_members (
  collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'participant',
  primary key (collaboration_id,user_id)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (conversation_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created on public.messages(conversation_id,created_at desc);
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id),
  created_by uuid not null references auth.users(id),
  title text not null,
  status text not null default 'draft',
  content jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null,
  description text not null default '',
  city text,
  state text,
  country text,
  status text not null default 'draft' check (status in ('draft','pending_review','active','paused','suspended','archived')),
  hourly_rate numeric(12,2),
  created_at timestamptz not null default now()
);
create table if not exists public.property_private (
  property_id uuid primary key references public.properties(id) on delete cascade,
  exact_address text,
  latitude numeric,
  longitude numeric,
  entry_instructions text,
  smart_lock_config jsonb not null default '{}'::jsonb,
  internal_notes text
);

-- All exposed tables have RLS; no anonymous access to member information.
alter table public.member_profiles enable row level security;
alter table public.account_security enable row level security;
alter table public.age_verification_requests enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.collaborations enable row level security;
alter table public.collaboration_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.contracts enable row level security;
alter table public.properties enable row level security;
alter table public.property_private enable row level security;

-- Member profile owner can create/edit their nonprivileged details only.
create policy "member owns profile read" on public.member_profiles for select to authenticated using (id = (select auth.uid()));
create policy "member creates profile" on public.member_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "member edits profile" on public.member_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- A member can view their own account status, but only trusted server code can change it.
create policy "member sees own security" on public.account_security for select to authenticated using (user_id = (select auth.uid()));
create policy "member sees own age requests" on public.age_verification_requests for select to authenticated using (user_id = (select auth.uid()));
create policy "member sees own billing" on public.member_subscriptions for select to authenticated using (user_id = (select auth.uid()));
-- Verification approvals, billing entitlements, account bans and admin roles have no user write policy.

-- Collaboration and communication data require explicitly authorized participants.
create policy "collaboration owner read" on public.collaborations for select to authenticated using (creator_id = (select auth.uid()));
create policy "collaboration owner insert" on public.collaborations for insert to authenticated with check (creator_id = (select auth.uid()));
create policy "collaboration owner update" on public.collaborations for update to authenticated using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
create policy "member sees own collaborations" on public.collaboration_members for select to authenticated using (user_id = (select auth.uid()));
create policy "member sees own conversations" on public.conversation_members for select to authenticated using (user_id = (select auth.uid()));
create policy "member reads messages" on public.messages for select to authenticated using (
  exists(select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = (select auth.uid()))
);
-- Sending messages intentionally has NO direct INSERT policy; an authenticated Edge Function
-- must verify age, paid entitlement, blocks and conversation membership first.
create policy "contract author reads" on public.contracts for select to authenticated using (created_by = (select auth.uid()));
-- Contract/signature creation and locking must be enforced by a backend service.
create policy "owner reads properties" on public.properties for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner edits draft properties" on public.properties for update to authenticated using (owner_id = (select auth.uid()) and status in ('draft','paused')) with check (owner_id = (select auth.uid()) and status in ('draft','paused'));
create policy "owner creates draft property" on public.properties for insert to authenticated with check (owner_id = (select auth.uid()) and status='draft');
create policy "owner reads property private" on public.property_private for select to authenticated using (exists(select 1 from public.properties p where p.id=property_id and p.owner_id=(select auth.uid())));
-- Public discovery is served through a curated server-side response, never raw table access.

-- Private media buckets; documents never public.
insert into storage.buckets(id,name,public) values ('age-verification','age-verification',false) on conflict(id) do update set public=false;
insert into storage.buckets(id,name,public) values ('member-private','member-private',false) on conflict(id) do update set public=false;
create policy "member upload own verification" on storage.objects for insert to authenticated
  with check (bucket_id='age-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "member upload own private files" on storage.objects for insert to authenticated
  with check (bucket_id='member-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "member read own private files" on storage.objects for select to authenticated
  using (bucket_id='member-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No client read policy for age verification documents; trusted reviewer service only.