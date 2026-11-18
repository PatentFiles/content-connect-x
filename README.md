## Public homepage styling boundary — November 18, 2026

The logged-out Content Connect X and Host Connect pages retain their original dark/neon branding, original hero artwork, gradients and responsive layout. The professional white redesign applies **after sign-in**, including member, administrator, verification and host workspaces. Do not replace public artwork or apply workspace CSS globally.

The public skin is restored from commit `21b95435a02e9e1e6ddc10e8805f377bf4b9a67d`. `authAppearance.js` follows the actual Auth session and changes presentation only. Every theme selector is scoped to either public or non-public appearance, with original specificity preserved via `:where()`. This cannot grant admission or bypass any backend rule. Signing out restores public styling and clears the Host workspace display.

Regression tests verify all three original asset hashes, every CSS scope, real image decoding at mobile/desktop sizes, and real component sign-in/sign-out transitions using isolated Auth fixtures. Existing white-workspace/modal, identity and account-access tests remain in place. Bolt is still the website host; no Supabase or Railway deployment is needed for this presentation fix.

# Content Connect X

Content Connect X is a professional collaboration platform for adult creators, studios, agents, photographers, videographers, editors and production teams.

> **Private ID testing:** Existing admitted administrators can use **Platform Controls → Test my ID** after this frontend is synchronized and published through Bolt. The separate, consent-based test runs the real ID and live-camera pipeline without granting membership. Pilot access is enabled through November 25, 2026 at 22:59 UTC; test evidence is scheduled for deletion after 24 hours. See [private testing and verified deployment details](docs/PRIVATE_IDENTITY_PILOT.md).

> **Public release status:** Infrastructure and passing software tests are not verification-provider acceptance, biometric accuracy validation, or legal/security certification. Ordinary first-party signup identity collection remains **disabled** until its release prerequisites are completed. The private pilot does not bypass that gate. See [identity rollout](docs/SELF_HOSTED_IDENTITY_V2.md) and [enterprise audit](docs/ENTERPRISE_AUDIT_2026-11-17.md).

## Hosting and architecture — do not migrate the website

- **Bolt hosts the website.** React + Vite + Tailwind provide public pages, signup, camera capture and member/admin screens. Keep the existing website domain and Bolt publishing workflow.
- **Supabase is the account and evidence authority.** Use the established project **`yxuqbygykpfbioslljlf`** for Auth, Postgres, RLS, private Storage, Realtime, Edge Functions and Cron. Do not substitute a Bolt-native database or create a duplicate production database.
- **Railway runs verification computation and private scheduled cleanup only.** In the separate **Content Connect X - Identity** project, `ccx-identity-worker` performs ID extraction and face/liveness processing; `ccx-identity-retention` calls authenticated cleanup every 15 minutes. Railway is not the website host, account database, or permanent document store. Leave unrelated Railway projects untouched.

```text
Bolt website: signup, legal-name form, ID upload, live camera UI
    -> Supabase identity-verification: authentication and session/evidence control
        -> Railway ccx-identity-worker: bounded verification job
    <- Supabase: trusted decision, private evidence and audit records
Bolt website: restricted, correction/review, or verified result

Bolt administrator Test my ID -> Supabase identity-pilot -> same worker in pilot mode
    -> isolated private test evidence/results; NEVER creates member admission
Railway retention cron -> authenticated Supabase cleanup -> private evidence deletion
```

The current worker's self-contained Railway build uses root `/server/idv-worker`, Dockerfile `Dockerfile`, port `8080`, and health path `/health`. Older repository-root build instructions predate this packaging. Do not deploy the entire website on Railway as a substitute for Bolt.

## Development and validation

```bash
npm ci
npm run dev
```

```bash
npm run lint
npm run typecheck
npm run test:unit
node scripts/test-identity-onboarding-browser.mjs
npm run verify:release
npm run verify:frontend-contract
npm run verify:edge-imports
npm run build
npm run smoke:supabase
```

The browser suite requires Chromium and uses synthetic API responses. The identity database CI workflow runs the actual identity SQL in a disposable PostgreSQL database with fixture Auth/Storage/Vault schemas. Neither suite proves biometric accuracy or real Storage deletion. The separate live private-storage probe has exercised upload, authenticated download, public-access denial and deletion with a one-pixel PNG. Never run synthetic acceptance tests against real members or grant production approvals for test convenience.

The root Dockerfile is a test/staging website container, not an instruction to change production hosting. GitHub merge, Bolt synchronization and Bolt publication are distinct release events.

## Supabase configuration

The frontend is pinned to `yxuqbygykpfbioslljlf` through `src/api/publicSupabaseConfig.mjs`. Different-project Bolt-injected variables are ignored with a development warning; a same-project publishable key may be supplied. No server credentials are bundled. Users must sign in to the established Supabase account; sessions from another project do not transfer.

Bolt's database-panel connection indicator is separate from the application's Supabase client. Reconnect the existing project rather than creating another database. A source-code change cannot establish an account's OAuth authorization.

**Never place service-role or `sb_secret_` keys, webhook credentials, ID images, biometric captures, or medical documents in GitHub, browser variables, public buckets or application telemetry.** Optional frontend monitoring uses `VITE_SENTRY_DSN`; experiments use `VITE_FLAGSMITH_ENVIRONMENT_ID`.

## Account entry and identity rules

The [November 17 account-entry policy](docs/ACCOUNT_ENTRY_AND_OPTIONAL_MFA.md) governs durable membership admission. An authenticated signup alone does not grant entry: a server-owned `member_admissions` row is required. Existing legacy-administrator continuity is not evidence of independent age verification. Subsequent enabled-feature access does not impose repeated age or mandatory MFA gates. Voluntary two-factor enrollment remains available. Database roles, suspension, ownership, consent and subscription entitlements still apply.

