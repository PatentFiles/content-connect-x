# Content Connect X: first-party identity verification

Status as of 2026-11-18: **draft implementation, not a live or production-approved replacement for Yoti**. This document covers the new branch implementation. Production retains the existing admission policy until a reviewed deployment and activation. The original `server/self-hosted-idv` adapter remains an isolated evaluation helper; the new application path is `supabase/functions/identity-verification` plus `server/idv-worker`.

## Infrastructure isolation

A new private Railway project was created specifically for this service:

- Project: **Content Connect X - Identity** — `a1cd7002-0ab0-4c4b-a728-252b5693225d`.
- Environment: **staging** — `7875b268-0f10-4e8f-b9b2-0871752e8ac9`.
- Service: **ccx-identity-worker** — `56d8ed19-c019-4cd9-9738-cf0e91d06212`.
- Dockerfile: `server/idv-worker/Dockerfile`; health path `/health`; 2 vCPU/4 GB resource ceiling.
- Public configuration only: `SUPABASE_URL=https://yxuqbygykpfbioslljlf.supabase.co`, `PORT=8080`, `NODE_ENV=production`, `LOG_LEVEL=error`.

The unrelated Railway project was not modified. The empty worker created during the initial attempt in the older Content Connect staging project was inspected and removed; it had no source, deployment, domains, volumes, or variables. Its pre-existing web service was not stopped or redeployed.

**The new worker has no deployment.** Connecting `PatentFiles/content-connect-x` failed with Railway's response: `User does not have access to the repo`. Railway's GitHub authorization for this private repository must be resolved without making the repository public or using credentials from another account.

The existing Content Connect Supabase project remains the intended account/evidence backend. No duplicate Supabase project was created.

## Deployment state — do not confuse source with running infrastructure

The database migration write was blocked by the tool's safety check. A subsequent read confirmed `public.ccx_idv_config` and `public.ccx_idv_sessions` are absent and the `ccx-identity-evidence` bucket does not exist. The identity Edge Function was not deployed. The new UI is committed to draft PR #15, not merged into `main` or released to Bolt.

Therefore no production identity evidence, verification approval, or member admission was created by this implementation. No raw ID image was used in the local tests.

## Intended application flow implemented in source

1. Supabase creates a pending Auth account. The existing server-owned `member_admissions` record is still required to enter the application. This design blocks membership/access, not creation of the initial Auth row.
2. A signed-in, non-anonymous user with confirmed email supplies a **private legal name** and explicit consent to the configured verification notice. Existing private `member_profiles.real_name` pre-fills the field. Public stage/display names remain separate.
3. Upload JPEG/PNG ID front and, for two-sided IDs, back. Files are limited to 8 MB and stored privately. Passport capture uses the photo page. Country support is explicitly configured; the initial configuration contains US only and is not a claim of validated coverage.
4. The browser requests camera permission and captures two server-assigned head turns. Six frames and a selfie snapshot are submitted. Neither a browser `verified` flag nor a user-supplied DOB is trusted.
5. A server-bound worker job reads ID name/DOB/expiry/number, cross-checks document fields, compares face descriptors, and checks the motion frames. Facial age estimation and gender inference are removed from the worker's face pipeline. Birth date comes from the document, not an estimated face age.
6. Name mismatch returns a correction screen. The server accepts only the extracted legal name; it updates the private account name, never the public display name. Ambiguous names/documents require retry or independent review rather than fuzzy automatic acceptance.
7. Underage results remain blocked through the eighteenth birthday. Retry eligibility begins the following **UTC calendar day**. February 29 maps conservatively to March 1 in a non-leap eighteenth year, with eligibility March 2. These are explicit product rules, not statements of jurisdictional law. Becoming eligible does not automatically admit an account: a fresh check is required.
8. Only a complete, bound result may insert an approved age request and invoke the existing admission trigger. The activation guard prevents an old Yoti callback from bypassing the new policy after cutover. While disabled, the existing Yoti approval guard is preserved.

