# Identity review and real-world acceptance — operator runbook

**Content Connect X / Host Connect · November 19, 2026**
**Release status:** code behind disabled production identity verification; **not** approved for real user admission.
**Systems:** Bolt frontend, Supabase identity/consent/audit/Storage, Railway identity processing. No website migration.

## 1. Threat model and staff authorization

The verifier alone decides whether every required document, age, face-match and liveness check is confident. A human review does **not** translate an inconclusive decision into approval. It can recommend a new consented attempt, record insufficient evidence, or refer the case to an appropriately qualified specialist.

The private identity-review queue is distinct from routine admin access:
- An administrator must have an active, admitted, unsuspended account **and fresh MFA AAL2** via Supabase Auth. A session downgraded to AAL1 has no queue, claims or evidence-link access.
- The reviewer claims a review case before seeing evidence. Only the case's assigned reviewer can inspect it or close it; simultaneous claim attempts do not supersede the first reviewer.
- Reviewers cannot inspect their own case. A review requester cannot turn an account into an eligible adult or change a worker verdict, even when they are also an administrator.
- Every queue view, claim, release, disposition and evidence-access authorization is logged to the append-only review history. A brief purpose statement is also required to issue a two-minute private Storage URL.
- Approved and underage attempts cannot be reset by case actions. Staff have no `approve`, `override_age`, `sign_contract`, or `unlock_account` action on this review endpoint.

The platform must obtain independent, qualified staff coverage, incident escalation paths, contact monitoring and documented privacy review **before** it announces guaranteed review or enables self-hosted production admission.

## 2. Case workflow

1. A signed-in member submits an available **Request review** action from an uncertain age/ID result. This creates a queued case idempotently, not an approval.
2. An MFA-authenticated qualified reviewer enters the identity evidence queue, claims the case, records the specific purpose, and inspects only necessary evidence.
3. The reviewer records a **non-admitting** disposition: `fresh_capture_required`, `insufficient_evidence`, or `specialist_followup`. A case may be released before it is closed.
4. The member can check the progress of **their own** case. The result does not expose reviewer identity, internal evidence URLs or private notes.
5. If evidence is ambiguous or the model is wrong, require a fresh correctly bound verification and independent decision. Do not record fraud from OCR uncertainty.
6. Escalate legal holds and retention changes through the controlled incident process. A case closure alone must not cancel an existing legal hold or trigger deletion.

## 3. Real-ID acceptance matrix — NOT completed by synthetic CI

Collect only consenting adult testers and officially supported document types. Test physical devices across camera permission, low light and glare conditions; use a controlled encrypted evidence store and a separate log of redacted outcomes. Do not upload real ID photos, OCR output, face images, or document numbers into GitHub, chat, or public issue comments.

| Scenario | Required result |
|---|---|
| Genuine valid adult ID + matched live face + calibrated independent checks | Accurate eligible result with server-owned admission only after all checks pass |
| Front OCR misreads name, DOB, number, or expiry | Review/retake; never silent approval or false fraud finding |
| Back barcode or passport MRZ contradicts printed data | Inconclusive or reject; no user-editable override of machine-readable data |
| Expired document or altered expiry | No automatic approval; clear correction/review guidance |
| Under 18, exactly 18th birthday, day after birthday, leap-day birthday | Verified policy dates; no premature admission |
| Wrong person's ID, face mismatch, photo/video presentation, replayed motion, challenge mismatch | Fail closed with no account admission |
| Interrupted worker, tampered hash, stale upload revision, duplicate submit | No false success; retry/rate limit/forensic event |
| Reviewers with no MFA, reviewer conflict, own session, expired file link | Access denied and logged; no private evidence exposed |
| Evidence retention expired, active legal hold, missing permission | Purge or preservation according to approved policy, not best-effort implicit outcome |

For each test record **only**: case/test ID (not raw identity), supported document family, device/browser, worker and model versions, expectations, observed decision, confidence/reference thresholds, verified human assessor, audit evidence location (private), pass/fail, remediation owner and date. Maintain a tamper-evident signoff record in private operations storage.

## 4. Release gate

Do not set `ccx_idv_config.enabled=true` merely because tests, an Edge Function or private pilot exist. Before activation require: signed-off privacy/consent/retention schedules, calibrated actual-document & anti-presentation study, model licensing, qualifying reviewer coverage, documented errors and false positives, measured accessibility across mobile browsers, worker outage fail-closed drills, backup/deletion/legal hold checks, acceptance signoff and a reversible deployment plan.

CI fixture success is not a real ID/liveness acceptance claim. Pending external requirements remain tracked in [issue #26](https://github.com/PatentFiles/content-connect-x/issues/26).

## 5. Deployment and rollback

- Apply the reviewed SQL migration in a disposable database first. Confirm role grants and a failing unauthorized query.
- Deploy the matching checked-in `identity-verification` Edge Function source (`index.ts`, `handler.mjs`, `policy.mjs`) together. Do not pin an unrelated remote commit.
- Check current production verification toggle, security/privacy approval values and evidence bucket privacy **before and after** deployment.
- Test unauthenticated and AAL1 admin denial without real ID files. Confirm AAL2 queue access and case-based authorization only with controlled staff accounts.
- Reverting the Edge Function to its previously known safe version while keeping production admission disabled is the immediate rollback. Preserve case/audit tables; never drop existing events or evidence to force rollback.
- Bolt continues to host the website. GitHub merge alone does not publish Bolt. Keep public intake and provider payments behind their separate approval gates.

**Operational activation owners, monitoring, on-call coverage, qualified review decisions, and real-document acceptance have not been established by this code release.**
