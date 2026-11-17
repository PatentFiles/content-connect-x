-- Mutual connection approval before premium direct conversations.
create table if not exists public.member_connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(requester_id,recipient_id),
  constraint no_self_connection check(requester_id<>recipient_id)
);
create index if not exists idx_connections_recipient on public.member_connection_requests(recipient_id,status,requested_at desc);
alter table public.member_connection_requests enable row level security;
create policy "connection participants read requests" on public.member_connection_requests
  for select to authenticated
  using (requester_id=(select auth.uid()) or recipient_id=(select auth.uid()));
-- Edge Functions perform entitlement, identity, block, and consent checks.