# Content Connect X

> **Enterprise readiness:** Not yet approved for enterprise production. See [verified repairs and remaining release blockers](docs/ENTERPRISE_AUDIT_2026-11-17.md). Run `npm run test:unit`; passing local/build tests is not provider acceptance or a complete security certification.

> **Current account-entry policy (2026-11-17):** New Content Connect X signups complete independent age verification once before entry. After admission, features do not impose additional age-verification or mandatory MFA gates. Two-factor enrollment is optional; a voluntarily enrolled factor still protects sign-in. Existing admin continuity is recorded separately from independent age evidence. See [account-entry policy](docs/ACCOUNT_ENTRY_AND_OPTIONAL_MFA.md). Older rollout/MFA descriptions below are historical.

Content Connect X is an age-verified professional collaboration platform for adult creators, studios, agents, photographers, videographers and production teams.

## Architecture

The application uses **React + Vite + Tailwind CSS**, with **Supabase Auth, PostgreSQL, Row Level Security, Storage, Realtime, Edge Functions and Cron**. There is one frontend and one backend. The default development and production builds use Supabase.

## Start

```bash
npm ci
npm run dev
```

## Validate

```bash
npm run lint
npm run typecheck
npm run build
npm run smoke:supabase
npm run test:readiness
npm run test:directory
npm run test:bolt-config
npm run verify:edge-imports
```

The smoke script checks authentication protection on deployed backend endpoints; it is not a substitute for end-to-end tests with verified users.

## Configuration

This GitHub repository is the source for the Bolt frontend, and Supabase is the only backend. The frontend's canonical project is `yxuqbygykpfbioslljlf`.

The browser is **pinned to the existing Content Connect X project** (`yxuqbygykpfbioslljlf`) even if Bolt injects a complete `VITE_SUPABASE_URL` and publishable-key pair for its separate, incomplete native database. The public project URL and safe **browser publishable key** are in `src/api/publicSupabaseConfig.mjs`, and different-project environment variables are ignored with a development-console warning. A *same-project* public key can still be supplied explicitly. No server/service-role credentials are bundled. After syncing into Bolt, restart its Vite preview/rebuild the site, and **sign back in to the original Supabase account**, because sessions from the duplicate database cannot be transferred between projects.

**Bolt's native database connection indicator is separate from the app's `@supabase/supabase-js` connection.** If Bolt's database panel still reports no Supabase project, reselect the existing project from Bolt's Database > Advanced > Connect Supabase controls. Do not create or claim a new Bolt database and do not overwrite the production Supabase project. A frontend source update cannot establish the Bolt account's OAuth authorization.

Never put service-role, `sb_secret_`, webhook secrets, ID documents, or medical information in browser variables or GitHub. Optional monitoring and UI experiments use `VITE_SENTRY_DSN` and `VITE_FLAGSMITH_ENVIRONMENT_ID`.

## Project layout

- `src/supabase/` — application screens, workflows and client integrations
- `src/api/supabaseClient.js` — the single Supabase client
- `supabase/functions/` — secure server-side operations
- `supabase/sql/` — database migrations, policies and constraints
- `supabase/PRODUCTION_MANAGER_IMPLEMENTATION.md` — current feature status and launch gates

## Release status

The frontend and database foundation compile. No complete authenticated multi-user acceptance suite has passed yet. Real document signing requires DocuSign setup and qualified review; paid subscriptions require an approved adult-industry merchant processor. Media publication and provider-backed clearance remain protected until their corresponding procedures are ready. A successful build is **not** production certification.

## Current creator directory and account recovery

Verified members can filter public directory results by display name, creator role, city and country. Age-gate and server-side subscription restrictions remain in force, free users see at most 12 result profiles, and premium results are paginated. Only explicitly public profile fields are returned. Account recovery sends a Supabase email link and requires a verified recovery session before a member can set a new password. Delivery, authenticated user flows and UI accessibility must still be tested against Bolt's actual deployment with the authorized Supabase redirect origin.

## Modular feature administration and PASS testing

The Bolt frontend keeps the separate desktop and mobile PNG hero assets unchanged. Member pages are individually gated by the server-backed `product_feature_flags` registry: Discovery, Search, Favorites, Connections, Collaborations, Testing, Contracts, Hosting, Production and more. Admins can control switches, tiers and rollout percentages in **Platform Controls**. The same admin console links API provider configuration, account security and medical-document review. Core verification, account access, privacy and consent withdrawal cannot be disabled.

The feature-switch migration `20261117122619_modular_feature_toggles_054.sql` is now applied to the established Supabase database; it is idempotent and preserves previously configured flags. Run `npm run test:modules`, then the usual lint, typecheck and build checks. Additional server acceptance testing is still necessary for every module; UI hiding is not an authorization boundary. Supabase remains the authority for protected API actions.

The Testing sidebar now mounts the existing `PassClearanceHub` module: private signed PDF/image uploads (10 MB max), human review, optional per-collaboration yes/no sharing, consent revocation, and PASS account-link requests. **PASS has no publicly documented partner API contract verified for this project.** Credentials can be vaulted through the admin integration panel, but automatic verification and production-hold monitoring are NOT enabled until PASS provides authorized API documentation and sandbox access. A PDF by itself never establishes an approved clearance. Check official PASS at https://www.passcertified.org/ and ask info@passcertified.org for partner integration details.

