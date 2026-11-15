# Content Connect X — DocuSign agreement system

## Decision
Use **DocuSign eSignature** as the formal signing provider for performer releases, collaboration agreements, distribution/usage rights, model releases and other attorney-approved agreements. Do not rely on the local prototype `contract_signatures` table as the formal signing method. Open-source electronic signatures can be legally effective, but DocuSign supplies independent transaction evidence and a Certificate of Completion.

## Status
- `signature_envelopes` is created in Supabase with RLS and a private `signed-agreements` bucket.
- Supabase preview shows contract drafts but the previous `sign_contract` action is **disabled**.
- No DocuSign account, API keys, templates, webhook, completed document retrieval, or signer authentication integration has been configured.
- **No legal agreements can yet be signed through the Supabase preview.**

## Production workflow
1. Each member independently completes age verification. An adult verification result never substitutes for producer recordkeeping obligations.
2. Users choose an attorney-approved template (production collaboration agreement; performer release; consent and permitted uses; photographer/studio terms; rights distribution; agent authorization; amendments).
3. The backend calculates the canonical document version/hash and creates a draft eSignature envelope from a predefined approved template, with signer name/email, auth requirements and recording of signers' authority. Contract access must be restricted to collaboration members.
4. DocuSign sends email signing invitations or creates authenticated embedded recipient sessions. Never create signatures via API on behalf of users.
5. A DocuSign Connect webhook authenticated with HMAC confirms changes. Browser redirects and unsigned webhooks **must not** mark a contract complete.
6. When status is completed, retrieve **both** the combined signed PDF and Certificate of Completion using DocuSign's API, verify corresponding envelope and expected recipients, compute SHA-256 hashes, and archive in the private Supabase bucket with immutable metadata.
7. After all expected parties have signed, update `signature_envelopes.status=completed` and `contracts.status=signed`. Only then allow relevant downstream operations. A signed document must not be editable; amendments require new envelopes.
8. Provide only authorized parties short-lived URLs to retrieve the contract and audit evidence.
9. Keep performer consent separate; a DocuSign release cannot substitute for ongoing consent decisions or applicable age-identification and recordkeeping requirements.

## Provider integrations
Use a backend-only DocuSign integration with OAuth 2.0 and scoped secret storage:
- `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_INTEGRATION_KEY`, appropriate OAuth auth data, `DOCUSIGN_BASE_PATH`, `DOCUSIGN_CONNECT_HMAC_SECRET`
- Sandbox first. Confirm DocuSign's account terms and approval for the intended adult-industry business model.
- Implement webhook idempotency and a reconciliation job for lost/out-of-order events.
- Define deletion/retention policy and legal holds with counsel; do not promise that a third-party retained audit record can be deleted on request.
- Never transmit STI results or raw age-verification ID images as part of an ordinary signing envelope.

## Provider reference
- ESIGN Act: https://uscode.house.gov/us/usc/t15/s7001/
- DocuSign webhook: https://developers.docusign.com/platform/webhooks/connect/faq
- DocuSign embedded signing: https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/embedding/embedded-signing/
- DocuSign completed evidence download: https://developers.docusign.com/docs/esign-rest-api/how-to/download-envelope-documents/
- DocuSign HMAC webhook security: https://developers.docusign.com/platform/webhooks/connect/setting-up-hmac/
- U.S. recordkeeping: https://uscode.house.gov/us/usc/t18/s2257/

## Other GitHub integration candidates
Use modular integrations, subject to their current status and suitability:
- Documenso is an optional fallback/reference for signing architecture, not the selected formal contract provider.
- Cal.com / OpenCalendar for booking schedules and travel overlaps.
- Supabase-native chat patterns for messaging and notifications.
- Flagsmith for product experiments and feature flags, never authorization.
- Sentry for error monitoring, with privacy/health/ID redaction.
- Agora/Orbit Social for community feeds and media browsing.
- OpenModerate for a supplementary human-reviewed moderation pipeline.
- Fider for feedback and roadmap voting.

Keep all member authorization, verified-age controls, consent, subscriptions, and private documents in Supabase. Do not integrate external providers without evaluating their restrictions on adult-industry usage.
