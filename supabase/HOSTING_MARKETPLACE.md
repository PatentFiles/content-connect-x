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
8. Host can block dates and manage incoming reservation requests, completing bookings after their end time.
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
- **No external channel sync:** Airbnb/VRBO/Booking.com iCalendar imports and Google/Microsoft/iCloud OAuth calendars are not connected. Hosts can block dates manually.
- **No exact-pin public map:** only general city map links are shown; we intentionally do not publish a property's precise location. A production map needs an approved city-level geocoder/tiles provider.
- **No automated host identity/ownership validation:** admins must manually review authority to rent, property use and publication evidence. Booking terms and property release templates need appropriate review.
- **No autonomous cleaners:** turnover checklists and private inspection uploads are implemented; staff invitation/permissions, supply tracking and cleaning scheduling remain extensions.
- **Private photos are not automatically moderated:** human review is mandatory; hosted images may need inspection and adult-content detection before release.
- **Do not expose address, personal details, identity documents or reservation messages to analytics or public search.**

## Database, UI and API files

- `supabase/sql/028_hosting_marketplace.sql`
- `supabase/sql/029_hosting_privacy_reviews.sql`
- `supabase/sql/030_hosting_internal_policies.sql`
- `supabase/functions/hosting-marketplace/index.ts` — verified JWT entrypoint
- `src/supabase/hostingApi.js` — frontend API with signed upload helper
- `src/supabase/HostingMarketplace.jsx` — discovery, listing details, reservations and favorites
- `src/supabase/HostingHost.jsx` — host operations, admin queue, turnarounds, private address

## Validation

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run smoke:supabase
```

Authenticated scenario tests must cover account suspension, free versus premium, blocked host relationships, booking conflict races, unapproved media, admin MFA and independent review, accepted-reservation address access, and owner-only inspection uploads.