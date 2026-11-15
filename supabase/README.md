# Content Connect X — Supabase migration (in progress)

This repository contains the original Base44 app plus a working, separate Supabase preview interface. The Supabase work in `supabase/sql/001_core_schema.sql`, `supabase/functions/`, and `src/api/supabaseClient.js` is **a new backend foundation only**. Multiple authenticated Edge Functions are deployed for free age verification, professional discovery, consent, collaboration workflows, work-clearance status and safety. The full legacy Base44 feature set has not been migrated. Do not remove Base44 or point your production DNS here until the cutover checklist is complete.

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
- The preview has Supabase sign-up/login, a member profile editor, private age-document uploads, age review status, limited verified directory, administrator review, mutually accepted connections, collaboration messaging, contract/consent records, booking requests, reporting, and work-clearance review. **These workflows need authenticated multi-account tests and do not yet replace the full legacy feature set. Payment checkout remains disabled pending an approved adult-industry processor.**
- Admin role is not self-service: an operator must explicitly provision an administrator after independent age/identity verification, using a trusted server-side process or a reviewed manual operation in Supabase Studio. Administrators cannot approve their own age verification. Initial administrator bootstrap requires a trusted offline review. `account_security.admin` is never writable by a normal member.
- The original site remains available through `npm run dev` / `npm run build` until the cutover is approved.

## Setup when a Supabase project is selected
1. Project `yxuqbygykpfbioslljlf` is selected and the publishable client is configured for development. Override its public values in Bolt if needed; never paste a service-role key into `VITE_*` variables.
2. The initial 12-table schema and private buckets have been applied to that project, with RLS enabled on every application table.
3. Authenticated Supabase functions are deployed for discovery, age-review submissions, admin review, mutually approved connections and collaboration workflows, consent, safety, work clearance, and checkout gating. Unauthenticated probes returned HTTP 401. Authorized end-to-end tests remain outstanding.
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

**Migration status:** Supabase preview shell and backend are active, with 25 RLS-protected application tables and several authenticated Edge Functions. No Base44 member data migrated; Supabase Auth still has no user accounts; no authenticated end-to-end test passed. Stripe checkout is disabled pending adult-industry merchant approval. Original production site still uses Base44. See `PRODUCT_SECURITY_ROADMAP.md` for the full scope and release criteria.

## Integration status

See [INTEGRATION_STATUS.md](./INTEGRATION_STATUS.md) for the full ten-project integration matrix, what is implemented natively, and what still needs vendor credentials or authenticated acceptance testing.

Run `npm run smoke:supabase` for non-destructive JWT gateway checks. This does not replace multi-account tests.
