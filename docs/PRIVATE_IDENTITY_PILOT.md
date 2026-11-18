# Private own-ID testing — November 18, 2026

## Scope and hosting

The user authorized testing with their own ID and face. The implementation is an explicit, seven-day **administrator-only pilot**, not public signup activation. Bolt remains the website host. Existing Supabase project `yxuqbygykpfbioslljlf` remains the account/evidence authority. Only verification computation and the bounded retention job run in the separate Railway **Content Connect X - Identity** project. Unrelated Railway projects and website domains were not changed.

The pilot is enabled until **2026-11-25 22:59:05 UTC**. It also requires a successful cleanup heartbeat within 45 minutes and a completed storage probe. `public.ccx_idv_config.enabled` remains false. No privacy/security certification timestamps were fabricated and no production admission was added.

## Access from Bolt

After this branch is merged into `main`, synchronize the existing Bolt project and publish its updated frontend through Bolt. GitHub merge does not itself prove Bolt publication.

Sign in to the existing, confirmed-email, admitted administrator account. Open the administrator **Platform Controls** console and select **Test my ID**. The server independently checks the administrator role from `account_security` and existing `member_admissions`; a browser flag or user metadata cannot unlock this endpoint. No new administrator was created for testing.

Enter the full legal name on your own document, select a US document type, and accept the private-test notice. Upload JPEG or PNG images (8 MB maximum each): front and back for a driver's license or national ID, or the photo page for a passport. Allow camera access and follow the two head-turn prompts. A saved face photo alone does not satisfy this liveness test. Open the published HTTPS page or a top-level preview tab when the embedded editor restricts camera access.

The screen shows document fields, legal-name and birthday-rule results, ID-to-camera face matching, frame identity consistency, and the live challenge outcome. Failed/unclear checks stay failed; there is no test override that creates approval. A successful test does **not** modify membership, overwrite the private account name, or change the public stage/display name. This is how an already-admitted administrator can exercise verification without faking a new signup approval.

## Evidence and deletion

Pilot evidence is in private bucket `ccx-identity-pilot-evidence`, with isolated `ccx_idv_pilot_*` records. Browser table and Storage access are denied. The worker receives short-lived, one-use job capabilities and signed URLs rather than a standing Supabase service-role key. Processing is bound to a session, engine revision, and evidence hashes.

Test evidence is scheduled for deletion after 24 hours. **Delete my test evidence** requests early deletion without deleting the account. Cleanup deliberately waits at least ten minutes after an upload reservation so a late in-flight upload cannot recreate an orphaned file. The job runs every 15 minutes, deletes blobs before removing ledger entries, and minimizes the session after all its evidence is gone. Operational failures can delay deletion; new test collection pauses when the cleanup heartbeat becomes stale. Do not describe the schedule as a guaranteed instantaneous deletion or a production legal retention policy.

The old Supabase pg_net job remains paused. Its queue-based credential transport was not re-enabled. Railway's `ccx-identity-retention` service uses a scoped maintenance token in its private environment, not the Supabase service key. The previous maintenance token was rotated. Logs include only check outcomes/counts, never the token, raw ID, name, DOB, OCR text, signed evidence URL, or face embeddings.

## Verified live checks

At **2026-11-18 22:57 UTC**, the actual retention service completed production and pilot cleanup calls, removed 11 abandoned synthetic probe-ledger entries, and passed the private Storage probe. The probe uploaded a one-pixel PNG, downloaded identical bytes, verified that the public endpoint denied access, deleted the object, and verified its absence with a successful authenticated listing. It is not an ID or a facial image. Anonymous status/maintenance requests were denied. The deployed identity worker reported its OCR startup test passed and supports `pilot` mode.

The first probe implementation incorrectly relied on the SDK's missing-object error shape. The repair requires successful before/after listings: a network failure, list error, failed deletion, or still-visible object cannot be recorded as success. Regression coverage is in `tests/identity-pilot-storage.test.mjs`.

The pilot Edge Function was deployed as version 2 from handler commit `1e21f148f88629be0a87e1b4869bd8e815c5ed71`. Worker source is pinned at `6a60b3a953a167402cd41d9839c3f17910f26b56`; its unchanged engine revision is `3c6f17f1aba84bc980dc759f6be42f69b576f439`. Compare relevant source paths before rolling either component forward.

## What is not established by these checks

No real ID or biometric image was supplied in this chat, and no end-to-end real-person verification has been claimed. Real document recognition, face/liveness accuracy, fairness, anti-replay performance, qualified appeal resolution, and purpose-specific production privacy/retention approval remain separate release work. Do not enable public admission merely because the private test or CI is green. The pilot runs actual models and reports the result; it does not certify authenticity or turn heuristic checks into independent certification.

## Operational recovery

If the test is unavailable, inspect pilot configuration expiry/heartbeat, the private retention service's execution logs, and worker health without exposing secrets. Do not work around a failed cleanup by manually refreshing its timestamp. Renew pilot access only for an authorized testing period. Stop collection by setting the pilot's own `enabled=false`; preserve cleanup. Never change the ordinary production admission gate to make a pilot pass.