The first-party identity flow adds:

1. Confirmed email, a private legal name and explicit versioned consent before evidence collection.
2. Government-ID front/back as applicable, plus a server-assigned live camera challenge. Birth date is extracted from the ID, not estimated from the face.
3. Document checks, matching face evidence and live-challenge checks. Ambiguous, incomplete or failed checks never become approval.
4. Legal-name correction when the ID name differs. Only the private verified name is changed; public stage/display names stay separate.
5. Access restricted through the eighteenth birthday, with a fresh attempt eligible the following **UTC calendar day**. February 29 is conservatively mapped to March 1 in a non-leap eighteenth year, then the following day. This is a product policy, not a statement of jurisdictional law.
6. Private evidence, decision/evidence hashes and restricted audit records. Browser fields, redirects, URL flags and user metadata cannot grant admission.

The historical `YotiVerification.jsx` export is a compatibility route: Content Connect uses `IdentityVerification`; explicit other-brand usage retains its hosted component. Older descriptions of manual signup approval, Yoti age-estimation admission or mandatory administrator MFA are historical and must not be used to reintroduce bypasses. Membership verification is not automatically performer recordkeeping compliance.

## Identity deployment status

The established Supabase project has the six production `ccx_idv_*` tables, private `ccx-identity-evidence` bucket, service-only identity state machine, private-name lock and retention/legal-hold guards. RLS and browser-denied table/function privileges were checked. The existing `identity-verification` Edge Function is deployed, and its worker origin is configured.

**Ordinary signup collection is still disabled. Private administrator testing is enabled separately.** The pilot adds three RLS-protected `ccx_idv_pilot_*` tables, `ccx-identity-pilot-evidence`, and the authenticated `identity-pilot` function. Pilot results cannot change production age requests, private account names, public display names or member admissions. It accepts only the existing admitted, confirmed-email administrator's own-ID test with explicit consent. There is no manually forced successful result.

The old hourly Supabase pg_net retention job remains **paused** because managed queue permissions did not permit the attempted credential-read restriction. It is not used. A separate Railway cron now carries a scoped maintenance token in its private environment and invokes production/pilot cleanup plus a synthetic Storage probe every 15 minutes. The live round trip passed on November 18 at 22:57 UTC. A pilot cleanup heartbeat older than 45 minutes pauses new tests. Test evidence expires after 24 hours, or can be requested for early deletion; in-flight upload safety delays and operational outages can delay actual deletion. This is a private testing policy, not an approved production legal-retention rule.

Pending public release work includes reviewed notice/retention, complete appeal handling, supported-document/face/liveness acceptance and final Bolt publication. No real ID has been processed as part of the implementation checks. Privacy/security approval timestamps and successful-evidence production retention were not fabricated. The [private pilot runbook](docs/PRIVATE_IDENTITY_PILOT.md) supersedes the older rollout record only for private-test and retention-deployment status.

## Project layout

- `src/supabase/`: screens and authenticated client workflows, including `IdentityPilot.jsx`
- `src/api/supabaseClient.js`: the single frontend Supabase client
- `supabase/functions/`: server-side gateways, including `identity-verification` and `identity-pilot`
- `supabase/sql/` and `supabase/migrations/`: reviewed schema/policy source and migration history
- `server/idv-worker/`: separately deployed identity computation service
- `server/idv-retention/`: scoped cleanup script deployed as a Railway cron function
- `tests/` and `scripts/`: policy, database, browser and deployment validation
- `supabase/PRODUCTION_MANAGER_IMPLEMENTATION.md`: feature status and launch gates

## Other platform modules

Directory/search expose explicitly public profile fields and enforce backend admission/entitlements. Recovery requires a genuine Supabase email recovery session. Public social links are owner-opt-in and protected by server policy. Free contact limits use general city locations, not household coordinates. Pricing and membership grants are server-owned; selecting a plan is not proof of payment.

Feature administration uses the server-backed `product_feature_flags` registry. Hiding UI is not authorization. Core account access, privacy, consent and verification enforcement must remain available. Administrator preview changes presentation, not actual role or privileges. Profile analytics are owner-scoped aggregates, not disclosure of visitor identity or clinical data.

PASS automatic integration is not connected until authorized partner documentation and sandbox access are supplied. Private uploaded evidence needs independent review; a PDF alone is not approved clearance. The Trust & Readiness module supports voluntary sharing and revocation without exposing clinical reports to collaboration partners. See `ops/PASS_PARTNER_ONBOARDING.md`.

Payments and real signatures require approved provider contracts, configured credentials and successful lifecycle tests. CCBill/DocuSign setup and related release gates are documented in `docs/CCBILL_YOTI_SETUP.md` and `ops/PROVIDER_ACTIVATION.md`. Do not mark users premium or contracts signed because a UI choice or callback URL claims success.

The Hosting Marketplace supports moderated venue listings, galleries, favorites, booking requests, protected addresses, calendars and reviews. See [hosting implementation](supabase/HOSTING_MARKETPLACE.md). Do not infer payment settlement or executed contracts from booking requests.

## Change governance

Document any architectural or enforcement change here and in its relevant runbook. Preserve consent, immutable contract snapshots, server-owned admission and append-only application audit behavior. RLS does not make evidence immutable against database owners; hashes and `upsert:false` are not WORM storage. Use restricted access and appropriate independent retention/backup controls.

Run the [at-home acceptance matrix](ops/AT_HOME_TEST_MATRIX.md) on the actual Bolt deployment with approved redirect origins and separate test users. Record tested source revision and distinguish mocks, disposable database fixtures, live infrastructure checks and real provider/biometric acceptance. Never present one as a substitute for another.
