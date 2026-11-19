-- No third-party ad scripts, tracking pixels, sex-life or sexual-orientation targeting.
-- Campaigns are disabled unless explicitly approved and within their valid dates.
create table if not exists public.ccx_sponsorship_campaigns(
 id uuid primary key default gen_random_uuid(),
 placement text not null check(placement in ('sidebar','feed')),
 sponsor_name text not null check(length(sponsor_name) between 2 and 100),
 headline text not null check(length(headline) between 3 and 160),
 link_url text not null check(link_url ~ '^https://[^[:space:]<>@]+$'),
 disclosure text not null default 'Sponsored · Content Connect X may earn a commission',
 approved boolean not null default false,
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 created_at timestamptz not null default now(),
 check(ends_at is null or ends_at > starts_at)
);
alter table public.ccx_sponsorship_campaigns enable row level security;
revoke all on public.ccx_sponsorship_campaigns from public, anon, authenticated;
grant select (id,placement,sponsor_name,headline,link_url,disclosure,approved,starts_at,ends_at)
 on public.ccx_sponsorship_campaigns to authenticated;
drop policy if exists ccx_sponsorships_approved_only on public.ccx_sponsorship_campaigns;
create policy ccx_sponsorships_approved_only on public.ccx_sponsorship_campaigns
 for select to authenticated
 using(approved=true and starts_at<=now() and (ends_at is null or ends_at>now()));
comment on table public.ccx_sponsorship_campaigns is 'Owner-approved professional sponsorships only. No third-party pixels, sensitive targeting or campaign IDs tied to members.';