## Creator profile analytics and administrator previews

Admin roles are granted in the existing Supabase `account_security` table, never inferred from an email address in client code. The role-dashboard switcher is visible to administrators in both desktop sidebar and mobile drawer. Previewing another role changes the dashboard UI, **not** the account's actual role, age status, subscription or backend entitlements. Admin API operations still require AAL2 MFA and independent age verification.

Profile Analytics now records actual modal-open events in a private, RLS-protected `member_profile_view_events` table (one per age-verified viewer/profile/UTC day), excluding self views. The `profile-analytics` Edge Function returns owner-only aggregates and no visitor identities, IP addresses, medical records or other sensitive fields. Historical Base44 traffic cannot be recovered or invented. The migration was applied to the existing Supabase project; the function must be deployed with the site's updated version.

The Yoti provider remains disabled until you enter its **Yoti Hub API token and SDK ID**, configure the approved HTTPS return origins, and complete provider testing. The private ID/selfie manual review is separate and stays available; an age threshold result does not grant performer identity verification automatically.

## Mandatory adult onboarding, memberships and free access

The authenticated application now renders a standalone, non-dismissible onboarding panel before mounting ANY protected creator screen: first a minimal professional profile, then independent 18+ verification. The only early escape is Log out, with verification still required next login. Verified age is checked again in Supabase Edge Functions; hiding a page in React is not a substitute for backend authorization. The onboarding panel rechecks verification periodically and after Yoti returns. The existing ID/selfie evidence is private; only a qualified reviewer can approve a manual request, and an administrator cannot approve their own documents.

Yoti's authenticated OVER session result must return COMPLETE, a matching session/reference, a recognized method and an appropriate threshold. The verified result is recorded with provider method, reference ID, evidence ID and SHA-256 digest without storing raw biometric images in membership tables. Yoti credentials and the approved callback origin must still be configured before live checks can start. Provider age verification does not replace separate professional identity and consent checks.

Professional membership prices are stored in `membership_plan_catalog` and can be edited by independently age-verified MFA administrators. The Content Connect X pricing page excludes the separate OnlyHost Host role. Role prices: Creator $19.99, Photographer $29.99, Videographer and Video Editor $49.99, Agent $49.99 (10), $99.99 (25), $249.99 (100+), Studio from $249.99 monthly. Higher agent prices are configurable proposals.

Free members may browse and save age-verified profiles worldwide, but new outgoing contacts are limited to five distinct people during a rolling seven days and within 25 miles, based on configured **city centers** rather than household coordinates. If city coordinates are unavailable, the backend permits same-city interactions only; this is an approximation and not a physical distance/identity verification service. Each accepted direct contact uses a transactional per-user quota reservation to prevent concurrent requests exceeding five. Group chat and full global contact require Premium, and private social links are disclosed through a protected API only to verified premium users when the profile owner opts in. Core safety and antispam restrictions remain for all tiers.

**Payments are not enabled.** Stripe currently prohibits adult content/services. Prices and a secure admin pricing editor are implemented, but charging and granting premium status require an adult-industry-approved merchant contract, verified subscription webhooks, and successful payment lifecycle tests. Do not mark users premium merely because they selected a plan.

The existing Supabase migrations `20261117132004_membership_catalog_age_evidence_free_contacts.sql` and `20261117132747_member_social_links_opt_in.sql` are applied. Run `npm run test:memberships`, lint, typecheck and build before promoting frontend releases.

## Hands-on tests before launch

The production configuration console is restricted to independently age-verified MFA administrators. It shows provider prerequisites and missing server settings without exposing credentials; a configured provider is not proof of a working provider transaction. Follow [the at-home acceptance test matrix](ops/AT_HOME_TEST_MATRIX.md), capture the tested commit SHA and use a dedicated staging environment for any test data.

## Production location marketplace

The private age-gated Hosting Marketplace supports filtered venue discovery, galleries, favorites, hourly booking requests, host dashboards, image moderation, protected addresses and entry instructions, availability buffers, turnovers and guest reviews. See [hosting implementation](supabase/HOSTING_MARKETPLACE.md). Requests do not process payments, and listings require human approval.


## Identity provider integration controls

The **Integrations** area is available to independently age-verified administrators with MFA (AAL2). API credentials are stored server-side using Supabase Vault and are never returned to the browser. In **Verification**, users can start a Yoti hosted age-threshold check, or use the private ID-and-selfie review fallback.

Yoti needs **both** the API token and SDK ID, a trusted HTTPS Content Connect X return origin, administrator activation and real provider testing. OnlyHost uses a separate explicitly configured HTTPS return origin and **never** falls back to the Content Connect X website. Successful Yoti age threshold results do **not** automatically approve creator identity or protected access. The UI polls the provider after return and keeps independent document/identity review as a separate requirement.

The **Trust & Readiness** area supports voluntary PASS link requests, per-collaboration binary clearance sharing with revocation, and private uploaded evidence reviewed by separate staff. An official PASS partner API is not connected; no clinical reports are exposed to collaboration partners.

Run `npm run test:integrations` for brand return-origin, HTTPS safety and credential-readiness tests. Those tests exercise local policy; authenticated multi-user, provider sandbox and record-retention acceptance tests remain required before enabling live provider operations.
