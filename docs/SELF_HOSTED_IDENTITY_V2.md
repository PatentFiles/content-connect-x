# Content Connect X: first-party identity verification

Deployment record, November 18, 2026. **The backend foundation is installed; real-document collection and automatic admission through this provider remain disabled.** This is not a production-readiness or biometric-accuracy certification.

## Hosting boundary

**The website remains on Bolt.** No production domain or Bolt hosting migration is part of this work. Supabase project `yxuqbygykpfbioslljlf` remains the account, authorization, decision and private-evidence authority.

The dedicated Railway worker is in:

| Resource | Value |
|---|---|
| Project | Content Connect X - Identity |
| Project ID | `a1cd7002-0ab0-4c4b-a728-252b5693225d` |
| Environment | `staging`, `7875b268-0f10-4e8f-b9b2-0871752e8ac9` |
| Worker | `ccx-identity-worker`, `56d8ed19-c019-4cd9-9738-cf0e91d06212` |
| Worker origin | `https://ccx-identity-worker-staging.up.railway.app` |
| Build root / Dockerfile | `/server/idv-worker` / `Dockerfile` |
| Port / health path | `8080` / `/health` |

The worker packaging was changed to support that self-contained folder. Do not revert it to older repository-root instructions. The additional Railway website staging deployment is not the production website and is not required for identity processing. Unrelated Railway projects must not be modified.

The Railway environment name `staging` does **not** isolate the Supabase database: the worker is configured for the established project above. Synthetic users, fabricated approvals and destructive fixture tests belong in a disposable database, not in production.

## Installed backend

The following remote migrations were applied successfully to the established Supabase project:

- `self_hosted_identity_v2_foundation`: six `ccx_idv_*` public tables, private keys, private evidence storage, server-only identity transition functions, verified-name and upload-limit enforcement.
- `self_hosted_identity_retention_hardening`: deletion-start/hold serialization, bounded candidate batches, auditable sensitive-field minimization and stale evidence-path cleanup.
- `self_hosted_identity_retention_schedule`: initially installed the hourly retention job. **That job is now paused; see the security blocker below.**

Source is in `supabase/sql/self_hosted_identity_v2.sql` and `supabase/sql/self_hosted_identity_retention_hardening.sql`. The base SQL is not idempotent: do not run it again over installed tables. The remote migration history is the deployment record; use a reviewed follow-up migration for additional changes.

Read-back checks confirmed:

- RLS enabled on all six identity tables.
- No `anon`/`authenticated` table reads or writes, and no browser execution of the identity transition RPC.
- `ccx-identity-evidence` is private, capped at 8 MB per object, with restrictive browser Storage policies.
- `worker_origin` is configured; `enabled=false`.
- Existing member admission count remained one; no identity sessions or evidence uploads were created.
- The leap-day policy returns March 2, 2026 for DOB February 29, 2008.

The `identity-verification` Edge Function was already deployed and was inspected. Its deployment wrapper currently imports the handler at commit `21f1969b30e9ac672ae963e9ed04d22c08cdc8f9`. All user actions verify Supabase Auth; worker and maintenance requests have separate capabilities. Gateway `verify_jwt=false` is intentional and must not be confused with unauthenticated user access. No server key is supplied to the browser or Railway worker.

## Implemented account flow

1. Supabase creates a pending authenticated account. Only a trusted `member_admissions` record permits entry to protected application features. Initial Auth-row creation is not membership approval.
2. A signed-in, non-anonymous user confirms email, supplies a private legal name, and consents to the configured versioned notice before any identity upload.
3. JPEG/PNG ID front and back are collected where applicable. Passport capture uses the photo page. Country coverage is explicitly configured; the initial US entry is not evidence of validated support for every US document.
4. The browser requests the camera and captures two server-assigned head turns, six motion frames and a bound selfie snapshot. No browser-provided DOB, `verified` flag or facial-age estimate is trusted.
5. The pinned worker extracts document fields, cross-checks them, compares faces and checks the captured motion. It returns its result to the trusted backend, bound to the session and evidence hashes.
6. The backend rejects incomplete or uncertain checks. A legal-name mismatch requires server-accepted correction of the **private** name. The public stage/display name is not replaced.
7. Underage accounts remain restricted through the eighteenth birthday. Eligibility begins the following **UTC calendar day** and allows a fresh verification attempt, never automatic admission. February 29 is conservatively mapped to March 1 in a non-leap eighteenth year, followed by March 2 eligibility. These are product rules, not statements of jurisdictional law.
8. Only a completed bound result can create an approved age request and invoke durable admission. While the new provider is disabled, the old provider guard is retained; after activation, an old Yoti callback cannot bypass the new policy.

`YotiVerification.jsx` is a compatibility entry point: Content Connect renders `IdentityVerification`; explicit other-brand usage retains its hosted flow. `IdentityEvidenceAdmin` provides an administrator evidence queue, independent-access checks, mandatory access purpose and short-lived document links. A review-request button does not grant approval.

