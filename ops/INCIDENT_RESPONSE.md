# CCX production incident response

Owner: **assign a named security and operations lead before launch**. No real 24/7 coverage has been established.

## Severity

- **SEV1:** unauthorized exposure of IDs, health/sexual-content records, exact locations, compromised signing/payment keys, erroneous live payments or account takeover.
- **SEV2:** booking over-reservation, incorrect payout/refund, blocked releases, provider webhook failures or availability incident.
- **SEV3:** degraded search, calendar-sync errors, delays in neutral email/push notices, minor UI faults.

## Immediate containment

1. Record incident time, affected systems and trace identifiers; do not copy unredacted ID/media/medical records into generic chat, email or issue comments.
2. Restrict the affected Edge endpoint, provider credential, role or storage policy through server-side controls. For compromised signing keys, rotate/revoke via vendor.
3. Stop automated money movement and outbound callbacks if their provenance is uncertain. Do not delete webhook evidence or replay indiscriminately.
4. Preserve incident evidence and access logs under role-limited retention. Assess required notices with privacy counsel.
5. Investigate root cause with reproducible test cases; test patch in staging and deploy via reviewed CI.
6. Reconcile each affected booking, signature and financial event with independent provider records.
7. Publish a blameless postmortem identifying prevention and detection improvements.

## Minimum alert categories

Age-verification failures, MFA enforcement gaps, forbidden-row reads, private-bucket policy changes, negative cash ledger, duplicate payment receipts, unprocessed webhook age, expired provider secrets, Cron stalls, high cancellation/chargeback rates, incident and moderation backlog.

Never report a transaction **paid** until an independently authenticated provider record confirms the settlement.
