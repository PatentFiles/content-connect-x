# Content Connect X frontend system

## Brand and visual direction

The application intentionally uses the color palette from the homepage hero:

| Token | Color | Use |
|---|---|---|
| `--ccx-fuchsia` | `#E900C5` | Primary identity and hero highlights |
| `--ccx-pink` | `#FF49B6` | Supporting accents, navigation and focus |
| `--ccx-blue` | `#4F8CFF` | Interactive detail and gradient completion |
| `--ccx-ink` | `#090C19` | Dark page substrate |
| `--ccx-gradient` | Fuchsia → pink → blue | Primary actions and brand strokes |

**Use these shared styles instead of inventing a different button palette:**

- `ccx-app` — dark workspace shell and color tokens.
- `ccx-brand-topline` and `ccx-shell-header` — branded sticky application header.
- `ccx-primary` and `ccx-action-primary` — accessible branded call-to-action.
- `ccx-secondary`, `ccx-nav-pill` and `is-active` — action and navigation surfaces.
- `ccx-surface`, `ccx-module-card` and `ccx-stat-card` — dashboard and module cards.
- `ccx-hero` and `ccx-login-art` — the existing image `public/Content_Connect_Hero_Banner.png`, cropped responsively under a dark gradient overlay.
- `ccx-hosting-banner` — related fuchsia/pink/blue treatment without repeating a full photo.

All definitions live in `src/supabase/brand-theme.css`, imported in `src/supabase/bootstrap.jsx`. The dashboard home is `src/supabase/DashboardHome.jsx`, rendered by `src/supabase/SupabaseApp.jsx`.

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
