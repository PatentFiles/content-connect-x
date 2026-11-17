-- Internal-only configuration tables are intentionally inaccessible to members.
-- Explicit deny policies make the intended RLS behavior visible to schema audits.
create policy "No client reads billing processing records"
  on public.billing_webhook_events
  for select to authenticated using (false);
create policy "No client reads server feature rollout definitions"
  on public.product_feature_flags
  for select to authenticated using (false);