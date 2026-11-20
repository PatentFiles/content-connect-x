create table if not exists public.ccx_contract_draft_reviews(
 contract_id uuid not null references public.contracts(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete cascade,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 decision text not null check(decision in('approved','changes_requested')),
 reviewed_at timestamptz not null default now(),
 primary key(contract_id,reviewer_id)
);
alter table public.ccx_contract_draft_reviews enable row level security;
revoke all on public.ccx_contract_draft_reviews from public,anon,authenticated;
create index if not exists ccx_contract_draft_reviews_status on public.ccx_contract_draft_reviews(contract_id,decision);