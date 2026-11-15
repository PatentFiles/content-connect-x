# Content Connect X — hands-on acceptance matrix

This is a **real testing plan**, not an assertion of completed tests. It covers the November 2026 Supabase application and hosting marketplace. Current launch status remains **NO-GO** until independently verified evidence exists for each mandatory gate.

## Before opening the app

1. Test a **dedicated staging frontend and Supabase backend**, not production member data. Record the GitHub commit SHA and staging URL. Never put passwords, tokens, ID scans, STI results or customer information in GitHub issues or screenshots.
2. Provision actual, distinct test operators: an independently age-verified AAL2 administrator; two separately verified adult creator accounts; a host, guest and invited cleaner. Use approved procedures and consent. Do not fake age approval or self-approve an administrator.
3. Use a real HTTPS staging domain in Supabase Auth allowed redirects. Confirm authentication emails, login and logout before testing advanced features.
4. Keep all merchant capture, payout, media-publication, formal signing and precise-address release flags **off** until the related provider agreements and sandbox tests are completed.
5. Run the [enterprise release controls](ENTERPRISE_RELEASE_RUNBOOK.md) and record an evidence link/owner for each case.

## Browser acceptance: first pass

| Workflow | Expected result | Gate |
|---|---|---|
| New user registration, confirmation, login, logout, recovery | Recovery link delivered; session validated by Supabase; new password works, old one fails; no accidental verification/paid status | P0 |
| Creator directory filters and free-tier pagination | City/country/role/name filters return only independently verified, unrestricted profiles; free preview cannot page past 12 | P0 |
| Unverified account uses Search, Messages or booking | Protected operations denied by the backend | P0 |
| Verified free account requests paid booking/chat feature | Denied unless explicitly included in free tier | P0 |
| Independently verified premium accounts connect and message | Own messages visible to permitted members only | P0 |
| Block/suspend one account while signed in on another device | Sensitive reads/writes denied even with stale JWT | P0 |
| Admin with AAL1 visits integration settings | Rejected until authenticator AAL2 challenge | P0 |
| Non-admin obtains protected URL directly | Backend returns 403; navigation visibility alone is insufficient | P0 |
| Collaboration request, negotiated scope, participant roles, and withdrawal | Explicit consent recorded; withdrawal remains possible after cancellation or lapse | P0 |
| Host submits property + images for review | No public listing or exact-address leak before independent moderation | P0 |
| Host sets weekend, seasonal, holiday, overtime, notice and discount | Server-calculated quote matches 15-minute increment policy | P0 |
| Two guests race to book same time/room or last piece of equipment | Exactly one successful reservation; no oversold capacity | P0 |
| Cleaner invite/acceptance and checklists | Only assigned staff access permitted job details | P0 |
| Calendar import, conflicting feed, cancellation and timezone/DST | Last good blocks retained; no silent double booking | P0 |
| DocuSign multi-signer sandbox envelope | Verified callback, completed PDF and certificate archived and read restricted | P0 |
| Approved CCBill sandbox checkout/capture/refund/payout | Signed callback and independent settlement reconciled; no browser-confirmed payment | P0 |
| Refund, chargeback, claim, cancellation, overdue overtime | State matches provider-confirmed money and rules | P0 |
| External email and opt-in push | Arrives once; respects opt-outs; no protected details in previews | P1 |
| Mobile viewport: login, dashboard, messages, calendar, bookings | No clipping, inaccessible controls or layout overflow | P1 |
| Restore backup, recover worker retries and rollback web release | Time-bounded restoration with evidence and operator signoff | P0 |

## Required CLI verification

From the reviewed code checkout:

~~~bash
npm ci
npm run lint
npm run typecheck
npm run test:hosting
npm run test:integrations
npm run test:readiness
npm run verify:release
npm run verify:frontend-contract
npm audit --audit-level=high
npm run build
npm run smoke:supabase
~~~

The GitHub quality gate already runs these **local** checks. For two independently age-verified staging members, run the opt-in **read-only** test:

~~~bash
CCX_E2E_SUPABASE_URL=https://STAGING_PROJECT.supabase.co \
CCX_E2E_PUBLISHABLE_KEY=STAGING_PUBLISHABLE_KEY \
CCX_E2E_HOST_EMAIL=HOST_EMAIL CCX_E2E_HOST_PASSWORD=HOST_PASSWORD \
CCX_E2E_GUEST_EMAIL=GUEST_EMAIL CCX_E2E_GUEST_PASSWORD=GUEST_PASSWORD \
npm run test:hosting:e2e
~~~

For booking/write/payment tests, use an approved **separate staging account and sandbox**, capture the actual transaction and authorization results, and clean up fixture data. No read-only smoke test or green CI should be represented as a successful payment or signed agreement.

## External activation checklist

- **Yoti:** API token + SDK ID in Vault, two approved HTTPS brand origins, provider sessions verified server-to-server. This does not itself establish performer identity.
- **DocuSign:** approved templates, keys, JWT consent, independent signer checks, Connect HMAC, private completed-document evidence.
- **CCBill:** approved merchant scope, signed event contract, simulated capture/refund/chargeback and actual settlement reconciliation.
- **iCalendar:** trusted providers, worker/Vault matching secrets, opt-in feed import, revocable export, timezone and conflict tests.
- **Email/push:** approved delivery provider, worker secrets, VAPID keys, opt-out and retry validation.
- **Map/routing:** approved public tile source and attribution; server routing. Never show private exact coordinates.
- **Moderation:** worker for images and video, independent human approval, takedown and retention process.
- **Sentry:** configure the DSN and confirm that errors are redacted before delivery.
- **Safety and recordkeeping:** human-reviewed policies, relevant legal and insurance requirements, protected consent/dispute evidence.

If the production URL does not point to the freshly reviewed Git SHA, the browser cannot be used to validate that commit. Check the deployment's release SHA first.

## Failure recording

For each failed case, record only: non-sensitive test IDs, the release SHA, browser/platform, a concise reproduction, expected versus observed result and redacted logs. Do not publish account emails, credentials, ID documents, sexual-health records, exact addresses or signed private agreements.
