create table if not exists public.ccx_meeting_recording_states(
 scope text not null check(scope in('collaboration','conversation','group')),
 scope_id uuid not null,recorded_by uuid not null references auth.users(id),
 is_recording boolean not null default false,heartbeat_at timestamptz not null default now(),
 primary key(scope,scope_id)
);
alter table public.ccx_meeting_recording_states enable row level security;
revoke all on public.ccx_meeting_recording_states from public,anon,authenticated;