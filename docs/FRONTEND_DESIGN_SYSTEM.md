# Content Connect X frontend system

## Appearance boundary — November 18, 2026

**Logged out: preserve the original public branding. Signed in: use the professional white interface.** This rule applies to Content Connect X and Host Connect and supersedes the earlier refresh's incorrect public-page scope.

Public homepages retain their dark/neon palette, gradients, navigation treatment, feature-card styling and original artwork. Do not replace or recolor these assets:

- Desktop Content Connect: `public/content_conect_hero.png`.
- Mobile Content Connect: `public/ContentConnectX__Create,_Collaborate,_Grow.png`.
- Host Connect: `public/Host_Connect_Banner.png`.

The public styles were restored from `21b95435a02e9e1e6ddc10e8805f377bf4b9a67d`, immediately before the white refresh. The original image bytes are preserved. Content Connect uses its original responsive picture breakpoint of 640 px. Both heroes retain accessible headings and image alternatives.

`src/supabase/authAppearance.js` follows the actual Auth session in both applications. It changes `data-ccx-appearance`, the dark class and browser chrome before paint. It does not use a URL, operating-system preference or saved theme as the authority, and never grants account admission. Signing out restores public appearance; Host Connect also clears stale workspace presentation.

Every restored CSS selector in `public-brand-theme.css` requires public appearance. Every refreshed selector in the other theme files excludes it. The `:where()` gate preserves the original selector specificity. Keep these scopes on all future additions. Shared control geometry remains global so keyboard labels and touch targets continue working in both skins. Do not add a later unscoped theme that overrides this boundary.

## Signed-in visual system

Member, administrator, identity-verification and host workspaces retain the professional white design. Public neon restrictions do not apply to the original marketing artwork; conversely, public gradients and glow must not leak into signed-in controls.

| Token | Value | Purpose |
|---|---|---|
| `--cc-bg`, `--cc-surface` | `#FFFFFF` | Workspace page and card surfaces |
| `--cc-surface-subtle` | `#F6F7F9` | Secondary regions |
| `--cc-text-primary` | `#202938` | Headings and body text |
| `--cc-text-secondary` | `#4F5D70` | Supporting text |
| `--cc-text-muted` | `#5E6B7E` | Captions |
| `--cc-action` | `#243247` | Solid primary actions |
| `--cc-on-action` | `#FFFFFF` | Primary-action labels |
| `--cc-border` | `#DDE2E8` | Dividers |
| `--cc-input-border` | `#8894A5` | Input boundaries |
| `--cc-focus` | `#245BA3` | Keyboard focus |

Use `ccx-primary`, `ccx-action-primary` and `oh-primary` for primary actions; `ccx-secondary` and `oh-secondary` for secondary actions; `ccx-surface` and `oh-panel` for cards. Keep restrained status colors and readable photo overlays. Never invert images or apply a universal text-color override. `ProfessionalLandingHero` may still serve signed-in Host account setup; it is not the logged-out homepage hero.

## Frontend and backend route ownership

| User experience | Frontend | Supabase API |
|---|---|---|
| Dashboard and identity status | `DashboardHome`, `SupabaseApp` | Auth, profile and server-owned member state |
| Production team/event work | `ProductionManager` | `production-manager` |
| Private collaborations, chat, consent | `MemberWorkspace`, `ConsentCenter` | `member-workflows`, `collaboration-consent` |
| Creator discovery | `CreatorDiscovery` | `directory` |
| Community, feedback, availability | Corresponding `*Hub` screens | `platform-extras` |
| Location marketplace, booking and admin operations | Hosting screens | `hosting-marketplace`, `hosting-advanced`, `hosting-operations` |
| Equipment, map, crew and calendar | Hosting management screens | `hosting-advanced`, `hosting-production`, `hosting-calendar` |
| Verified rental agreements | `HostingBookingOperations`, `AgreementPackets` | `hosting-docusign`, `agreement-packets` |
| Approved hosted checkout | `HostingBookingOperations` | `hosting-ccbill`, subject to provider gates |
| Account trust and safety | Security, trust and identity screens | Authenticated account/consent/identity gateways |

Retired property creation and flat-rate booking actions in `member-workflows` must not be restored. This presentation repair changes no backend admission, consent, identity, billing or property-authority policy.

## Validation

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:ui-controls
npm run test:ui-theme
node scripts/test-identity-onboarding-browser.mjs
npm run verify:frontend-contract
npm run verify:release
npm run verify:edge-imports
npm run build
```

`tests/public-branding.test.mjs` checks original asset hashes and every theme scope. The browser appearance suite renders actual components, serves actual repository artwork from a loopback-only asset server, decodes both responsive heroes, and checks 320/390/768/1440 px layouts. It drives Host sign-in/sign-out through an isolated Auth subscription and retains white member/host dashboard and modal checks. These are UI fixtures, not live account or biometric acceptance tests.

Preserve image alternatives, semantic headings, keyboard focus, mobile tap targets and reduced-motion preferences. Never expose exact property addresses, private identity evidence or server credentials through public presentation. Do not invent activity metrics or show disabled provider operations as successful.

## Deployment

**Bolt remains the website host.** Merge tested changes into the repository's `main`, then synchronize and publish the existing Bolt project. Railway runs identity computation/cleanup only; do not migrate the website or change its domain. This repair needs no Supabase migration or Edge Function deployment and does not modify Railway services.

No service-role key or other server credential may be bundled in `VITE_*`. Passing visual/build checks is not production, payment-provider or biometric certification. See `docs/PUBLIC_HOMEPAGE_RESTORATION.md` for the restoration record.
