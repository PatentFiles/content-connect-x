# Content Connect X / Host Connect X marketing demonstration

## What this implementation changes

Both applications use the same deterministic Los Angeles-area catalog and asset mapping. The normal page components render in both modes; the old separate `AdminDemoWorkspace` is no longer the application route for mock mode. Shared dashboard cards no longer have a decorative left stripe. Workspace width, internal gutters, responsive property search, the list/map split and mobile search disclosure have been refined.

The dataset contains 100 venues, 34 fictional adults, 12 groups, 12 conversations, 12 collaborations, 8 sample contracts, 42 products, 6 historical testing examples and 24 notifications. Tommy Ryder is the recording persona and Jade Ryder is the fictional representative. Larger group member counts and profile-view totals are explicit aggregate demonstration values, not claims about real platform activity.

The fixed recording clock is November 25, 2026. Year in Review is **year to date**, not a completed future year. Prices are illustrative USD values, not researched market quotations. Venue locations are deliberately approximate and do not identify actual private properties. A 24-hour daily booking and its associated shorter production session are separate intervals.

## Start a recording

Sign in with an account that already has administrator access. Use the existing **Mock data** switch on each website. Its real administrator endpoint must authorize the session; this change does not add a query-string login bypass, grant administrator status, or bypass production admission.

On Content Connect X, use the ordinary sidebar routes. On Host Connect X, use Explore spaces, the Host dashboard, My properties and booking screens. Both property browsers start from the same 100 IDs, names, coordinates, amenities, prices and photos. Select the same property title on each website for a comparison take.

Preview changes are **local to that browser session**. A demo reservation, message, favorite or profile edit does not synchronize between separate websites or browser tabs. Toggle mock mode off and back on to restore the identical initial dataset before recording another take. Signing out, changing accounts or losing administrator authorization also clears demo state and temporary attachment URLs.

Keep the existing demo indicator visible. These people, inventory, signatures, testing examples and verification results must not be represented as genuine customer activity.

## Image status: incomplete

**No new realistic property photographs, generated adult portraits or product photographs have been installed in this change.** Until the approved asset mapping is populated, the interface deliberately uses existing category artwork, initials or product icons rather than unrelated real people's photographs, unstable random URLs or broken images.

`asset-manifest.json` contains the complete handoff: 100 property cover images, 34 clearly adult fictional portraits and 42 neutral product images, with exact filenames, dimensions and individual generation briefs. There are **176 required primary images**. Additional gallery angles are optional.

Produce or obtain authorized images, inspect them, optimize them as WebP, and place them at the manifest paths under `public/demo-assets/`. Install the same property assets in both repositories. Each person's portrait must be the same wherever that ID appears. Portraits must be fictional or expressly authorized for the intended context, fully clothed and clearly adult. Do not assign an unrelated real person's face to a fictional adult-industry identity.

Add records to `src/demo/approvedAssets.json`, for example:

```json
{
  "demo-la-venue-001": {
    "cover_url": "/demo-assets/properties/demo-la-venue-001.webp",
    "gallery": ["/demo-assets/properties/demo-la-venue-001.webp"],
    "provenance": {"kind": "generated-fictional", "rights_confirmed": true, "notes": "Inspected and approved architectural image"}
  },
  "demo-person-jade-ryder": {
    "avatar_url": "/demo-assets/people/demo-person-jade-ryder.webp",
    "provenance": {"kind": "generated-fictional", "rights_confirmed": true, "notes": "Clearly adult fictional portrait, not based on a real person"}
  },
  "demo-product-lingerie-1": {
    "image_url": "/demo-assets/products/demo-product-lingerie-1.webp",
    "provenance": {"kind": "licensed", "rights_confirmed": true, "notes": "Record the actual source, license and approval here"}
  }
}
```

Only confirm rights after checking the actual asset's source and intended use. The example above is a schema, not an assertion that these files or licenses exist.

Run `npm run demo:assets` to regenerate the handoff and catalog fingerprint. Run `npm run demo:assets -- --require-complete` before treating the image set as recording-ready. This deliberately fails until all images are present and provenance is recorded.

## Isolation and protected workflows

`src/demo/demoRuntime.mjs` intercepts the data client only while an authorized demo session is active. The separate `liveSupabase` client remains responsible for real authentication, administrator authorization and root feature-access decisions. Unknown demo functions, RPCs, mutations, verification operations and uploads fail closed instead of falling through to a real service.

Demo messages, favorites, drafts and supported edits affect memory only. No database is seeded. No payment, real booking, invitation email, signature envelope, identity approval or medical-clearance decision is created. Real identity and property-evidence uploads are blocked. Testing and verification examples are explicitly fictional; document-review acceptance must not be interpreted as medical clearance.

The new messenger uses the same two-pane desktop and single-pane mobile presentation for live and demo conversations. Local demo photo/video attachments support JPEG, PNG, WebP, MP4 and WebM with size limits and preview/removal controls. **Live media attachments remain capability-gated**: an existing backend must explicitly advertise and implement the private upload/register contract before that control enables in live mode. This change does not deploy that backend or a media-storage migration. Voice/video calling, real signatures, real payments, administrative approvals and unsupported host-management writes are not simulated as successful actions.

The shared files are copied deliberately into two independent repositories; they are not a cross-origin runtime database. Keep these files synchronized:

- `src/demo/marketingFixtures.mjs`, `demoRuntime.mjs`, `approvedAssets.json`
- `src/supabase/MarketplaceExplore.jsx`, `hostVenueCategories.mjs`
- Installed property images and their gallery ordering

Compare from either repository with `npm run demo:assets -- --compare ../path-to-other-repository`. The command fails if the canonical fixture source, asset map, adapter, marketplace or property taxonomy diverges.

## Validation

`npm run test:demo` exercises fixture counts, IDs, category coverage, coordinates, amenities, relationship consistency, price arithmetic, session reset, live-service isolation, sample verification boundaries and responsive-search defaults. Existing unit suites remain part of validation; old assertions that explicitly required the removed stripe or the replaced single-select category control were updated to the new requirements.

`npm run test:demo:browser` starts a temporary Vite test fixture, renders the actual page components against the demo adapter and uses a Chromium-family browser. Set `CHROME_BIN` where automatic detection is insufficient. `DEMO_AUDIT_WIDTHS`, `DEMO_AUDIT_SCREENS` and `DEMO_AUDIT_OUT` select viewport sizes, routes and the screenshot/report directory. The fixture includes a live-service spy and is deleted after the run; it is not a production route or authentication bypass.

These component-level browser checks are not a claim that production login, deployed integrations, billing, actual medical verification, vendor webhooks or release deployment were end-to-end tested. Commit/push status and deployment status must be reported separately.
