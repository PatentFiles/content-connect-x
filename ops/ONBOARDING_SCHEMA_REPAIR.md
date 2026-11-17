# Onboarding profile/schema repair — November 17, 2026

## Incident and source of truth

The onboarding popup submitted `company_name` and other identity fields that did not exist in the established Content Connect X database. PostgREST rejected the profile write before the verification stage could open. This was a database migration gap, not a missing Yoti API key.

`src/api/publicSupabaseConfig.mjs` pins the application to `yxuqbygykpfbioslljlf`. A separate Bolt-native project, `sotlluwlqxfrzexxidno`, had received profile identity fields but lacked other application tables. Inspecting or migrating that duplicate is not evidence that the CCX application's backend is repaired. No data or sessions were moved between the projects.

## Repair applied to the established database

Migration `20261117144358_repair_onboarding_profile_schema.sql` was applied to `yxuqbygykpfbioslljlf` and committed with the same migration-history version.

- Adds `real_name`, `stage_name`, `company_name`, `representative_name`, `cover_path`, and `state` when absent.
- Preserves existing data, verification decisions, and row-level security.
- Restricts browser clients to reading their own verification status, with review writes reserved to the backend service role.
- Retains authenticated owner-scoped profile INSERT/UPDATE/SELECT.
- Notifies PostgREST to reload its schema cache.

The schema repair is live independently of any frontend rebuild. It does not require a member to create a new account or change their Supabase connection.

## Database verification performed

Twelve checks passed in a single transaction against the established database. Synthetic users, profiles and pending reviews were created for the checks and then rolled back:

1. Creator profile create/update with every onboarding field.
2. Photographer profile create/update.
3. Videographer profile create/update.
4. Video editor profile create/update.
5. Agent profile create/update.
6. Studio profile create/update.
7. Another member's profile cannot be read.
8. Another member's profile cannot be updated.
9. An upsert cannot overwrite another member's profile.
10. A member can read their own pending verification.
11. Another member's verification is not readable.
12. A member cannot approve their own verification.

The test queries actually assumed the `authenticated` database role with synthetic JWT claims; they were not run as unrestricted service-role writes. `scripts/check-onboarding-database.sql` reproduces them and must retain its final ROLLBACK.

Four additional read-only checks passed:

- All columns used by profile refresh, manual review, Yoti sessions, account checks, subscription checks, provider configuration and audit events are present.
- Row-level security is enabled on all seven checked application tables.
- The identity bucket remains private with its 10 MiB limit and allowed PDF/image formats.
- Vault secret retrieval is executable by the service role, not authenticated browser users.

## Regression protection

`tests/onboarding-schema-contract.test.mjs` compares the actual popup write and account-refresh column list against the migration's required-field assertion. The GitHub quality workflow runs it on pushes and pull requests. These are schema/source guards, not simulated claims that a real person completed identity verification.

## Limits and follow-up validation

The Yoti provider was disabled, marked `not_configured`, and had no callback origin at inspection. No Yoti transaction, genuine ID upload, or authenticated mobile browser session was completed in this repair. The manual submission and administrator review Edge Functions are deployed; approval still requires a separate authorized, age-verified MFA reviewer. The popup must not be bypassed or mark an account verified because a profile was saved.

The public-browser diagnostic did not establish an authenticated popup-to-provider flow or reliably identify the deployed application's backend. Do not treat it as end-to-end acceptance evidence. Retest the member's existing signed-in session after refreshing the page.

Security advisors reported existing unrelated warnings for `pg_net` being installed in `public` and compromised-password screening being disabled. Two INFO entries concerned deliberately backend-only tables with RLS and no client policies. This repair is not a blanket production/security certification.
