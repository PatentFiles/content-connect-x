# Content Connect X — Supabase migration (in progress)

This repository contains the original Base44 app plus a working, separate Supabase preview interface. The Supabase work in `supabase/sql/001_core_schema.sql`, `supabase/functions/`, and `src/api/supabaseClient.js` is **a new backend foundation only**. Three Edge Functions are now deployed, but the full legacy Base44 feature set has not been migrated. Do not remove Base44 or point your production DNS here until the cutover checklist is complete.

## Proposed backend
- Supabase Auth for account login and user identity. User roles must not be read from user-editable metadata.
- Postgres with RLS for per-member data; verification/billing/admin changes only through trusted server code.
- Storage buckets `age-verification` and `member-private`, both private.
- Edge Functions for age review submissions and a limited, approved-age-only directory.
- Read-only previews for age-approved free members; full platform actions require a verified active subscription.
- Payment webhooks must be verified before any paid entitlement is assigned.

## Open the standalone Supabase preview in Bolt

- Import `PatentFiles/content-connect-x` from GitHub.
- Run `npm install` and use **`npm run dev:supabase`** as the preview start command. `npm run build:supabase` builds the standalone Supabase preview.
- There is no need to copy any secret into browser code. The source has a public project URL and publishable key fallback; override them with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Bolt if you want different environments. Never expose a service-role key.
- Supabase Auth may require updating the project's allowed redirect URLs to include your actual Bolt preview URL. Authentication with email/password is implemented; sign-up email confirmation depends on Supabase Auth settings.
- The preview has Supabase sign-up/login, a member profile editor, private age-document uploads, age review status, a limited verified directory, and an administrator review queue. **It does not yet have functional premium messaging, contracts, payment checkout, or property booking.**
- Admin role is not self-service: an operator must explicitly provision an administrator after creating a verified account, using a trusted server-side process or an approved manual SQL operation in Supabase Studio. `account_security.admin` is never writable by a normal member.
- The original site remains available through `npm run dev` / `npm run build` until the cutover is approved.

## Setup when a Supabase project is selected
1. Project `yxuqbygykpfbioslljlf` is selected and the publishable client is configured for development. Override its public values in Bolt if needed; never paste a service-role key into `VITE_*` variables.
2. The initial 12-table schema and private buckets have been applied to that project, with RLS enabled on every application table.
3. `directory`, `submit-age-verification`, and `admin-age-review` Edge Functions have been deployed with JWT verification. Unauthenticated probes return HTTP 401. Authorized end-to-end tests remain outstanding.
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

**Migration status:** working Supabase preview shell, actual project configured, 12 tables and 3 Edge Functions deployed. No Base44 member data migrated; no full authenticated end-to-end test passed; original production site still uses Base44.
