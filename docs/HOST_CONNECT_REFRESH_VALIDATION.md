# Host Connect refresh validation — November 17, 2026

## Delivered
- Native modal editors for New Space and saved default rules, with focus containment, Escape, focus return and background scroll locking.
- Equal-height desktop action/portfolio cards. The action card contains New Space, Set Default Rules and View Local Market. Photo-first portfolio carousel and per-card photo navigation.
- Shared photo-first property cards and a five-photo mosaic/full gallery for Content Connect X Properties.
- Multiple-file and drag/drop photo selection; paginated owner/guest galleries without a fixed 20-photo cap. Per-file 10MB, storage quotas and independent media approval remain enforced.
- Authenticated city/bounds market search below booking requests, own-property markers and approved approximate public area centers. No exact address disclosure or scraped third-party prices.
- Retired unused membership payment endpoint references, duplicate merchant diagnostics, and separated optional non-secret configuration defaults from actual provider credentials. Supabase-managed secrets and existing Yoti/PASS data remain untouched.

## Browser and authorization evidence
Local Chromium fixture tests were executed at 1440px and 390px: modal opening and Escape, viewport fit, background scroll lock, property-carousel navigation, multi-select, 25-image selection, default-rule save, and city search passed with no page JavaScript errors. Desktop side-card heights matched; mobile cards stack instead of forcing equal heights. Test images/listings were local fixtures; no demonstration property was inserted into the real database.

Six source/configuration regressions and seven executable API authorization tests cover fail-closed provider approvals, retired endpoints, credential preservation, photo selection beyond twenty, owner/guest media boundaries, expired property authority, rejected unauthorized upload paths, paginated media and market result privacy. API tests use an in-memory database, not an authenticated production account. Both test files now run in the permanent quality workflow.

## Confirmed CI result
Application integration commit: `7f2b06e56e42e2e52ec740d9e30803fb5a0960cd`.

The complete functional verification job for commit `a1f2e215db59ae51e785ff3b47de8aff82d4ec21`, run [44194497260](https://github.com/PatentFiles/content-connect-x/actions/runs/44194497260), completed successfully. It includes lint, application typechecking, hosting/map and authorization regressions, Yoti trust tests, role rendering, onboarding and privacy tests, release guards, frontend/backend contracts, Edge import checks, the production build, staging container and health checks, and unauthenticated live Supabase gateway checks. The new discovery gateway rejects anonymous requests; the retired membership webhook returns HTTP 410.

The separate dependency-audit job remains FAILED. Its dependency findings are not ignored, bypassed or presented as a successful release check. A passing functional job does not mean the overall workflow is green.

## Backend deployment completed
The following deployment versions were confirmed ACTIVE in Supabase project `yxuqbygykpfbioslljlf` on November 17, 2026:

| Function | Version | Purpose |
| --- | ---: | --- |
| hosting-discovery | 1 | Authorized market search, thumbnails and paginated private/approved galleries |
| create-checkout | 3 | Retired legacy membership endpoint; returns 410 |
| stripe-webhook | 1 | Retired callback; returns 410 without processing financial events |
| integration-health | 4 | Configuration-presence diagnostics without secret values |
| hosting-ccbill | 3 | Existing payment workflow with optional non-secret configuration reader |
| hosting-ccbill-webhook | 4 | Existing verified payment callback and release checks |
| hosting-docusign | 3 | Existing signing workflow with optional non-secret configuration reader |
| hosting-docusign-webhook | 3 | Existing HMAC callback and document archival |
| hosting-notification-worker | 2 | Existing optional email/push workflow |
| hosting-calendar | 3 | Existing calendar controls and optional allowlist configuration |
| hosting-advanced | 5 | Existing pricing/inventory workflow and optional routing |
| hosting-operations | 4 | CCBill-specific readiness diagnostics; duplicate generic merchant settings retired |
| media-gateway | 5 | Existing moderation workflow and fail-closed publication settings |

Provider functions were bundled from the validated source with esbuild (ESM, ES2022, external node/npm/jsr/HTTPS dependencies); readable TypeScript and the shared configuration module remain in GitHub. Existing JWT gateway settings and application authorization checks were preserved. ACTIVE means the function deployed, not that an external merchant, signature, notification, moderation or routing provider has been activated or certified.

No secret values were inspected, replaced, created or deleted. No provider approval flag was enabled. No database migration was required for this refresh.

## Configuration and publishing
See [SUPABASE_CONFIGURATION_INVENTORY.md](./SUPABASE_CONFIGURATION_INVENTORY.md) for exact remaining provider names and optional defaults. The necessary new backend is already deployed. Sync GitHub main into Bolt, rebuild and reload before publishing the frontend. This source update cannot directly clear a cached Bolt editor notification; genuine missing integration credentials will remain unavailable until configured in Supabase.

## Remaining validation boundaries
Real authenticated host/guest uploads, booking flows, provider sandbox acceptance, financial settlement, DocuSign completion and notification delivery have NOT been certified by fixture or anonymous gateway tests. Existing booking limits and provider activation requirements remain unchanged. Complete those checks and resolve the dependency audit before treating the application as production-approved.
