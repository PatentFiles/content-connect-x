# Self-hosted identity verification evaluation

Status: **isolated evaluation foundation, not a live Yoti replacement**. No frontend, Edge Function, production database, `age_verification_requests` approval, or `member_admissions` change is included. Nothing imports this code into the application. Do not switch live signup to this module.

## Candidate and source revision

The candidate is [Idswyft Community](https://github.com/team-idswyft/idswyft-community), an MIT-licensed application offering document OCR, barcode/MRZ cross-checks, face matching and liveness. This is a closest-feature-fit recommendation for evaluation, not an accuracy/security certification or a verified worldwide best product.

Reviewed upstream revision: `3c6f17f1aba84bc980dc759f6be42f69b576f439` (sync from v1.12.39). Source contracts reviewed: `backend/src/routes/newVerification.ts` and `backend/src/verification/statusReader.ts`. The source accepts `selfie`, not `image`, for the live-capture multipart field. Document uploads also receive document type and issuing country.

MIT covers the repository's code. It does not automatically clear every third-party model, training dataset, trademark or downloaded binary. Before commercial processing, inventory model checksums and licenses. The upstream downloader references an optional deepfake detector under a different/private repository: verify access, licensing and the actual missing-model behavior. Do not describe unavailable deepfake protection as active. Do not use age/gender/emotion prediction as proof of legal age; this adapter uses document DOB for a screening calculation.

## Implemented

- `idswyft.mjs`: server-only HTTPS client; explicit self-hosted origin; bounded responses; timeout; no redirects with credentials; idempotency keys; full-flow initialization; document/selfie uploads; session-bound status checks; calendar-based age screening. Every summary sets `admission_granted: false` and `age_verified: false` even if the upstream result says verified.
- `evidence.mjs`: synthetic-fixture staging helper; verifies bucket privacy; stores ID front/back and selfie as applicable; writes file hashes, session IDs, engine revision and a minimal manifest/index. It deliberately does not copy extracted names, DOB, ID numbers, embeddings or arbitrary provider output into the index. The ID IMAGE still contains sensitive information.
- `idswyft.test.mjs`: 27 offline tests using mocked HTTP and storage. No actual OCR, face recognition, liveness detection or real-document processing was run.

## Run tests

From the repository root, with Node 22 or newer:

```sh
node --test server/self-hosted-idv/idswyft.test.mjs
```

No added npm dependency or package installation is needed for these tests. Tested locally with Node v22.16.0. Use a maintained patched runtime for deployment; this is a test-runtime report, not a recommendation to deploy that specific patch version.

## Staging integration shape

Content Connect keeps Supabase Auth, its existing database and evidence storage. A separately hosted Idswyft container stack performs inference. Its default deployment also has its own operational database; do not apply its upstream schema to Content Connect's production Supabase project or replace the application's Auth system.

The caller must be a trusted server, authenticate and authorize the operator, bind subject UUID to verification session in a server-owned row, and obtain the evaluation date from a trusted clock. Never accept `subjectId`, a provider URL, a key, a passed flag or the date directly from an untrusted browser. A boolean `fixtureOnly` is an operator assertion, not an image classifier.

Example after a self-hosted HTTPS engine is provisioned and validated:

```js
import { IdswyftClient } from './server/self-hosted-idv/idswyft.mjs';
const verifier = new IdswyftClient({
  baseUrl: process.env.CCX_IDV_BASE_URL,
  apiKey: process.env.CCX_IDV_API_KEY,
});
// Use a server-owned synthetic fixture subject, and a durable per-operation UUID
// reused for retries of the SAME operation. Distinct operations need distinct keys.
const session = await verifier.initialize({
  subjectId: fixtureSubjectId,
  documentType: 'drivers_license',
  issuingCountry: 'US',
  idempotencyKey: initializeOperationId,
});
// Upload front, back and actual capture evidence through verifier.upload().
// Run summarizeEvaluation() on a server-fetched verifier.status() response.
// A positive screening result STILL DOES NOT authorize admission.
```

Use only synthetic fixtures at this stage. `sandbox: false` requests real processing of synthetic fixtures, not a mocked-success sandbox. Upstream API-key settings can still impose sandbox mode; summaries reject sandbox or unknown mode.

## Private staging storage setup (not executed)

Use a separate Supabase staging project and the already locked server-side Supabase SDK. Never put a secret/service-role key into `VITE_` variables. Create the bucket via the Storage API on that staging client:

```js
const { error } = await stagingAdmin.storage.createBucket('idv-evidence-staging', {
  public: false,
  fileSizeLimit: 8 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/json'],
});
if (error) throw new Error('Staging bucket creation failed; inspect the existing configuration');
```

Schema proposal, deliberately NOT an automatically applied migration:

```sql
begin;
create table public.idv_evaluation_runs (
  id uuid primary key,
  subject_user_id uuid not null,
  provider_session_id uuid not null,
  engine_revision text not null check (engine_revision ~ '^[a-fA-F0-9]{40}$'),
  manifest_path text not null unique,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_paths text[] not null,
  upstream_result text not null check (upstream_result in ('verified','failed','manual_review','pending_or_unknown')),
  screening_checks_passed boolean not null,
  admission_granted boolean not null default false check (admission_granted = false),
  fixture_only boolean not null default true check (fixture_only = true),
  created_at timestamptz not null default now()
);
alter table public.idv_evaluation_runs enable row level security;
revoke all on public.idv_evaluation_runs from public, anon, authenticated;
grant select, insert, delete on public.idv_evaluation_runs to service_role;
commit;
```

No browser table/storage policies should permit access to this staging bucket. Audit existing broad `storage.objects` policies too; `public: false` does not override an overbroad authenticated-user policy. Run Supabase security advisors and actual cross-account RLS tests before any use. This SQL was NOT executed or validated against a database in this task.

The evidence helper uses `upsert: false`, but the store is NOT WORM storage. Hashes do NOT make a privileged administrator unable to alter files and corresponding hashes. A production system needs durable jobs, partial-upload reconciliation, independently protected audit signing/anchoring, controlled evidence access and tested backups. A network failure after a committed index insert can produce an uncertain state; do not blindly retry the staging helper.

## Existing Content Connect behavior

The uploaded April 2026 developer README describes Base44 and manual review. The connected repository uses React/Vite and Supabase. Its current `admin-age-review/index.ts` explicitly returns HTTP 410 for manual approvals and states that only verified Yoti results complete new signup. Older repository README passages describing a manual fallback conflict with that handler. This evaluation changes neither policy nor handler.

Before switching providers, implement a provider-neutral, server-owned admission decision and update the canonical documentation and tests together. Never directly mark a browser profile verified, overwrite existing Yoti evidence or create admissions merely because files were uploaded.

## Required before live rollout

1. Independently validate the exact pinned engine/model configuration on permitted document types/countries, camera conditions and demographics; include forged DOB, stolen ID, replay, printed photo, screen, face-swap/deepfake and camera-injection attacks. Measure false accepts/rejects, not only happy-path accuracy. Test missing models and outages fail closed.
2. Complete browser camera/capture integration, challenge binding/freshness, secure upload sessions, throttling, durable queue/retries, server-owned subject binding and a qualified-review appeal path. A static selfie alone is not liveness proof.
3. Resolve licensing and upstream operational dependencies. Disable outbound cloud OCR/LLM, optional AML, voice, email and other integrations unless intentionally approved; confirm network egress with a test, not only a README claim. Pin containers and model digests, not moving `latest` tags.
4. Obtain a jurisdiction-appropriate biometric notice/consent and retention/deletion policy. Separate membership age checks, creator identity checks and any legally required performer-production records. This evaluation has no consent, deletion scheduler, legal-hold process, reviewer UI or authenticated export endpoint.
5. Build the provider-neutral admission path and transactional audit decision; update the signup UI, server gate and current developer README; run multi-user acceptance and security tests on staging. Preserve access blocking on failure. Only then replace the Yoti entry point.

## Evidence and legal scope

Store private evidence separately from public profiles. A production evidence manifest should include purpose, notice/consent version, decision, method, model/configuration hashes, challenge evidence digest, reviewer identity where applicable, timestamps and a policy-derived deletion date. Keep biometric templates out of routine application logs; delete them when their authorized purpose ends. Do not set an indefinite default retention period just because storage is cheap.

Where applicable, US performer recordkeeping under 28 CFR Part 75 involves more than a membership ID/selfie pair, including legal name/DOB, aliases, production links, segregated records and a custodian. Some visitor age-verification laws prohibit retention of identifying information. Counsel must resolve applicability to Content Connect's actual roles and jurisdictions before real collection; the software itself cannot certify compliance.

Primary sources reviewed 2026-11-18:
- https://github.com/team-idswyft/idswyft-community
- https://github.com/team-idswyft/idswyft-community/blob/main/LICENSE
- https://github.com/team-idswyft/idswyft-community/blob/main/engine/download-models.js
- https://github.com/serengil/deepface#licence
- https://github.com/deepinsight/insightface#license
- https://supabase.com/docs/guides/functions/limits
- https://supabase.com/docs/guides/storage/security/access-control
- https://www.ecfr.gov/current/title-28/chapter-I/part-75
- https://www.ilga.gov/documents/legislation/ilcs/documents/074000140K15.htm
- https://statutes.capitol.texas.gov/GetStatute.aspx?Code=CP&Value=129B.002
