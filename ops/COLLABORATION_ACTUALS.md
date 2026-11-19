# Participant completion statements — operations and acceptance

**Content Connect X / Host Connect · November 19, 2026**

This release allows every accepted collaboration participant to record what they personally believe was completed after a scheduled production. Statements are independently authored and may disagree. They are not authoritative proof, legal findings, consent or signed contract amendments.

## Security and data rules

- The authenticated participant ID comes only from Supabase Auth and is independently verified by the service-only SQL function. Other members of the same collaboration may inspect the statements for that project; outsiders cannot.
- Post-production submission requires a scheduled end time in the past and a non-cancelled collaboration. Access to existing lawfully retained history does not depend on an active paid subscription.
- First submission creates revision 1. A correction creates revision 2 or higher while leaving all earlier revisions intact. Retrying the same idempotency UUID with identical text returns the existing record; reuse for different content fails.
- Production-plan version is snapshotted in each statement, but the statement does not amend any agreement. Where plan changes, renewed consent or signatures are needed, use their independently protected workflows.
- Do not collect government IDs, private health information, explicit videos, or signed evidence through this text-only form. The service returns a fixed set of fields; internal idempotency references are never shown to other users.
- Review disputes, safety concerns, abuse, privacy and legal holds through the separate qualified channels. Statements alone neither validate another person's conduct nor resolve a dispute.

## Test matrix

Test two different admitted participants with different answers, missing participant, expired/restricted account, future/cancelled collaboration, concurrent submissions, duplicate request, maliciously changed idempotency key, typo correction, archived collaboration, mobile forms, interrupted network, and attempt to delete or overwrite historical records.

Verify original plan and current signed contract remain unchanged after statement submission. Confirm each correction has a new revision and prior texts remain visible. Test that the API will never accept browser-provided `actor_id`, `plan_version`, or `approval`.

## Deploy and rollback

Apply the source-controlled migration to the existing Supabase project only after disposable PostgreSQL and full CI pass. Deploy `collaboration-actuals` using the exact checked-in `index.ts` and `handler.mjs` and with JWT authentication enabled. Check the function returns 401 to anonymous callers. Verify private table RLS and no `authenticated` EXECUTE privilege on the database RPC. Publish the frontend only through the existing Bolt website.

If an issue arises, disable the UI action or roll back the Edge Function. Preserve previous participant revisions and audit history; deleting or rewriting statements to force a test pass is prohibited. All deletion and retention rules are subject to independent policy/legal review.

**Unfinished release dependencies:** actual signed agreements, independent consent enforcement, provider acceptance, additional completion and dispute-handling operations, signed archive exports and real-world multi-member end-to-end verification.
