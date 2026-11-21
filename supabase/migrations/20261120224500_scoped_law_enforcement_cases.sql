-- Scoped law enforcement disclosure, not a third administrator role.
-- No officer can read member tables or raw evidence through RLS/Data API.
create table if not exists public.ccx_law_officers (
 user_id uuid primary key references auth.users(id) on delete restrict,
 agency text not null check(char_length(agency) between 3 and 200),
 official_email text not null,
 jurisdiction text not null check(char_length(jurisdiction) between 2 and 150),
 enabled boolean not null default true,
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 disabled_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.ccx_law_cases (
 id uuid primary key default gen_random_uuid(),
 officer_id uuid not null references public.ccx_law_officers(user_id),
 subject_user_id uuid references auth.users(id),
 agency_case_number text not null check(char_length(agency_case_number) between 3 and 160),
 legal_process_type text not null check(legal_process_type in ('court_order','warrant','subpoena','preservation_request','emergency_request','other')),
 legal_basis text not null check(char_length(legal_basis) between 30 and 3000),
 evidence_reference text not null check(char_length(evidence_reference) between 10 and 500),
 requested_scopes text[] not null default '{}',
 approved_scopes text[] not null default '{}',
 status text not null default 'pending' check(status in('pending','approved','denied','expired','revoked')),
 requested_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 expires_at timestamptz,
 preservation_hold boolean not null default false,
 check(approved_scopes <@ array['profile','admission','platform_activity','safety_reports','collaboration_metadata']::text[]),
 check(requested_scopes <@ array['profile','admission','platform_activity','safety_reports','collaboration_metadata']::text[])
);
create index if not exists ccx_law_cases_officer_date on public.ccx_law_cases(officer_id,requested_at desc);
create index if not exists ccx_law_cases_subject on public.ccx_law_cases(subject_user_id);
create table if not exists public.ccx_law_disclosure_audit(
 id bigint generated always as identity primary key,
 officer_id uuid references public.ccx_law_officers(user_id),
 case_id uuid references public.ccx_law_cases(id),
 action text not null check(action in('officer_provisioned','officer_disabled','case_requested','case_approved','case_denied','case_revoked','viewed','csv_export','pdf_export','preservation_added','preservation_released')),
 subject_user_id uuid,
 result_status text not null default 'ok',
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists ccx_law_disclosure_audit_case on public.ccx_law_disclosure_audit(case_id,created_at desc);
create table if not exists public.ccx_law_holds(
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null unique references public.ccx_law_cases(id),
 subject_user_id uuid not null references auth.users(id),
 effective_at timestamptz not null default now(),
 expires_at timestamptz not null,
 released_at timestamptz,
 authorized_by uuid not null references auth.users(id),
 reason text not null
);
create index if not exists ccx_law_holds_subject on public.ccx_law_holds(subject_user_id,expires_at) where released_at is null;
do $priv$
declare tbl text;
begin
 foreach tbl in array array['ccx_law_officers','ccx_law_cases','ccx_law_disclosure_audit','ccx_law_holds'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from PUBLIC,anon,authenticated',tbl);
 end loop;
end $priv$;
-- Audit log is write-only via service role, and even service updates/deletes
-- must not mutate previously disclosed case access evidence.
create or replace function ccx_workspace_private.ccx_law_audit_immutable()
returns trigger language plpgsql set search_path='' as $body$
begin
 raise exception 'Law enforcement disclosure audit entries are append-only' using errcode='42501';
end $body$;
drop trigger if exists ccx_law_audit_immutable on public.ccx_law_disclosure_audit;
create trigger ccx_law_audit_immutable before update or delete on public.ccx_law_disclosure_audit
for each row execute function ccx_workspace_private.ccx_law_audit_immutable();
revoke all on function ccx_workspace_private.ccx_law_audit_immutable() from public,anon,authenticated;
