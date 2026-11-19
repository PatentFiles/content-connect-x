# Provider and safety activation runbook — Content Connect X / Host Connect

Status: **implementation prerequisites**, not merchant approval, certification or a guarantee that adding one key makes the integration live. Website hosting stays in **Bolt**. Private compute stays in **Railway**. Source code and authorization stay in **Supabase/GitHub**.

## Acceptance gates for every provider

| Gate | Minimum evidence |
|---|---|
| Business use accepted | Written confirmation that the proposed professional marketplace and host marketplace are permitted |
| Environment separation | Sandbox/test merchant credentials separate from production secrets and accounts |
| Secrets | Server-only provider keys, callback secrets, scoped roles; no browser-exposed secret |
| Origin and redirect | Approved allowed callback hosts, explicit return domain, no wildcard redirect acceptance |
| Signing or payment initiation | Authenticated, owner/resource-bound, server-generated request |
| Webhook verification | Actual provider signature/HMAC validation; reject missing signature, replay and mismatched account |
| Reconciliation | Duplicate/out-of-order delivery, retry and cancellation/voiding state are idempotent |
| Data protection | Minimal personal data, provider retention, purpose-specific consent and deletion/hold |
| Accessibility | Mobile browser and keyboard, failure and timeout, clear recoverability |
| Operations | Owner, monitoring, retry/dead-letter, support/refund paths, escalation and runbook |
| Real acceptance | Approved provider sandbox transactions AND a guarded live acceptance where permitted |
| Activation | A reviewed admin/config switch only after all above checks are true |

Do not enable a feature because a credential is present. Fail closed with useful messaging when unavailable.

## CCBill membership

Existing source: `supabase/functions/membership-billing/`, `membership-ccbill-webhook/`, `hosting-ccbill/`, `hosting-ccbill-webhook/`. Separate membership entitlements from property charges. Live CCBill subaccount/form and event format require merchant verification. Existing webhook and relay code must match the selected signed server callback contract.

Merchant to provide (server-managed): approved client/subaccount configuration, FlexForms or approved equivalent, event/notification relay secret and validated callback configuration. The hosting webhook expects config such as `CCBILL_CLIENT_ACCNUM`, `CCBILL_CLIENT_SUBACC`, `CCBILL_EVENT_TIMEZONE`, `CCBILL_WEBHOOK_RELAY_SECRET` where applicable. Do not copy these into Bolt or GitHub.

Required tests: initial sale, renewal, declined charge, failed rebill, cancellation, expiration, refund, dispute/chargeback, duplicate/out-of-order notifications, account mismatch, signature failure, ledger reconciliation and entitlement revocation. Product price must be server-owned; a successful frontend redirect alone must not activate Premium. Property-booking capture, host transfers and funds flow are separately gated; do not claim escrow.

## DocuSign signing

Source: `supabase/functions/hosting-docusign/`, `hosting-docusign-webhook/`, `agreement-packets/`. Location signing and creator collaboration signing are distinct integrations. Hosting code references `DOCUSIGN_LOCATION_TEMPLATE_ID`, `DOCUSIGN_ACCOUNT_ID` and `DOCUSIGN_CONNECT_HMAC_SECRET` for the applicable flows.

To enable collaboration signing: use an approved account/integration key, consent-reviewed templates and verified recipient identity, send an envelope server-side with immutable contract-version binding, retrieve completed PDFs and provider certificate, and reject forged/replayed/out-of-order webhook status. The private agreement archive must never treat JSON draft creation as a signature.

Embedded signing URLs are short-lived; generate them only for the currently authorized signer. After live go-live, recreate/test relevant Connect webhook configuration in the production DocuSign environment.

## Self-hosted identity / Yoti fallback

Public production self-hosted ID verification is currently disabled pending genuine-document tests, security/privacy approval, policy and retention setup. The diagnostic pilot is separate and must never grant account admission. Do not treat a private test pass as proof of real-world fraud resistance.

The server must evaluate OCR/barcode or MRZ agreement, expiration, DOB, legal-name consistency, matched live face, liveness and evidence integrity. Any failed/inconclusive gate returns clear recovery/review, never automatic bypass. Retain only legitimate evidence under reviewed schedules and legal holds. Verify the provider's model licences before commercial deployment.

## Safety intake operator activation

Source: `supabase/functions/trust-intake/`, `src/supabase/TrustSite.jsx`, `ccx_trust_settings`. A public anonymous report endpoint can be deployed **without** activating submissions. The live switch must remain false until:

1. Legal operator identity, public monitored contact, privacy/retention and report-removal rules are approved.
2. Qualified human reviewer coverage and emergency/urgent-case escalation are established with named staff and backups.
3. Proper identity/rights handling, acknowledgement, reporter updates, appeals and scope-limited preservation are implemented.
4. Any applicable removal deadline, priority and mandatory reporting procedures are documented and tested.
5. Staff access is MFA-gated and all case reads/actions logged; external agencies have no unrestricted data access.
6. The complete report creation → receipt → reviewer triage → actual action → reporter notice → appeal path passes real acceptance tests.

When off, **show the supported contact channel** and do not tell a reporter their submission was received. Never turn on the intake solely to make the frontend appear functional.

## Calls and notifications

Voice/video are not implemented. Before choosing a calling service, verify data region, retention, accessibility, role-based room tokens, block/report integration and recording-off default. Video room/recipient tokens come from an authenticated server endpoint only. Recording requires separate explicit, applicable consent.

Push/email delivery requires sender and VAPID/provider configuration, delivery acknowledgement, retries, dead-letter handling and real-device acceptance. A database notification is not proof it reached a member.

## Advertising and country availability

Approved sponsorships only; no orientation, health, ID, contract or private-message-based ad targeting. Affiliate account connection and partner approval are separate from ad-placement code; no external account or payout is active by adding a logo or placeholder.

Supported countries must be explicitly permitted for identity, payment, property services and applicable legal requirements. Country restrictions must be server-enforced; a filtered dropdown alone is not a control.

## Release order

1. Merge matching source, schema and regression tests.
2. Apply migration to an isolated fixture, then tracked live migration only after impact review.
3. Deploy private Edge Functions with the appropriate JWT/authorization setting.
4. Execute negative authorization and provider-integration tests.
5. Keep production feature flags disabled until external approval and real acceptance.
6. Publish frontend from Bolt only after server revisions are verified.
7. Record exact versions, responsible operator, incidents/rollback paths, and signed-off provider readiness in the canonical README/operations log.

This is a checklist. The lack of provider keys, licenses or staffing cannot be simulated as operational success.
