# Content Connect X — Supabase migration (in progress)

This repository currently contains the original Base44 app. The Supabase work in `supabase/sql/001_core_schema.sql`, `supabase/functions/`, and `src/api/supabaseClient.js` is **a new backend foundation only**. It has not been deployed or connected to all pages. Do not remove Base44 or point your production DNS here until the cutover checklist is complete.

## Proposed backend
- Supabase Auth for account login and user identity. User roles must not be read from user-editable metadata.
- Postgres with RLS for per-member data; verification/billing/admin changes only through trusted server code.
- Storage buckets `age-verification` and `member-private`, both private.
- Edge Functions for age review submissions and a limited, approved-age-only directory.
- Read-only previews for age-approved free members; full platform actions require a verified active subscription.
- Payment webhooks must be verified before any paid entitlement is assigned.

## Setup when a Supabase project is selected
1. Add the project URL and publishable key as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Bolt. Never paste service-role credentials into `VITE_*` variables or the browser.
2. Apply `supabase/sql/001_core_schema.sql` to the **new, empty project**. It is a design starting point; apply only after reviewing policies and testing in staging.
3. Deploy `directory` and `submit-age-verification` functions to the project, then test authenticated and unauthenticated behavior.
4. Configure Supabase Auth redirect URLs for Bolt preview and the eventual production domain.
5. Build a reviewed data migration from Base44 export: map email-based account IDs to UUIDs in `auth.users`, migrate private media, and reconcile verified/paid statuses with provider evidence.
6. Replace the old `@base44/sdk` client, ~100 entity schemas, ~55 Base44 backend functions, and all Base44 integrations. Migrate module-by-module and regression-test before switching the frontend.
7. Only after every live workflow passes under Supabase, remove Base44 packages and deploy the production domain.

## Verification checklist
- Member A cannot access member B's private records, private media, conversations or contracts.
- A user cannot create an approved age-verification record or assign themselves a privileged role.
- Free members can submit age documents and browse a limited sanitized directory, but cannot send messages or create contracts.
- Payment events must be verified server-side before enabling paid functionality.
- Test creator, studio, agent, administrator, suspended, unverified, trial, cancelled and expired states.

**Migration status:** foundation code only. No Supabase project chosen, no SQL executed, no records migrated, no end-to-end test passed yet.
