# Content Connect X — PASS testing and work-clearance integration

## Current status (2026-11-17)
The Testing screen implements private PDF/JPEG/PNG/WebP submission (10 MB maximum),
private Supabase Storage, staff-only MFA review, independent provider confirmation,
14-day clearance expiry, and performer-controlled, per-collaboration binary sharing.
A PDF **never** establishes verified clearance on its own.

The admin **API & integration settings** panel stores the `pass_partner_token`
in Supabase Vault through the protected `ccx-integrations` Edge Function.
It does not expose stored secrets to the browser.

**Automatic PASS status retrieval and live production-hold monitoring are NOT
implemented or approved yet.** We found an official PASS site and database, but
no public developer specification that permits us to implement the authentication,
request path, callback signature or response schema without guessing.

Official sources:
- https://www.passcertified.org/pass-database
- https://www.passcertified.org/pass-database/faq
- https://www.passcertified.org/testing-partners
- https://app.passcertified.org/
- Integration contact: info@passcertified.org

## What to request from PASS

Ask for a **producer/platform partner read-only integration** specification:
1. Eligibility, contract and data-sharing approval for Content Connect X.
2. Production/sandbox API base URL, authentication, token renewal and scopes.
3. Performer identity mapping: explicit opt-in/consent, revocation and re-linking.
4. Binary (yes/no) availability status, sample collection and expiration semantics.
5. Production-hold signal/status, event or polling API, outage/fail-closed policy.
6. Signed callbacks/webhook scheme, replay protection, event IDs and timestamps.
7. Sandbox performer fixtures, rate limits, errors and support escalation.
8. Data minimization/retention requirements; **no STI panel or lab diagnosis**.

## Activate only after verified partner onboarding

- Administrator completes MFA and independent age verification.
- Enter partner-issued credentials in **Settings → Platform Control Center → APIs & provider keys → PASS**.
- Keep the PASS integration disabled until the documented backend connector is
  written and contract-tested. Merely entering a key must never mark it live.
- Connect only the exact approved hostname(s), with fixed paths and strict
  response validation. Never accept arbitrary user-supplied API URLs.
- Receive only binary status and necessary expiry metadata; avoid lab records.
- Require performer opt-in and use the existing collaboration-sharing consent gate.
- Check live production-hold status separately and fail closed on outage/unknown.
- Verify negative/expired/revoked and production-hold test fixtures, webhook
  authenticity, idempotency, audit logs and staff authorization.
- Only then enable the integration and update the readiness copy.

## Testing on desktop after pulling GitHub

Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run test:modules`, and `node --test tests/mobile-form-keyboards.test.mjs`.
Run Supabase migrations (including `054_complete_modular_feature_catalog`
and `055_reconcile_private_clearance_history`) against staging before testing
PDF uploads. Use the real Supabase project Edge Functions, Storage and RLS;
a GitHub commit by itself does not deploy SQL or Edge Functions.

Do not test with actual performer health reports in nonproduction environments.
Use synthetic documents and verify the storage bucket remains private.
