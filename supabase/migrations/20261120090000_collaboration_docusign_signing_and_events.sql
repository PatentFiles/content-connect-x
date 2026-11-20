-- Distinguish an in-flight DocuSign send from a draft to prevent duplicate envelopes.
alter table public.signature_envelopes drop constraint if exists signature_envelopes_status_check;
alter table public.signature_envelopes add constraint signature_envelopes_status_check
check (status in ('draft','sending','sent','delivered','completed','declined','voided','error'));
alter table public.signature_envelopes
add column if not exists provider_transaction_id uuid;
create unique index if not exists ccx_signature_envelopes_transaction_uq
on public.signature_envelopes(provider_transaction_id) where provider_transaction_id is not null;
create table if not exists public.ccx_signature_provider_events(
 id uuid primary key default gen_random_uuid(),
 envelope_id uuid not null references public.signature_envelopes(id) on delete cascade,
 event_hash text not null unique,
 event_type text not null,
 created_at timestamptz not null default now(),
 processed_at timestamptz
);
alter table public.ccx_signature_provider_events enable row level security;
revoke all on public.ccx_signature_provider_events from public,anon,authenticated;