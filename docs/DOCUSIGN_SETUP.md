# DocuSign signing — Content Connect X and Host Connect

## Where to put the credentials

Use the signed-in **Admin → API & Integrations → DocuSign** provider card. This
sends credentials to the server-side integration gateway and encrypts them in
Supabase Vault; no signing secrets are bundled into Bolt browser assets.

| Encrypted setting | Get from your DocuSign administrator/developer account |
|---|---|
| `docusign_account_id` | API account ID of the correct sandbox/production account |
| `docusign_integration_key` | Application integration key (OAuth client ID) |
| `docusign_user_id` | GUID of the DocuSign user authorized to send envelopes |
| `docusign_private_key` | RSA private key in PEM form generated for that integration |
| `docusign_hmac` | DocuSign Connect HMAC signing secret for webhook verification |

The server also accepts matching environment secrets `DOCUSIGN_ACCOUNT_ID`,
`DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_PRIVATE_KEY`, and
`DOCUSIGN_CONNECT_HMAC_SECRET`. Do not put these in Vite/Bolt frontend variables.

**OAuth environment:** The agreement sender now tries the official demo and
production OAuth hosts when no explicit host is set. Once authorized, it uses
the DocuSign `/oauth/userinfo` account metadata to select the authorized
regional REST API base, caching that discovery. The optional
`DOCUSIGN_OAUTH_HOST` can pin the environment to
`account-d.docusign.com` (demo) or `account.docusign.com` (production).

## Required one-time DocuSign account-side actions

DocuSign's JWT Grant requires your authorized integration user to grant the
application **signature** and **impersonation** consent. Configure an approved
redirect URI and approve the consent request in the actual DocuSign environment.
Developer/demo credentials do not automatically authorize the production
account. Follow official docs:
https://developers.docusign.com/platform/auth/jwt-get-token/

For completed collaboration signatures, configure a DocuSign Connect webhook
with HMAC at:

`https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/collaboration-docusign-webhook`

The Host property-signing flow has a separate callback:

`https://yxuqbygykpfbioslljlf.supabase.co/functions/v1/hosting-docusign-webhook`

The callback must include provider signatures. Anonymous/public requests
without a valid DocuSign HMAC are rejected.

## Existing application workflow

1. Prepare the collaboration's draft terms and participants.
2. Have **every signing participant** review and approve the exact draft. AI
   drafts are hash-bound, and changes require new approvals.
3. The signed-in organizer sends the DocuSign packet. A unique signing tab
   is assigned to each individual participant.
4. DocuSign independently collects each person's signature.
5. The verified provider completion callback retrieves the signed agreement
   and certificate into a private storage archive. Per-signer completion and
   notice records are updated from provider evidence.
6. Verify a real sandbox envelope, rejected/declined response, duplicate
   callback, and the completed-document archive before enabling live signing.

Never treat a browser click or drafted JSON as a completed signature. A
DocuSign user consent and account approval is a provider requirement, not
another app API key that the website can fabricate.
