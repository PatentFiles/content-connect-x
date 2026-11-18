## Public homepage styling boundary — November 18, 2026

The logged-out Content Connect X and Host Connect pages retain their original dark/neon branding, original hero artwork, gradients and responsive layout. The professional white redesign applies **after sign-in**, including member, administrator, verification and host workspaces. Do not replace public artwork or apply workspace CSS globally.

The public skin is restored from commit `21b95435a02e9e1e6ddc10e8805f377bf4b9a67d`. `authAppearance.js` follows the actual Auth session and changes presentation only. Every theme selector is scoped to either public or non-public appearance, with original specificity preserved via `:where()`. This cannot grant admission or bypass any backend rule. Signing out restores public styling and clears the Host workspace display.

Regression tests verify all three original asset hashes, every CSS scope, real image decoding at mobile/desktop sizes, and real component sign-in/sign-out transitions using isolated Auth fixtures. Existing white-workspace/modal, identity and account-access tests remain in place. Bolt is still the website host; no Supabase or Railway deployment is needed for this presentation fix.

# Professional white-interface refresh — November 18, 2026

## Scope

Presentation-only update for Content Connect X and Host Connect. White page backgrounds; charcoal headings and primary actions; restrained secondary controls; readable form boundaries and status states; quiet cards; consistent dialogs, menus, mobile layout and browser/PWA colors. Public neon hero artwork is replaced by accessible text and an explicitly descriptive workspace overview. Existing source artwork is retained but not displayed as the hero or authentication backdrop. The owner-selected white interface remains white with an OS dark preference; the inconsistent old light/dark toggle is removed.

No database/schema, age-verification admission, provider credentials, MFA policy, billing, membership entitlement, ownership, private-address, consent or API mutation logic is changed. No fabricated user statistics are introduced by the new public overview. No external design/image/font dependency is added. Existing actual property photos, galleries, tours and avatar uploads remain functional and are not recolored.

## Shared implementation

- Semantic tokens: `src/globals.css`.
- Shared final presentation: `src/supabase/professional-theme.css`.
- Layout preserved in brand, host and marketing CSS; old neon color definitions converted to tokens.
- Existing JSX screens use semantic light colors at source, instead of universal CSS inversion or unreliable style-attribute selectors.
- Existing checkbox/action-row geometry and keyboard/focus protections are retained.
- Destructive actions remain red/white; error and success text remains distinguishable; dark photo/video scrims remain intentional.
- Header/public hero markup: `ProfessionalLandingHero.jsx`; public authentication and pricing; original signed-in shell; Host Connect landing and marketplace heading.

## Validation

166 offline tests (including six light-theme regression tests), shared control geometry, actual six-role component rendering, Yoti onboarding fixtures, lint/typecheck/build and frontend/backend contracts are checked before handoff. The new `test:ui-theme` script mounts actual source components with isolated account/API fixtures for 42 browser checks across 320, 390, 768 and 1440 pixels: both public landing pages, login, signup, pricing, collaborations, host dashboard, new-space and default-rule modals, and all six role dashboards. It checks a white/light background despite OS dark preference, consistent readable solid buttons, light card/dialog surfaces, no horizontal page overflow, and no runtime errors. New-space and default-rule actions are exercised, including Escape to close.

The token tests check ordinary text at 4.5:1 contrast on white/subtle surfaces and visible focus against white. Shared controls also test enlarged text. This is not a complete accessibility certification or an authenticated customer/provider acceptance test. Screenshots of role metrics are explicitly isolated test-account fixtures, not production analytics.

## Publishing

Sync the final GitHub main commit into Bolt, rebuild and publish the frontend. No Supabase migration or Edge Function deployment is required. A cached/old frontend will still show the previous appearance until the matching bundle is published. The existing bundle-size warning and wider operational/provider readiness limitations are outside this visual change.
