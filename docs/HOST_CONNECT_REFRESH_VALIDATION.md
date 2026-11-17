# Host Connect refresh validation — November 17, 2026

## Delivered
- Native modal editors for New Space and saved default rules, with focus containment, Escape, focus return and background scroll locking.
- Equal-height desktop action/portfolio cards. The action card contains New Space, Set Default Rules and View Local Market. Photo-first portfolio carousel and per-card photo navigation.
- Shared photo-first property cards and a five-photo mosaic/full gallery for Content Connect X Properties.
- Multiple-file and drag/drop photo selection; paginated owner/guest galleries without a fixed 20-photo cap. Per-file 10MB, storage quotas and independent media approval remain enforced.
- Authenticated city/bounds market search below booking requests, own-property markers and approved approximate public area centers. No exact address disclosure or scraped third-party prices.
- Retired unused membership payment endpoint references, duplicate merchant diagnostics, and separated optional non-secret configuration defaults from actual provider credentials. Supabase-managed secrets and existing Yoti/PASS data remain untouched.

## Evidence
Local Chromium fixture tests were executed at 1440px and 390px: modal opening and Escape, viewport fit, background scroll lock, property-carousel navigation, multi-select, 25-image selection, default-rule save, and city search passed with no page JavaScript errors. Desktop side-card heights matched. Test images/listings were local fixtures; no demonstration property was inserted into the real database.

Six source/configuration regressions and seven executable API authorization tests cover fail-closed provider approvals, retired endpoints, credential preservation, photo selection beyond twenty, owner/guest media boundaries, expired property authority, rejected unauthorized upload paths, paginated media and market result privacy. API tests use an in-memory database, not an authenticated production account.

Full lint, application typecheck, build, hosting policy tests, Yoti trust tests, readiness checks, release guards and frontend/backend import/action contracts pass locally. CI reruns these before committing recovered source. Provider sandbox acceptance, real authenticated host/guest bookings and production financial operations are NOT certified by these tests. Existing dependency-audit findings are not suppressed.

## Configuration and deployment
See SUPABASE_CONFIGURATION_INVENTORY.md for exact remaining names and optional defaults. Re-sync/rebuild Bolt to refresh source-based missing-variable prompts; a cached editor notification cannot be cleared from GitHub. Deploy the new hosting-discovery function with the updated frontend. The relevant existing provider functions retain the original Supabase environment override names and remain disabled until their real credentials and approvals are configured.
