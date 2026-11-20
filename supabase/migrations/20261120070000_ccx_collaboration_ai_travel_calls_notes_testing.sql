
-- Content Connect X collaboration extensions, 2026-11-20.
-- All mutations go through the authenticated collab-suite Edge Function (service role).
create table if not exists public.ccx_travel_dates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 city text not null, region text not null default '', country text not null default '',
 starts_at timestamptz not null, ends_at timestamptz not null, visible_to_members boolean not null default true,
 note text not null default '', created_at timestamptz not null default now(),
 constraint ccx_travel_dates_order check (ends_at>starts_at)
);
create index if not exists ccx_travel_dates_user_start on public.ccx_travel_dates(user_id,starts_at);
create table if not exists public.ccx_friend_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 request_policy text not null default 'message_first' check (request_policy in ('message_first','everyone','no_one')),
 allow_intro_messages boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists public.ccx_intro_messages (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id), body text not null check (char_length(body) between 1 and 1200),
 created_at timestamptz not null default now(), read_at timestamptz,
 check (sender_id<>recipient_id)
);
create index if not exists ccx_intro_messages_pair on public.ccx_intro_messages(sender_id,recipient_id,created_at desc);
create index if not exists ccx_intro_messages_recipient on public.ccx_intro_messages(recipient_id,created_at desc);
create table if not exists public.ccx_testing_credentials (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 tested_at timestamptz not null, expires_at timestamptz not null, issuer text not null default '',
 document_path text, status text not null default 'pending_review'
  check (status in ('pending_review','verified','rejected','expired')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
 check (expires_at>tested_at)
);
create index if not exists ccx_testing_credentials_current on public.ccx_testing_credentials(user_id,expires_at desc);
create table if not exists public.ccx_collab_testing_policies (
 collaboration_id uuid primary key references public.collaborations(id) on delete cascade,
 requires_testing boolean not null default false, tested_within_days integer not null default 30 check (tested_within_days between 1 and 365),
 deadline_at timestamptz, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.ccx_ai_agent_runs (
 id uuid primary key default gen_random_uuid(), agent_type text not null check (agent_type in ('safety','matching','contract')),
 triggered_by uuid references auth.users(id), status text not null default 'running' check (status in ('running','completed','failed')),
 scanned_count integer not null default 0, flags_created integer not null default 0, details jsonb not null default '{}'::jsonb,
 error_message text, started_at timestamptz not null default now(), finished_at timestamptz
);
create table if not exists public.ccx_ai_agent_flags (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.ccx_ai_agent_runs(id),
 entity_type text not null check (entity_type in ('profile','collaboration','report')),
 entity_id uuid not null, category text not null, severity text not null check (severity in ('low','medium','high','critical')),
 reason text not null, reviewed_at timestamptz, reviewed_by uuid references auth.users(id), review_note text,
 created_at timestamptz not null default now()
);
create index if not exists ccx_ai_agent_flags_review on public.ccx_ai_agent_flags(reviewed_at,created_at desc);
create table if not exists public.ccx_ai_risk_predictions (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.ccx_ai_agent_runs(id),
 entity_type text not null check (entity_type in ('profile','collaboration')),
 entity_id uuid not null, score smallint not null check (score between 0 and 100),
 reasons jsonb not null default '[]'::jsonb, model text not null, created_at timestamptz not null default now()
);
create table if not exists public.ccx_ai_match_suggestions (
 user_id uuid not null references auth.users(id) on delete cascade,
 suggested_user_id uuid not null references auth.users(id) on delete cascade,
 score smallint not null check (score between 0 and 100), reasons jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now(), dismissed_at timestamptz,
 primary key (user_id,suggested_user_id), check (user_id<>suggested_user_id)
);
create table if not exists public.ccx_collab_notes (
 collaboration_id uuid primary key references public.collaborations(id) on delete cascade,
 body text not null default '', version integer not null default 1, updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.ccx_collab_note_events (
 id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references public.collaborations(id) on delete cascade,
 version integer not null, actor_id uuid not null references auth.users(id), body text not null,
 recorded_at timestamptz not null default now(), unique(collaboration_id,version)
);
create table if not exists public.ccx_collab_call_signals (
 id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references public.collaborations(id) on delete cascade,
 sender_id uuid not null references auth.users(id), recipient_id uuid references auth.users(id),
 kind text not null check (kind in ('join','leave','offer','answer','ice')),
 payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists ccx_collab_call_signals_recent on public.ccx_collab_call_signals(collaboration_id,created_at desc);
create table if not exists public.ccx_collab_recordings (
 id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references public.collaborations(id) on delete cascade,
 recorded_by uuid not null references auth.users(id), storage_path text not null,
 content_type text not null, duration_seconds integer not null default 0,
 created_at timestamptz not null default now(), transcript_status text not null default 'pending'
 check (transcript_status in ('pending','completed','failed','not_requested'))
);
create table if not exists public.ccx_collab_transcripts (
 id uuid primary key default gen_random_uuid(), recording_id uuid not null unique references public.ccx_collab_recordings(id) on delete cascade,
 collaboration_id uuid not null references public.collaborations(id) on delete cascade,
 transcript text not null, model text not null, created_at timestamptz not null default now()
);
-- Restrict raw tables from browser clients. Edge functions check auth and participant/admin membership.
do $$ declare tab text; begin
 foreach tab in array array['ccx_travel_dates','ccx_friend_settings','ccx_intro_messages',
 'ccx_testing_credentials','ccx_collab_testing_policies','ccx_ai_agent_runs','ccx_ai_agent_flags',
 'ccx_ai_risk_predictions','ccx_ai_match_suggestions','ccx_collab_notes',
 'ccx_collab_note_events','ccx_collab_call_signals','ccx_collab_recordings','ccx_collab_transcripts']
 loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on table public.%I from public, anon, authenticated',tab);
 end loop;
end $$;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('ccx-collab-recordings','ccx-collab-recordings',false,52428800,array['video/webm','audio/webm','audio/mp4','video/mp4'])
 on conflict (id) do nothing;
