-- Context-scoped live meetings for collaborations, private conversations and community groups.
create table if not exists public.ccx_meeting_notes(
 scope text not null check (scope in ('collaboration','conversation','group')),
 scope_id uuid not null,
 body text not null default '' check (char_length(body)<=20000),
 version integer not null default 1,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(scope,scope_id)
);
create table if not exists public.ccx_meeting_note_events(
 id uuid primary key default gen_random_uuid(),scope text not null,scope_id uuid not null,
 version integer not null,actor_id uuid not null references auth.users(id),body text not null,
 created_at timestamptz not null default now(),unique(scope,scope_id,version)
);
create table if not exists public.ccx_meeting_recording_consents(
 scope text not null check (scope in ('collaboration','conversation','group')),
 scope_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,
 approved boolean not null default false,updated_at timestamptz not null default now(),
 primary key(scope,scope_id,user_id)
);
create table if not exists public.ccx_meeting_invites(
 id uuid primary key default gen_random_uuid(),
 scope text not null check (scope in ('collaboration','conversation','group')),
 scope_id uuid not null,invited_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists ccx_meeting_invites_scope_recent on public.ccx_meeting_invites(scope,scope_id,created_at desc);
create table if not exists public.ccx_meeting_recordings(
 id uuid primary key default gen_random_uuid(),
 scope text not null check (scope in ('collaboration','conversation','group')),
 scope_id uuid not null,recorded_by uuid not null references auth.users(id),
 storage_path text not null unique,content_type text not null,
 transcript_status text not null default 'pending' check (transcript_status in ('pending','completed','failed','not_requested')),
 transcript text,created_at timestamptz not null default now()
);
create index if not exists ccx_meeting_recordings_scope on public.ccx_meeting_recordings(scope,scope_id,created_at desc);
do $$
declare tab text;
begin
 foreach tab in array array[
  'ccx_meeting_notes','ccx_meeting_note_events','ccx_meeting_recording_consents','ccx_meeting_invites','ccx_meeting_recordings'
 ] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
 end loop;
end $$;
create or replace function public.ccx_secret_name_valid(p_name text)
returns boolean language sql immutable set search_path='' as $$
 select p_name=any(array[
  'yoti_token','yoti_sdk_id','pass_partner_token',
  'ccbill_client_account','ccbill_subaccount','ccbill_flex_id','ccbill_salt',
  'ccbill_relay_secret','ccbill_event_timezone',
  'docusign_account_id','docusign_integration_key','docusign_user_id','docusign_private_key','docusign_hmac',
  'openai_api_key','ai_agent_cron_key',
  'livekit_server_url','livekit_api_key','livekit_api_secret',
  'email_api_token','email_sender','webpush_vapid_private',
  'maps_server_key','openmoderate_api_key','sentry_dsn','flagsmith_environment'
 ]);
$$;
