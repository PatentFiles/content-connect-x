# Provider activation and independent sandbox acceptance

No provider credentials are stored in this document or Git repository.

## CCBill adult-business merchant

- Written approval for BOTH content creator memberships and third-party studio/location marketplace rentals (if applicable).
- Confirm merchant supports split settlements/host payouts, damage deposits, partial refunds, delayed captures, chargebacks, taxes and fee schedules. Current app has **no real payout execution**.
- Verify exact FlexForms dynamic pricing parameters and receipt callback **from provider documentation and sample signed sandbox events**; do not turn on financial release flags based on static code alone.
- Required independent gates: `HOSTING_FINANCIAL_RELEASE_APPROVED`, `HOSTING_PROVIDER_CALLBACK_RECONCILED`, `CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED` must remain unset/false until signed acceptance.
- Reconcile booked totals, authorized charges, captures, refunds, balances and settlements with merchant statements.
- Collect no card data in CCX. Token secrets must remain server side.

## DocuSign

- Obtain approved account and JWT consent. Attorney-approved templates with independent administrator activation.
- Verify signer identities separately from profile display names; no embedded automatic signature.
- Test HMAC Connect 2.0 callbacks and their retries, out-of-order delivery, rejection/void and PDF/certificate SHA-256/archive.
- Keep source of truth with DocuSign; manual reconciliation for unknown envelope states.

## Identity, medical/privacy and moderation

- Independently approved adult-identity provider and manual escalation.
- Performer consent and rights retention must remain separate from signatures, age checks and clinical work-clearance status.
- Media moderation workers, publication controls, takedown, disputes and legal hold policies need partner approval and specialist review.

## Calendars/maps/notifications

- Host-approved provider domains and webhook/polling permission. Store no third-party guest names.
- Configure matching Edge/Vault secrets for scheduled workers; default zero secrets means jobs are intentionally dormant.
- Neutral transactional email, push VAPID keys and provider delivery monitoring without leaking media or medical data.
- Approved map tile contract and routing provider (public map centers only).

**Activation requires human verification, not configuration booleans alone.**
