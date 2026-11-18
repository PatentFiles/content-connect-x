# Provider readiness follow-up — November 18, 2026

Basis: the uploaded `Content_Connect_X_Enterprise_Audit_2026-11-17.md`, current repository and current primary CCBill/Yoti documentation. This is an implementation and validation record, not merchant/identity-provider certification.

## Closed or improved in this change

1. **Dependency findings:** `npm audit --audit-level=low` returns zero known vulnerabilities after a clean lockfile/install. The vulnerable transitive picomatch implementation is replaced everywhere by `vendor/picomatch-safe`. This is an internal MIT-licensed 4.0.7 fork, not a claim of a nonexistent upstream patched release. It rejects every unescaped repeated extglob before regex compilation; ordinary project globs remain supported. The actual attack class, transitive resolution, low-level entry points, build and regression compatibility are tested. The registry scanner does not itself audit private source; maintaining this patch and reviewing the eventual upstream fix is required. No audit exclusions, severity changes, `continue-on-error`, runtime-only audit or package-name-only cosmetic fix are used.
2. **Yoti-only onboarding:** initial name/display name/email/password, followed by one non-dismissible onboarding step. Only Doc Scan with ID authenticity and passive selfie/face match is permitted. Credentials are server-side; sessions and proof are bound to the current account; provider errors do not admit users. New manual uploads and administrator approval are retired, including the direct Storage INSERT policy. A database approval trigger enforces the provider policy. Legacy Yoti action routes proxy the same new handler rather than maintaining a weaker duplicate implementation. One-time admission and optional MFA are preserved.
3. **Paid membership code:** approved recurring USD 30-day FlexForms checkout is connected to the actual server-side role/plan catalog. Atomic event reconciliation updates membership for initial sale, renewal, cancellation, expiration, renewal failure and supported refund/chargeback events. Repeat/conflicting/late events fail safely or enter reconciliation. Cancellation retains the already-paid period. The customer's cancel/manage link opens official CCBill Consumer Support; no unsupported native API is invented. Annual billing, automatic upgrades/reactivation/custom billing-date changes and merchant-side refund initiation are not part of this implementation.
4. **CCBill callback integrity:** the previous amount-field mismatch was corrected to `subscriptionInitialPrice`, and the weak partial approval digest is no longer treated as full-event authenticity. An included, NOT YET ACCOUNT-DEPLOYED, Cloudflare Worker validates official provider source ranges then signs the complete body, query and product scope. Direct Supabase callback posts without this proof are rejected. Key names and setup are documented; no private keys or account secrets were read, displayed or guessed.
5. **Rental capture correctness:** separate callback scope, checkout/amount/actor binding and an atomic capture transaction replace partial writes. Incorrect or conflicting payment data enters reconciliation. Captured rental payout records remain held, never falsely reported as bank transfers. Unsupported refundable deposits are rejected at checkout instead of pretending a one-time sale implements escrow.

## Validation performed

- Clean dependency installation and full registry audit: zero known vulnerabilities; the remediation workflow includes build and regression tests before commit.
- 159 offline unit/policy/actual-handler fixture tests at this stage (baseline plus dependency, Yoti, CCBill and handler regression coverage).
- 18 rollback-only live database checks for metadata trust, Yoti-only approval, session binding, retry limits, authoritative membership pricing, cancellation retention, refunds and duplicate/out-of-order event isolation.
- 9 rollback-only rental database checks for participant isolation, unsigned checkout rejection, single live attempt, amount mismatch/reconciliation, atomic capture, held payouts and replay handling.
- 24 shared control layouts, 27 role/card render checks and 7 actual React Yoti browser checks passed, including narrow screens, unavailable-provider handling and sign-out. The Yoti browser uses isolated API fixtures, not a real camera session.
- Real provider sessions, physical camera capture, actual CCBill charges, real refunds, cancellation through a merchant account and external relay deployment have NOT been performed. Database fixtures are synthetic and rolled back. No provider registry enablement or financial approval flag was automatically switched on.

## Deployment components

