# Content Connect X — Hosting Marketplace

The hosting experience is now part of the Supabase-only React application. Its purpose is to provide production-specific spaces and equipment rentals with verified participants and private property details.

## Upstream references and what was adapted

| Reference | Selected features implemented natively |
|---|---|
| [wrujel/airbnb-clone](https://github.com/wrujel/airbnb-clone) | Responsive property cards, category/city/price/amenity/crew/date filtering, details and galleries, favorites, guest reservations and reservation history |
| [anvragsingh/StayFinder](https://github.com/anvragsingh/StayFinder) | Host listing creation/editing, amenities, pricing, image uploads and booking request dashboard |
| [antsal06/openstay](https://github.com/antsal06/openstay) | Database-protected overlapping bookings, availability blackouts, setup/cleanup buffers and host acceptance |
| [lkilpatrick/OpenSTR](https://github.com/lkilpatrick/openstr) | Private per-property turnaround checklists, completion tracking and before/after inspection photo storage |

These projects use different frameworks and data stores. Their entire applications and authentication systems were NOT imported. The new implementation adapts their relevant product patterns to existing React, Vite, Supabase Auth, RLS, Storage and Edge Functions. No separate MongoDB, Prisma or Express runtime is added.

## Host workflow

1. Premium verified adult creates a private listing and specifies production uses (adult production is never automatically permitted).
2. Host supplies public city-level details, permitted use, crew capacity, hourly pricing, minimum duration, amenities and property rules.
3. Host optionally provides an exact address and entry instructions in the protected property_private table. Those details are never returned in search.
4. Host obtains scoped signed upload tokens for images (JPEG/PNG/WebP, max 10 MB). Images are stored in private property-images bucket.
5. Host submits listing and images for independent administrator review. Administrator must use MFA and cannot approve their own listing.
6. Admin approves images before publishing the property. Database triggers require approval metadata and declared permitted uses for an active listing.
7. Material public listing edits return the listing to private draft/pending review.
8. Host can block dates manually, import .ics event blocks (without guest PII), export an availability iCalendar feed and manage incoming reservation requests, completing bookings after their end time.
9. Host can schedule turnovers, tick checklists and upload private before/after inspection images to the property-inspections bucket.

## Guest workflow

1. Independently age-verified members can browse approved listings and favorite locations.
2. Discovery can filter by city, category, price, crew size, amenity, keywords and availability dates.
3. Listing pages show approved photos, description, amenities, explicit permitted production uses, general city map links and reserved intervals—never an exact address.
4. Premium verified members request time slots with crew size, purpose and notes; booking price is snapshotted, but NO payment is taken.
5. A database trigger serializes overlapping requests against existing bookings and host blackouts, respecting setup and cleanup time.
6. Host accepts or declines. Private street address and instructions are available only to reservation participants after acceptance.
7. After a finished accepted visit, the host can mark it complete. Guests may submit one review per completed booking; public reviews require independent moderation.

## Release gates and current limitations

- **Not yet end-to-end tested with multiple verified accounts:** Supabase currently has no independently verified test members.
- **No merchant checkout:** estimated amounts are informational. An adult-industry-approved payment provider, invoices, refunds and deposits still need implementation and tests.
- **No automatic external channel sync:** Manual iCalendar upload and export are supported for UTC/all-day events. Automatic polling of Airbnb/VRBO/Booking.com feeds and Google/Microsoft/iCloud OAuth calendars are not connected.
- **No exact-pin public map:** only general city map links are shown; we intentionally do not publish a property's precise location. A production map needs an approved city-level geocoder/tiles provider.
- **No automated host identity/ownership validation:** admins must manually review authority to rent, property use and publication evidence. Booking terms and property release templates need appropriate review.
- **No autonomous cleaners:** turnover checklists and private inspection uploads are implemented; staff invitation/permissions, supply tracking and cleaning scheduling remain extensions.
- **Private photos are not automatically moderated:** human review is mandatory; hosted images may need inspection and adult-content detection before release.
- **Do not expose address, personal details, identity documents or reservation messages to analytics or public search.**

## Database, UI and API files

- `supabase/sql/028_hosting_marketplace.sql`
- `supabase/sql/029_hosting_privacy_reviews.sql`
- `supabase/sql/030_hosting_internal_policies.sql`
- `supabase/sql/031_hosting_buffer_blackouts.sql`
- `supabase/sql/032_hosting_ical_metadata.sql`
- `supabase/sql/033_hosting_ical_upsert_constraint.sql`
- `supabase/functions/hosting-marketplace/index.ts` — verified JWT entrypoint
- `src/supabase/hostingApi.js` — frontend API with signed upload helper
- `src/supabase/HostingMarketplace.jsx` — discovery, listing details, reservations and favorites
- `src/supabase/HostingHost.jsx` — host operations, calendar imports, admin queue, turnarounds, private address
- `src/supabase/HostingCalendar.jsx` — occupancy calendar view

## Validation

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run smoke:supabase
```

Authenticated scenario tests must cover account suspension, free versus premium, blocked host relationships, booking conflict races, unapproved media, admin MFA and independent review, accepted-reservation address access, and owner-only inspection uploads.

## Host Connect property-owner experience (2026-11-17)

### Product distinction

Host Connect is the **property owner's marketplace**, specifically for adult-content productions. Content Connect X is the verified creator/production network. They share the same Supabase `properties`, booking, calendar and secure host-document records; neither brand maintains a second inventory.

The Airbnb-style implementation was adapted natively from `wrujel/airbnb-clone`, `anvragsingh/StayFinder`, `antsal06/openstay` and `lkilpatrick/OpenSTR`, as documented above. This does **not** import their entire source trees or authentication services.

### Host vs creator verification (critical)

- Hosts **do not** need performer/Yoti identity verification merely to manage a lawful property-host account. This does not waive host eligibility or authorization requirements.
- A host must attest to being at least 18 and legally competent, having ownership or explicit written permission for the property's adult filming uses, and acknowledging the adult-content nature of the service.
- The full `hostTerms.js` agreement is versioned as `host-2026-11-17`. `ccx-integrations/onlyhost_register` records timestamps, agreement version and all confirmations in `onlyhost_accounts`. Backend access denies hosts whose terms are missing or outdated.
- Approval to publish is **separate**: the `HostingHostVerification` workflow collects private authority documentation, ownership/management proof and optional required insurance, and an administrator reviews the submission before publication. Listing approval is not automatic.
- Creator/guest/performer features continue to require their own independent verification. An unverified property host never gains creator access through host registration.

### Host dashboard

`HostingHost` obtains `host_dashboard_summary` from the protected `hosting-marketplace` Edge Function. Its true, per-host metrics are: property count, daily deduplicated signed-in property detail views over 30 days, pending booking requests, future accepted shoots and booking conversation **thread count**. These are not claimed to be unique human visitors across 30 days or unread messages. No fictional listing statistics or guest identities are shown. The view table `hosting_listing_views` is RLS enabled with direct browser permissions revoked; only service Edge Functions write/read its aggregate.

### House rules, prices and eligible content

Hosts explicitly choose allowed uses including nude photography, explicit adult video production, and other production categories. They configure hourly rates, minimum booking durations up to 72 hours, custom house rules, cleaning fee, buffers, deposits, weekend/holiday/overtime premiums, equipment and staff. Hosts self-arrange cleaners until a separate real local cleaning network is developed. A prospective guest must not assume adult production is permitted merely because a listing appears on Host Connect.

**Current limitation:** The pricing SQL caps each reservation at 72 hours, and has no configurable per-property hotel-style daily check-in/out rules. Hourly minimum choices of 6, 12 and 24 hours are available, and up to 72-hour bookings are supported, but multi-day beyond 72 hours, nightly inventory semantics, and 3/4 p.m. check-in-to-11 a.m. checkout must be separately implemented and validated before marketing them as live.

### Liability and release gate

`hostTerms.js` is an operational legal draft, **not** a promise of complete liability immunity. The host is responsible for property authority, permits, venue suitability, insurance, approved uses, cleaning and their acts. The platform still has its own non-waivable duties, abuse-reporting obligations and moderation responsibilities. Obtain jurisdiction-specific counsel review before large-scale public release.

The 2026-11-17 frontend/API changes require independent verification with a real non-performer host test account; provider payments and signing depend on external approval. For each deployment, verify host registration without performer evidence, signed-terms gate, owner document upload, admin property approval, creator access still blocked for host-only identities, guest booking controls and dashboard view tracking.

New schema: `supabase/sql/050_host_owner_terms_and_listing_views.sql` (applied to the active Supabase project on 2026-11-17).


## November 17, 2026: Host dashboard and admin onboarding repair

### Global age-verification control
The `platform-extras` administrative settings actions are now available to database-authorized administrators who complete MFA, even if they have not completed performer age verification. This avoids circular denial when an administrator needs to inspect or change the global `age_verification_required` flag. It does NOT relax independent age/consent checks in creator and production APIs.

`platform_settings` exposes only `age_verification_required` to authenticated readers via RLS, not public writes. Setting mutation is restricted to the verified admin/MFA server action; boolean `value` is sent to JSONB directly rather than JSON-string-encoded. The authenticated app no longer clears a loaded user’s admin/verification state on token refresh, and avoids treating account-loading failures as unverified status.

### Reusable host rules and multi-property editing
The `HostingHost` screen starts in a property overview with thumbnail cards. The full editor appears only after New Space or a property selection; mobile interactions scroll to the editor. Hosts can open **Set My Default Rules** to save common category, rate, cleaning fee, booking notice, turnover window, crew capacity, minimum hours, cancellation, deposits, insurance, house rules, amenities, and permitted adult-production uses. Defaults are stored per-user in `host_listing_defaults` through the protected `hosting-marketplace` actions `host_defaults_get`/`host_defaults_set` and prefill NEW listings; individual listings can override all defaults. Street addresses and titles are never copied into a default template.

Amenities and permitted use selections are whole-card, multi-select buttons with keyboard and screen-reader checked states. Existing host listing data remains in the original `properties` table, and full addresses are stored separately in `property_private`. The guest-facing Content Connect X Properties tiles show the existing approved primary image, title, city/region, hourly rate, and capacity; exact addresses are never returned to directory cards.

### Property media and moderation
Existing property photos retain their private signed-upload and human-approval pipeline. New MP4/WebM walkthrough videos (max 40 MB each, max five per listing) upload to the PRIVATE `property-videos` bucket and are indexed by `property_videos`. Only the owner sees their own pending videos; guests see signed playback URLs for APPROVED videos on listing details, never auto-played. Administrators independently review pending videos through the hosting approval queue. A listing still needs an approved photo for its card thumbnail. If uploaded to an active property, media changes return the listing to the review queue.

### Publication safety
A listing may not be sent for review without its private complete address and permitted uses. Public publication requires an independently approved photo, explicit permitted uses, human review, and a current approved property-authority verification record (ownership or specific written permission) separate from creator age verification.

New schema: `supabase/sql/051_platform_global_gate_read_policy.sql`, `supabase/sql/052_host_defaults_and_property_videos.sql`.

### Validation boundaries
Automated lint, type-check, build, repository checks and deployment checks cannot substitute for signing in as a real host/admin/verified creator. Validate: admin MFA settings toggling and persistence, navigation without age-gate flashes, host default save/reload, new-space creation, private address retention, photo/video uploads, administrator moderation, private signed video playback, authorized property publication, and guest thumbnail display. Full hotel-night check-in/out configuration and multi-night stays beyond the present 72-hour quote limit remain separate features.