`YotiVerification.jsx` is now a compatibility route: the Content Connect branch renders `IdentityVerification`, covering both signup and the existing verification screen. Explicit other-brand calls retain their hosted component. `AdminConsole` gains the private identity-evidence review area.

## Trust and storage boundaries

The worker receives one-use, short-lived job capabilities, not the Supabase service-role key. The Edge authenticates users with `getUser`, checks trusted database security flags, and binds jobs to the server session and evidence hashes. Image URLs are signed temporarily. Returned worker data must match the pinned engine revision, schema, session, and every evidence hash including the selfie.

The schema defines RLS on all new public tables, removes browser table grants, and adds restrictive Storage policies for the identity bucket. Administrators need a server-verified role and admission; self-review is denied. Every administrative document link requires an access purpose and an audit event before a 120-second signed URL is issued. A link-issued event is not proof that a human actually viewed the image.

The server enforces daily attempt limits, immutable evidence slots, upload allocation limits, single active worker leases, and session expiration. Interrupted processing can offer a retry only after the server lease expires. The browser never grants admission itself.

A keyed document fingerprint supports birthday restrictions across attempts using the same document. This does not guarantee prevention of all duplicate identities or stolen-document attacks. A hash and `upsert:false` do not make storage WORM/immutable against a database owner.

## Retention and appeals

Activation requires a real notice/version, an explicit approved retention period, and recorded privacy/security review. No universal legal retention period is assumed. Rejected/abandoned evidence has a short configurable retention period. Account deletion leaves the deletion ledger available so blobs are not orphaned. A maintenance capability is generated into Vault, never returned to the browser.

The purge implementation removes blobs before minimizing session data, with legal-hold filtering. Its scheduler is **not installed**, and deletion/backup restoration/concurrent legal-hold behavior still need integration tests. Do not collect real evidence until this is operational and approved. Do not log raw IDs, OCR responses, names, DOBs, or biometric descriptors to application telemetry.

Review requests and the evidence viewer are implemented. A complete qualified-review adjudication, false-positive correction, and appeal-resolution procedure is still a launch prerequisite; the UI intentionally has no arbitrary manual approval override.

Membership evidence is not automatically performer-recordkeeping compliance. Required purposes, notices, deletion rights, legal holds, access reviews and audit retention need the applicable professional review.

## Validation actually completed

```sh
node --test tests/identity-verification.test.mjs tests/identity-lifecycle.test.mjs
```

**52 local tests passed, zero failed**, on Node v22.16.0. These exercise deterministic policy and the real request handler with mocked database, storage/worker boundaries and synthetic fixtures. They cover birthday/leap-year boundaries, legal-name differences, invalid/missing evidence, cross-account access, admin self-review, forged browser approvals, maintenance authorization and expired processing leases.

These are **not** database integration tests, a full frontend browser suite, an engine Docker-build validation, or real document/face/liveness accuracy measurements. Review the repository quality-gate results separately; do not infer that they passed from this count.

## Remaining release gates

- Resolve Railway access to the private repository, build the pinned worker and establish its actual HTTPS origin in this new project only.
- Obtain review/authorization for the database migration and test the actual grants, triggers, transaction rollback, upload limits, retention and admission behavior. Do not treat the blocked migration as applied.
- Deploy the Edge Function with application-level authentication and gateway `verify_jwt:false`, because worker claims and retention use their own capabilities. All user actions still require verified Supabase authentication.
- Configure the approved notice/retention, install and test retention scheduling, and complete the appeal workflow and operational ownership.
- Audit third-party model rights and dependencies. MIT application code does not automatically clear every model. Validate the actual pinned engine on supported IDs, name formats, mismatches, altered DOBs, photos/replays, injected cameras and missing-model failures. The current thresholds and heuristic authenticity checks are not independently certified.
- Run authenticated multi-user and mobile/browser acceptance tests, inspect security advisors, then review/merge/deploy frontend changes and deliberately activate the backend. Never populate security/privacy approval timestamps merely to make a check pass.

Until these gates are met, this is a substantial implementation draft, **not ready for real-user verification**.