## Trust, evidence and retention

Evidence is stored in private Supabase Storage, not in Bolt public assets, GitHub, ordinary profile fields or Railway persistent storage. The worker receives a short-lived single-use job capability and temporary signed artifact URLs, never the Supabase service-role key. The application binds session, policy, engine revision and all required evidence hashes. Raw OCR, names, DOB and biometric images must not be sent to telemetry.

The server enforces account ownership, security flags, email/consent, daily attempt limits, session expiration, immutable evidence slots, bounded upload allocation and single active processing leases. Administrator document links are audited before issuance and expire after 120 seconds. A link-issued event does not prove a human viewed the file.

Retention hardening records an irreversible `purge_started_at` marker under a session-row lock. A hold committed before deletion starts prevents selection. A new hold arriving after deletion starts is explicitly rejected rather than falsely claiming already-deleted evidence was preserved. Failed deletions retain their ledger for retry. Sensitive fields are minimized only when the ledger is empty. Backups and restoration have separate retention requirements.

Hashes and `upsert:false` are not WORM storage and do not prevent a database owner from changing evidence and hashes together. Identity signup evidence also does not automatically satisfy performer-recordkeeping obligations.

### Retention execution blocker — do not enable collection yet

The installed job is **`ccx-idv-retention`, job ID 4, schedule `17 * * * *`, active=false**.

The initial design queued an HTTPS request through `pg_net`, with a maintenance capability read server-side from Vault. An attempted `REVOKE` on the managed request queue did not remove its effective PUBLIC grant: read-back still showed `anon` and `authenticated` SELECT privileges. The queue owner is the managed `supabase_admin` role. This is a credential-isolation concern; the job was paused rather than claiming the permission change succeeded. No document data was collected by this rollout.

A proposed synchronous private-transport migration was blocked by the connected tool's safety check and **was not installed**. Do not treat that proposal as deployed or route around that block. A properly authorized solution must resolve credential exposure and demonstrate actual scheduled execution and Storage deletion before collection is activated. No unencrypted maintenance token was returned in tool output, browser state, source, or documentation.

## Validation completed

At commit `d12d35b2adffb037605aca0ff64cac8d0808394b`, all three pull-request workflows succeeded:

- **Content Connect X quality gate**, run `44399947266`.
- **Identity verification validation**, run `44399947182`.
- **Identity database integration**, run `44399947273`.

The quality workflow exercises 218 offline tests, lint/typecheck, actual React layouts, 18 identity onboarding browser scenarios, release invariants, frontend/backend contracts, Edge imports, frontend build, a temporary website test container, and live anonymous-endpoint rejection. The onboarding browser fixture stubs both first-party and legacy provider imports and blocks external HTTP. It covers consent, email confirmation, name correction, camera denial, underage/birthday messaging and failure/approval rendering without uploading actual identity evidence.

`tests/sql/identity-integration.sql` runs the actual identity migration and transition SQL in a disposable PostgreSQL 17 service named `ccx_idv_ci`. Auth, Storage and Vault are fixtures. It verifies private Storage policies even in the presence of a deliberately broad fixture policy; server-only transition privileges; disabled collection; cross-account rejection; evidence immutability; one-use job claims; name correction; underage/birthday restrictions; durable admission; private/public name separation; legal-hold ordering; purge minimization; and audit idempotency.

The SQL suite simulates successful blob removal by clearing its fixture deletion ledger. **It does not test real Supabase blob deletion, real Auth/session behavior, biometric accuracy, forged-document detection or replay/deepfake/camera-injection resistance.** A separate attempt to run a production rollback fixture was blocked and is not counted as a completed test. No fake production admission is retained.

## Remaining activation and publication prerequisites

1. Resolve and test credential-safe scheduled retention, including actual blob deletion, backup/restoration behavior and legal-hold races.
2. Establish an approved notice, purpose-specific retention periods and privacy/security review. Approval timestamps are intentionally unset; never fill them merely to satisfy a CHECK constraint.
3. Complete operational review/appeal adjudication and false-positive correction. The queue/viewer exists, but there is no arbitrary manual approval bypass.
4. Validate the deployed worker against supported ID types, legal-name formats, mismatched faces, altered DOBs, printed/screen replays, camera injection, timeouts and missing models. Review all third-party model rights and dependency risks. Heuristic document checks are not independent certification.
5. Release the tested source to the existing Bolt project, verify its actual HTTPS camera flow and authenticated multi-user boundaries, then activate only after prerequisites are satisfied. GitHub merge does not itself prove Bolt publication.

Keep `ccx_idv_config.enabled=false` until these steps are completed. Preserve the original one-time account-admission rules and all consent, ownership, suspension and subscription checks throughout deployment.
