# Content Connect X — Hosting Release Readiness

As of November 15, 2026. Current Supabase project: `yxuqbygykpfbioslljlf`.

**Release decision: NOT APPROVED.** The source code and database migrations are implemented, but the staging environment has zero Supabase Auth users. No genuine multi-party booking, paid transaction, signed rental agreement, automatic external feed import, or push/email delivery has passed end-to-end acceptance. The live domain is not cut over.

## Feature and implementation matrix

| Requested feature | Built and connected | External gating / test coverage |
|---|---|---|
| Weekend, seasonal, holiday, overtime rates | Host UI + SQL 15-minute rate engine and overtime quote | Prices require authenticated host/guest integration tests; holiday adjustments need published schedule |
| Advance-notice, cleaning fees, minimum duration | SQL guards and host UI | Booking race/concurrency stress test pending |
| Custom discount codes | Hashed codes, redemption counters, host UI, atomic reservation | Cancellation/expiry business policy and abuse review pending |
| Equipment and bundles | Inventory, daily/hourly caps, bundles, booking addon snapshots, condition reports | Authenticated multi-booking stock contention tests pending |
| Interactive public-area map | Pan/zoom, price pins, bounds search, general area centers, radius, straight-line comparison | Production map tile key/source, supported zoom/tile plan and provider-verified routing required |
| Calendar 2-way sync | Trusted-host iCalendar import/export, scoped revocable links, atomic conflict checks, Cron scheduling | Vault/Edge worker secrets **not configured**; live external feed onboarding and timezone testing pending |
| Cleaner accounts and job scheduling | Verified staff invitations, accepted assignments, automatic turnover checklist on completed rentals | Worker notification delivery, mobile usability and staff authenticated tests pending |
| Supplies, low-stock alerts, performance | Atomic stock movement, threshold indicators and cleaning completion metrics | Outbound replenishment emails and live reporting QA pending |
| Adult-production suitability badges | Host declarations and independent MFA-admin verification fields | Property permission checks, published moderation policy and actual independent approvals required |
| Insurance | Protected PDF/image submissions, booking host review, check-in gating | Qualified business policy, authenticity/expiry validation and practical test pending |
| Shoot packet | Authorized booking overview, permitted uses, restricted crew list and entry permissions, export | Requires signed DocuSign agreement and verified paid status before entry access |
| Booking-specific messages | Booking room creation, crew memberships, free assigned staff read/send with block enforcement | Multi-account real chat tests and abusive messaging escalation pending |
| Check-in/out, overtime | Events, role checks, backend gates and unbilled overtime quote | Real checkout, damages and payment settlement tests pending |
| Incidents | Confidential reporting and evidence storage with payout hold | Moderator resolution/appeals and evidence retention procedure pending |
| Venue-specific access | Invites, independent acceptance, host-only entry access, revocation | Cross-account permission testing pending |
| CCBill checkout | Hosted-form adapter and verification webhook | Merchant approval, correct event signatures, payout integration, chargebacks, refund API required |
| DocuSign rental agreement | JWT service account, sender, HMAC webhook, PDF/certificate private archive | Provider OAuth/keys, lawyer-approved templates, verified signers, sandbox live test required |
| Email/Web Push | Member preference screen, private outbox, generic email + WebPush worker | Email service, VAPID keys, operational worker secrets and delivery tests required |

## Security invariants

1. Accounts (including administrators) require independent 18+ verification; privileged admin actions require MFA.
2. Verified host property authority and independent listing review are necessary before public publication.
3. Private street addresses are inaccessible through public search; crew receives entry details only after authorization, a signed rental agreement and a captured payment.
4. Pricing, reservations and equipment locks are calculated in SQL under transactional constraints. Browser totals cannot be trusted.
5. Cancellation/refunds/claims produce records and estimates; money moves only after provider-confirmed events. Do not mark a payout "paid" based on a button click.
6. Real releases and certificates are archived only after verified DocuSign callbacks. No browser-generated consent/signature counts as legal evidence.
7. Unsupported external iCalendar events stop a sync; they do not erase the last good blocks. URLs use allowlisted HTTPS providers with redirects disabled.
8. Geo pins represent approved public areas, not exact addresses or private GPS. Straight-line distance is never labeled as drive time.
9. Media, incident photos, identity documents and medical information are kept private and excluded from generic email/push previews.

