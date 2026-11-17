# Supabase configuration inventory — Host Connect / Content Connect X

Audited against the missing-variable list supplied on November 17, 2026. Values are deliberately not recorded here. Credentials belong in Supabase Edge Function secrets, never browser variables, source control, screenshots, or chat. No new settings screen is added by this change.

## What was retired

The old `create-checkout` and `stripe-webhook` membership endpoints return HTTP 410 without reading any provider secrets. The live frontend has no dependency on either endpoint. The following six obsolete prompts are no longer runtime requirements:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ADULT_BUSINESS_APPROVED`
- `STRIPE_PRICE_MEMBER_MONTHLY`
- `STRIPE_PRICE_MEMBER_YEARLY`
- `CONTENT_CONNECT_APP_URL` (the retired Stripe return URL, not the current Yoti callback configuration)

`ADULT_MERCHANT_APPROVED` and `ADULT_MERCHANT_PROVIDER` were duplicate generic diagnostics. CCBill's real configuration and release gates now determine that diagnostics result. Retiring them does **not** approve a merchant, enable checkout, waive webhook verification, or activate paid memberships.

## Credentials and provider identifiers that remain connected

Supply these only for the services you actually activate. Basic property management, drafts, photographs, calendars maintained manually, and the approximate market map do not require every provider to be enabled.

| Service | Values still read securely by its backend |
| --- | --- |
| CCBill hosted location checkout | `CCBILL_CLIENT_ACCNUM`, `CCBILL_CLIENT_SUBACC`, `CCBILL_FLEX_ID`, `CCBILL_SALT` |
| DocuSign | `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_CONNECT_HMAC_SECRET`, `DOCUSIGN_LOCATION_TEMPLATE_ID` |
| Automatic external-calendar synchronization | `HOSTING_CALENDAR_JOB_SECRET` |
| Notification scheduler | `HOSTING_NOTIFIER_JOB_SECRET` |
| Transactional email | `HOSTING_EMAIL_API_TOKEN` |
| Optional browser push | `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` |
| Optional automated moderation | `OPENMODERATE_API_KEY` |

Account IDs, template IDs, and a public VAPID key are not passwords, but remain required provider configuration for their specific integrations. Job secrets authenticate scheduled requests and are not arbitrary display flags. A missing provider stays unavailable; the application must never report a fake payment, delivery, signature or moderation success.

## Non-secret settings: defaults, not missing credentials

These use the allowlisted `providerConfig.mjs` reader and retain their original Supabase environment override names. Their absence is intentional when the integration is disabled. They are not API keys to purchase. All approval switches default to **false**. Do not set them to true merely to clear warnings.

| Setting | Default / requirement |
| --- | --- |
| `HOSTING_ROUTING_OSRM_URL`, `HOSTING_ROUTING_APPROVED` | Empty URL / false. Optional driving-time routing only, not needed for the basic map. |
| `HOSTING_EXTRA_CALENDAR_HOSTS` | Empty. Optional allowlist extension; existing approved Airbnb/VRBO/Booking hosts remain supported. |
| `HOSTING_FINANCIAL_RELEASE_APPROVED`, `HOSTING_PROVIDER_CALLBACK_RECONCILED` | False. Require real release and reconciliation evidence. |
| `CCBILL_HOSTING_APPROVED`, `CCBILL_DYNAMIC_PRICING_APPROVED`, `CCBILL_FLEXFORM_LIVE_APPROVED`, `CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED` | False. Provider approval and independently verified event contract remain mandatory. |
| `CCBILL_BOOKING_PERIOD_DAYS` | Empty; must match the approved merchant contract before checkout activates. It is **not** the property's minimum rental duration. |
| `DOCUSIGN_ADULT_BUSINESS_APPROVED` | False. Independent business/provider approval remains necessary. |
| `DOCUSIGN_OAUTH_HOST`, `DOCUSIGN_API_BASE` | Official sandbox endpoints. Configure the approved production endpoints only when going live. |
| `HOSTING_EMAIL_PROVIDER_ENABLED`, `HOSTING_EMAIL_API_URL`, `HOSTING_EMAIL_FROM` | False / empty / empty. Specify a compatible provider endpoint and authorized sender when enabling email. |
| `HOSTING_PUSH_PROVIDER_ENABLED`, `WEB_PUSH_SUBJECT` | False / empty. Optional push requires VAPID keys, subject/contact and working device enrollment. |
| `HOSTING_FRONTEND_ORIGIN` | `/`. Set your public application origin for notification links when needed. |
| `OPENMODERATE_SERVICE_URL` | Empty. Optional automated moderation endpoint; independent human review remains required. |
| `ADULT_MEDIA_PUBLICATION_READY` | False. Preserved independent publication safeguard, never enabled by this maintenance. |

The registry does not store secrets or make configuration public. Sensitive keys remain explicit environment lookups in server-only functions. Runtime override validation and credential validation continue at the provider boundary. The existence of a configured value is not proof of acceptance or successful end-to-end use.

## Leave Supabase-managed values alone

Do not remove or copy these into VITE/frontend configuration: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEYS`, `SUPABASE_DB_URL`. Preserve the injected `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_JWKS` and other Supabase-managed defaults as well. Only approved publishable browser settings belong in the frontend.

Yoti/PASS integration configuration already stored through the existing Supabase/Vault workflow is unchanged. This cleanup does not remove verification or consent requirements.

## Maps, media and deployment

The host price-comparison API uses the shared approved property inventory and city/neighborhood area centers. It does not scrape Airbnb pricing or reveal exact addresses. Browser OpenStreetMap tiles provide a default map; production deployments can set `VITE_HOSTING_MAP_TILE_URL` and `VITE_HOSTING_MAP_ATTRIBUTION` for a contracted tile service. These browser map options are separate from server route-provider credentials.

Photos upload through private signed storage, retain a 10MB per-file safety limit and independent approval, and are paginated without a fixed 20-photo application cap. Storage quotas, bandwidth, account limits and provider billing still apply. The new `hosting-discovery` Edge Function must be deployed together with the updated frontend.

After syncing main, rebuild/reload Bolt so its source-based variable inventory refreshes. This patch cannot directly clear a cached Bolt editor notification or populate external provider credentials. It does not add dummy secrets, set approval flags, or delete existing secrets.
