-- Staged premium safety/trust foundation. No clinical reports or diagnostic results.
alter table public.collaborations
  add column if not exists requires_work_clearance boolean not null default false;

create table if not exists public.performer_work_clearances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clearance_confirmed boolean not null default false,
  provider text not null default 'unverified',
  provider_reference text,
  confirmed_at timestamptz,
  expires_at timestamptz,
  reviewed_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint clearances_verified_require_evidence check (
    clearance_confirmed=false or (provider_reference is not null and provider <> 'unverified'
      and confirmed_at is not null and expires_at is not null and expires_at>confirmed_at)
  )
);
alter table public.performer_work_clearances enable row level security;
create policy "performer reads own work clearance"
  on public.performer_work_clearances for select to authenticated
  using (user_id = (select auth.uid()));
-- No member insert/update; only trusted verification services change clearance.

create table if not exists public.background_screening_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_status text not null default 'awaiting_provider'
    check(request_status in ('awaiting_provider','pending','completed','cancelled','unable_to_verify')),
  consent_at timestamptz not null,
  consent_scope text not null,
  provider text,
  provider_case_reference text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_background_user_created on public.background_screening_requests(user_id,created_at desc);
alter table public.background_screening_requests enable row level security;
create policy "member reads own background request"
  on public.background_screening_requests for select to authenticated
  using (user_id=(select auth.uid()));
-- No background findings, criminal history, or protected-class information stored here.
-- Consent, provider communications, notice and review must be handled by a qualified service.