New functions: `yoti-verification` (JWT), `membership-billing` (JWT), `membership-ccbill-webhook` (signed relay authentication).
Updated functions: `ccx-integrations` (legacy Yoti proxy), `submit-age-verification` (retired), `admin-age-review` (historical read/reject only), `hosting-ccbill`, `hosting-ccbill-webhook`.

Migrations applied:
- `20261118144428_yoti_document_selfie_only_onboarding.sql`
- `20261118144504_ccbill_recurring_membership_state_machine.sql`
- `20261118144529_ccbill_atomic_rental_checkout_and_capture.sql`

The provider-specific RPCs are SECURITY INVOKER, executable only by the service role, with explicit trusted-actor checks. New internal tables have RLS and no direct browser grants. Existing user admissions are untouched. History is not rewritten to pretend manual age approvals came from Yoti.

## Remaining items from the attached audit

| Audit item | Follow-up status |
|---|---|
| 1 — paid memberships | Core hosted checkout and callback entitlement lifecycle implemented. Merchant approval, relay deployment, keys, real cancellation/rebill/refund acceptance remain. Annual billing/upgrades/reactivation are intentionally unavailable. |
| 2 — rental money lifecycle | Atomic rental sale capture repaired. Refund initiation, third-party host transfers, refundable deposit authorisation/release, tax/accounting and complete rental adjustment reconciliation remain. Do not enable marketplace charges without appropriate processor approval and operating procedures. |
| 3 — collaboration signing | Still requires provider sending implementation, approved templates and actual signed PDF/certificate acceptance. Location signing and creator collaboration signing are distinct. |
| 4 — signup/health providers | Manual fallback removed; Yoti ID+selfie flow implemented and guarded. Yoti account enablement/real camera acceptance and PASS partnership remain external requirements. |
| 5 — notifications/jobs | Earlier infrastructure repairs retained. Sender/VAPID/cron secrets and real delivery monitoring/acceptance remain; billing relay is a separate deployment. |
| 6 — terms/privacy | Accurate, reviewed public legal/business policies still need publication. No unknown operator identity, jurisdiction or fee policy was invented. |
| 7 — dependency audit | Passing with documented internal patched build matcher. Maintain the fork and review the upstream advisory for an eventual supported release. |
| 8 — hotel/multi-night bookings | 72-hour quote ceiling/nightly semantics unchanged and still incomplete. |
| 9 — calendars | Unsupported recurrence still fails safely; full recurrence and two-way Google/Outlook OAuth are not implemented. |
| 10 — raw Matterport | Hosted link viewer works; raw source processing is not implemented. |
| 11 — screening/moderation | Provider and human-operation acceptance still outstanding; no fake approval supplied. |
| 12 — maps/market data | Broader production map/routing arrangements, geographic coverage and actual comparative inventory still outstanding. |
| 13 — cleaning marketplace | Hosts arrange their own services; a local network is not implemented. |
| 14 — authenticated acceptance | Expanded controlled tests do not replace real end-to-end customer/provider sessions. |
| 15 — reproducible schema | New migrations are recorded; historical clean replay/reconciliation remains to be demonstrated in an isolated project. |
| 16 — enterprise operations | Restore/PITR drills, load/soak tests, uptime alerts, support/incident ownership, retention/deletion and abuse-response acceptance still outstanding. |
| 17 — advisor/policy decisions | Previous leaked-password/pg_net warnings need supported remediation. Optional MFA remains the owner's deliberate policy. |
| 18 — performance | Bundle remains about 914KB / 251KB gzip. Code-splitting and real mobile performance measurement still outstanding. |

## Release decision

This follow-up closes the reported dependency gate and implements the requested Yoti/member-payment foundation, but **does not complete every feature in the original audit**. Keep new financial actions and unapproved integrations unavailable until provider-account setup and acceptance tests succeed. Merchant approval cannot be supplied by code or by setting a flag to true. The full platform is not certified enterprise-ready by this change.

References: `CCBILL_YOTI_SETUP.md`, `vendor/picomatch-safe/SECURITY-PATCH.md`, tests under `tests/*provider*` and `tests/yoti-document-flow.test.mjs`, and `scripts/check-provider-membership.sql`.
