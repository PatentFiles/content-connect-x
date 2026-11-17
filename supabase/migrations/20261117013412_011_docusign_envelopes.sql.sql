-- Independent eSignature provider record for formal performer releases and agreements.
-- A contract is not considered legally signed merely because a browser wrote a row.
create table if not exists public.signature_envelopes (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id),
 collaboration_id uuid not null references public.collaborations(id),
 provider text not null default 'docusign' check (provider = 'docusign'),
 provider_envelope_id text unique,
 status text not null default 'draft' check (status in ('draft','sent','delivered','completed','declined','voided','error')),
 sent_at timestamptz,
 completed_at timestamptz,
 completed_document_path text,
 certificate_path text,
 completed_document_sha256 text,
 certificate_sha256 text,
 last_provider_event_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists signature_envelopes_contract_idx on public.signature_envelopes(contract_id,created_at desc);
alter table public.signature_envelopes enable row level security;
create policy "collaboration signer envelope metadata" on public.signature_envelopes
 for select to authenticated using (
  exists (select 1 from public.collaboration_members cm
    where cm.collaboration_id=signature_envelopes.collaboration_id
      and cm.user_id=(select auth.uid()))
 );
-- No member write policies: the trusted DocuSign integration owns envelope status.
insert into storage.buckets(id,name,public)
 values ('signed-agreements','signed-agreements',false)
 on conflict(id) do update set public=false;
-- Signed documents and certificates remain inaccessible through direct member storage API.
-- The server must check collaboration membership and return short-lived signed URLs.