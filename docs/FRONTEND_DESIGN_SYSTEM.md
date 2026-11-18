## Public homepage styling boundary — November 18, 2026

The logged-out Content Connect X and Host Connect pages retain their original dark/neon branding, original hero artwork, gradients and responsive layout. The professional white redesign applies **after sign-in**, including member, administrator, verification and host workspaces. Do not replace public artwork or apply workspace CSS globally.

The public skin is restored from commit `21b95435a02e9e1e6ddc10e8805f377bf4b9a67d`. `authAppearance.js` follows the actual Auth session and changes presentation only. Every theme selector is scoped to either public or non-public appearance, with original specificity preserved via `:where()`. This cannot grant admission or bypass any backend rule. Signing out restores public styling and clears the Host workspace display.

Regression tests verify all three original asset hashes, every CSS scope, real image decoding at mobile/desktop sizes, and real component sign-in/sign-out transitions using isolated Auth fixtures. Existing white-workspace/modal, identity and account-access tests remain in place. Bolt is still the website host; no Supabase or Railway deployment is needed for this presentation fix.

# Content Connect X frontend system

## Brand and visual direction — November 18, 2026

Both Content Connect X and Host Connect use the owner-selected **professional white interface**. This replaces the earlier neon/dark design, including public landing pages, account screens, dashboards, host tools, forms, modals, and mobile browser/PWA chrome. Do not restore a dark theme from a previous localStorage preference or OS setting.

| Token | Value | Purpose |
|---|---|---|
| `--cc-bg`, `--cc-surface` | `#FFFFFF` | White page and card surfaces |
| `--cc-surface-subtle` | `#F6F7F9` | Quiet secondary regions |
| `--cc-text-primary` | `#202938` | Headings and body text |
| `--cc-text-secondary` | `#4F5D70` | Supporting text |
| `--cc-text-muted` | `#5E6B7E` | Captions that remain readable |
| `--cc-action` | `#243247` | Solid primary actions |
| `--cc-on-action` | `#FFFFFF` | Text/icons on primary actions |
| `--cc-border` | `#DDE2E8` | Subtle structural dividers |
| `--cc-input-border` | `#8894A5` | Editable-control boundaries |
| `--cc-focus` | `#245BA3` | Keyboard focus |

Use `ccx-primary` / `ccx-action-primary` / `oh-primary` for primary actions, `ccx-secondary` / `oh-secondary` for secondary actions, and `ccx-surface` / `oh-panel` for cards. Host gallery actions use the same solid-action treatment. Error, warning, and success states retain restrained semantic colors; image controls and media viewers may use dark scrims for legibility. Do not invert images or globally override all text to one color.

Tokens are in `src/globals.css`. Screen-specific layout remains in the brand/host/marketing stylesheets. `src/supabase/professional-theme.css` is loaded last by `bootstrap.jsx` and defines the consistent visual treatment. Source components now refer to semantic color variables instead of hard-coded dark/pastel utilities. Existing `control-layout.css` protections for checkboxes, touch targets, labels and action rows remain intact.

Public hero content is now accessible HTML in `ProfessionalLandingHero.jsx`, not neon artwork with text baked into the image. Existing artwork is retained in `public/` but no longer used for the main hero or login backdrop. The header uses a simple text/monogram brand treatment. No external fonts, image services or design-library runtime dependencies were added.

For future work: keep buttons static with subtle hover/focus state changes, use small consistent corner radii and low-elevation shadows, and reserve color for meaningful state rather than decoration. Do not use gradients, glow, bouncing navigation, or floating call-to-action effects. Preserve all route handlers, permissions, payment checks and verification states.

## Frontend and backend route ownership

| User experience | Frontend | Supabase API |
|---|---|---|
| Dashboard and identity status | `DashboardHome`, `SupabaseApp` | Auth, profile and verified member state |
| Production team/event work | `ProductionManager` | `production-manager` |
| Private collaborations, chat, consent | `MemberWorkspace`, `ConsentCenter` | `member-workflows`, `collaboration-consent` |
| Creator discovery | `SupabaseApp` | `directory` |
| Community, feedback, availability | Corresponding `*Hub` screens | `platform-extras` |
| Location marketplace, booking and admin ops | `HostingMarketplace`, `HostingHost`, `HostingBookingOperations` | `hosting-marketplace`, `hosting-advanced`, `hosting-operations` |
| Equipment, location map, crew, calendar | Hosting management screens | `hosting-advanced`, `hosting-production`, `hosting-calendar` |
| Verified rental agreements | `HostingBookingOperations`, `AgreementPackets` | `hosting-docusign`, `agreement-packets` |
| Approved hosted checkout | `HostingBookingOperations` | `hosting-ccbill` — provider gates must pass |
| Account trust and safety | `SecurityCenter`, `TrustCenter`, `SafetyPanel` | Age, account and consent Edge gateways |

The previous `MemberWorkspace` property creation and flat-rate booking screens are retired; those operations belong only to the newer Hosting Marketplace. Backend `member-workflows` also rejects the retired `create_property`, `book_property` and `respond_booking` actions. The unused frontend Stripe redirect handler has been removed.

## Acceptance and build gates

```bash
npm ci
npm run lint
npm run typecheck
npm run verify:frontend-contract
npm run verify:release
npm run test:hosting
npm run test:ui-controls
npm run test:ui-theme
npm run build
npm run smoke:supabase
```

The static contract check validates literal frontend action names against current Edge Function cases and rejects obsolete booking routes. **It cannot prove live account authorization, complete API payload compatibility, payment processing or DocuSign completion.** Real verified host/guest/admin and production provider sandbox tests remain required.

## UI principles

- Never show or infer exact property addresses in marketplace cards or public map markers.
- Clearly distinguish a quote, reservation request, provider payment confirmation and final payout.
- Make verification and provider readiness honest; never advertise disabled features as working.
- Preserve meaningful image alt text, keyboard focus, mobile tap targets, screen reader labels and reduced-motion preferences.
- Avoid fake success metrics or placeholders that look like real commerce data.
- Do not add new fonts or media from unapproved third-party CDNs.

## Deployment

The build compiles the UI from `src/supabase/bootstrap.jsx`. Railway and Docker require explicit Supabase URL and publishable browser key. Only those public values may be bundled; never include service-role, DocuSign or processor secrets in `VITE_*`.

The repository currently has no independently verified staging users. Do not call this code production certified until role-based acceptance, provider setup and operational checks pass.
