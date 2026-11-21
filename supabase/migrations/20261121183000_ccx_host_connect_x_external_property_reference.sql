-- Cross-project venue references cannot use the legacy local-properties FK.
-- Preserve the existing property_id for historic CCX rows, and store Host
-- Connect X listing IDs separately. Host status is validated by a remote API.
alter table public.ccx_collaboration_plans
 add column if not exists host_property_id uuid;
create index if not exists ccx_collaboration_host_property_idx
 on public.ccx_collaboration_plans(host_property_id)
 where host_property_id is not null;
comment on column public.ccx_collaboration_plans.host_property_id is
 'Canonical Host Connect X property UUID; not a local CCX property or a confirmed booking.';