## Required environment and provider configuration

Configure server secrets in Supabase only, never `VITE_*`:

- DocuSign: `DOCUSIGN_ADULT_BUSINESS_APPROVED=true`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_CONNECT_HMAC_SECRET`, `DOCUSIGN_LOCATION_TEMPLATE_ID`; approve the template through the admin-reviewed `approved_agreement_templates` table and complete live/sandbox signer tests.
- CCBill: `CCBILL_HOSTING_APPROVED=true`, `CCBILL_DYNAMIC_PRICING_APPROVED=true`, `CCBILL_FLEXFORM_LIVE_APPROVED=true`, `CCBILL_CLIENT_ACCNUM`, `CCBILL_CLIENT_SUBACC`, `CCBILL_FLEX_ID`, `CCBILL_SALT`, `CCBILL_BOOKING_PERIOD_DAYS`. **Confirm that the merchant account, actual purchase-notification payload contract, charge/refund lifecycle and third-party payouts are approved and verified before enabling.**
- Hosting calendar worker: same high-entropy secret in Supabase Edge `HOSTING_CALENDAR_JOB_SECRET` and Vault `ccx_hosting_calendar_job_secret`. Without both, Cron job is inert.
- Hosting notification worker: same high-entropy secret in Edge `HOSTING_NOTIFIER_JOB_SECRET` and Vault `ccx_hosting_notification_job_secret`. Email endpoint uses `HOSTING_EMAIL_PROVIDER_ENABLED`, `HOSTING_EMAIL_API_URL`, `HOSTING_EMAIL_API_TOKEN`, `HOSTING_EMAIL_FROM`; push uses `HOSTING_PUSH_PROVIDER_ENABLED` and `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`.
- Browser map tiles: `VITE_HOSTING_MAP_TILE_URL` is a PUBLIC tile template (must include `{z}`, `{x}`, `{y}`). Use a commercial/approved tile provider and respect attribution. Routing requires server-only `HOSTING_ROUTING_APPROVED=true`, `HOSTING_ROUTING_OSRM_URL` and actual service approval. Do not call a free public demo routing service at commercial scale.

Never record the actual secret values in GitHub or CI logs.

## QA commands

```bash
npm ci
npm run lint
npm run typecheck
npm run test:hosting
npm run build
npm run smoke:supabase
```

An opt-in **read-only** multi-account suite is included but cannot run without real test users:

```bash
CCX_E2E_SUPABASE_URL=https://<PROJECT_ID>.supabase.co \
CCX_E2E_PUBLISHABLE_KEY=<PUBLIC_KEY> \
CCX_E2E_HOST_EMAIL=<EMAIL> CCX_E2E_HOST_PASSWORD=<PASSWORD> \
CCX_E2E_GUEST_EMAIL=<EMAIL> CCX_E2E_GUEST_PASSWORD=<PASSWORD> \
npm run test:hosting:e2e
```

Never use production member passwords for tests or commit test credentials. Then execute actual live scenario tests: independent admin with MFA; host verify/approve; guest booking with competing reservations; two users requesting last equipment; promotion exhaustion; editor trying to expose private address; booking insurance; agent/cleaner invites; blocking and consent withdrawal; signing with archived DocuSign evidence; payment capture/refund/payout with processor confirmation; calendar conflicts; notification retries; mobile responsive and accessibility; account suspension.

## Advisory note

Supabase security advisors currently report **pg_net extension installed in public**. This extension is nonrelocatable in the present project. It should be addressed in a controlled database maintenance plan, not by destructive `DROP EXTENSION ... CASCADE` while jobs depend on it. Verify any change with Supabase security advisors.

## Release gate

Do not enable production merchant captures, release real address data to untested staff, publish adult content or change production DNS until verified test accounts, specialist professional review, and partner sandbox acceptance tests are complete.

Implementation files include migrations `036`–`042`, Edge Functions `hosting-advanced`, `hosting-production`, `hosting-calendar`, plus existing `hosting-marketplace`, `hosting-operations`, `hosting-docusign`, `hosting-ccbill`, notification worker, and the `Hosting*Manager.jsx` React modules.
