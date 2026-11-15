# Content Connect X — Enterprise launch and release controls

**Production status: NO-GO until every blocker is independently verified.**

## Release principles

The app is one React/Vite frontend and one Supabase backend. Production contracts, ID records, intimate media, banking events and exact locations require stricter access than public profiles. Do not confuse green CI with tested transactions.

## Mandatory gates (required evidence)

| Area | Evidence required before GO |
|---|---|
| Identity and permissions | A separately age-verified admin with MFA; two verified adult accounts, plus a cleaner/coordinator account. Full role test results recorded |
| Payment | Written approved adult-industry merchant agreement; independently validated CCBill event format and sandbox transaction IDs; captures, refunds, chargebacks, merchant reserves, disputes and **actual third-party payouts** reconciled |
| Signing | DocuSign account and approved location/performer templates; independently identified signers; successful two-party sandbox envelope, HMAC callback, signed PDF and Certificate of Completion |
| Booking | Concurrent room and equipment tests; calendar conflicts; seasonal/local daylight-saving quote tests; discount redemption race tests; cancellation, no-show, overtime and damaged-equipment workflows |
| Sensitive data | Full access matrix for 18+ verification, private addresses, identity documents, clinical clearance, consent withdrawals, protected images, incidents and role revocation |
| External providers | Live email/push delivery, iCalendar sync, production map/routing, content moderation and monitoring test evidence |
| Reliability | Baseline availability SLO, recovery and replay targets, documented backups and restore rehearsal; error alerts and on-call owner |
| Commercial readiness | Approved booking and refund terms, host participation agreements, renter permission and insurance procedures, age/recordkeeping policies and retention schedule |
| Deployment | Dedicated staging environment, immutable Git SHA, reviewed database migrations, safe secrets distribution, DNS rollback and production smoke checks |
| Security | Latest CI green, dependency audit, Supabase Advisor findings triaged, API abuse/authorization tests and documented penetration-test scope |

A release manager must record the responsible reviewer, evidence location, signoff date and commit SHA for each gate. No "auto-approve" based on boolean environment flags alone.

## Progressive rollout

1. **Dev:** use synthetic fixture data without modifying real users; no real charges or content publication.
2. **Staging:** test independent verified adults, MFA admin, DocuSign sandbox, payment-processor sandbox and mail/push nonproduction routes. Apply migrations through reviewed staging pipeline.
3. **Internal pilot:** limited and manually monitored hosts and guests; settlement intentionally held until approval.
4. **Controlled launch:** activate independently verified provider credentials and explicit financial-release flags, then use a small cohort and monitoring dashboards.
5. **Scale:** graduate only after no data-access regressions, funds reconciliation and stable errors/performance.

## Rollback sequence

1. Stop new reservations and financial actions using trusted server flags or temporarily disable Edge routing. Do not switch client-only feature flags as the sole control.
2. Disable outbound webhooks/worker retries without discarding their events. Put failed provider receipts in the reconciliation queue.
3. Roll frontend traffic back to last verified artifact with the same DB compatibility contract. Never blindly reverse a destructive migration with financial events.
4. Preserve completed money and signature events as append-only evidence; reconcile idempotently after service restoration.
5. Notify incident owner, support and affected users as appropriate; do not expose sensitive details in notifications.

## Operational controls

- GitHub branch protection on main, required CI checks, protected release environment and restricted push credentials.
- Exact secrets in Supabase Edge/managed Vault or approved secret manager; no service-role keys or signing keys in Vite/browser.
- Multiple administrators with individually enrolled MFA; no shared admin logins; least privilege, audited emergency access.
- Nightly backups or point-in-time recovery appropriate to purchased infrastructure tier; daily restore-test evidence before launch.
- Alert on payment-webhook failures, DocuSign retries, release moderation backlog, authentication anomalies, unexpected private bucket permissions and stalled Cron jobs.
- Maintain 7/24 emergency-contact and incident escalation arrangements suitable for the launch scope.

## Existing build commands

```bash
npm ci
npm run lint
npm run typecheck
npm run test:hosting
npm run verify:release
npm audit --audit-level=high
npm run build
npm run smoke:supabase
```

Full role tests: `npm run test:hosting:e2e` with independently verified staging accounts and secure temporary credentials. These tests are read-only; complete destructive booking/payment testing must be done using approved isolated staging/sandbox services.

Current blockers are documented in [hosting readiness](../supabase/HOSTING_PRODUCTION_READINESS.md).
