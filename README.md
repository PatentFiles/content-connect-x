# Content Connect X

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

The browser prefers a COMPLETE, matching pair of `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY` (legacy `VITE_SUPABASE_ANON_KEY` is also supported). To restore Bolt preview when environment variables are missing, `src/api/publicSupabaseConfig.mjs` contains the verified project URL and its **public publishable browser key** as a safe fallback. No user data or server secret is placed there. A partial environment pair pointing at a different project is rejected rather than silently mixing credentials. If the browser configuration changes, restart the Bolt Vite preview or rebuild the published site; Vite replaces environment variables at build time.

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

## Hands-on tests before launch

The production configuration console is restricted to independently age-verified MFA administrators. It shows provider prerequisites and missing server settings without exposing credentials; a configured provider is not proof of a working provider transaction. Follow [the at-home acceptance test matrix](ops/AT_HOME_TEST_MATRIX.md), capture the tested commit SHA and use a dedicated staging environment for any test data.

## Production location marketplace

The private age-gated Hosting Marketplace supports filtered venue discovery, galleries, favorites, hourly booking requests, host dashboards, image moderation, protected addresses and entry instructions, availability buffers, turnovers and guest reviews. See [hosting implementation](supabase/HOSTING_MARKETPLACE.md). Requests do not process payments, and listings require human approval.


## Identity provider integration controls

The **Integrations** area is available to independently age-verified administrators with MFA (AAL2). API credentials are stored server-side using Supabase Vault and are never returned to the browser. In **Verification**, users can start a Yoti hosted age-threshold check, or use the private ID-and-selfie review fallback.

Yoti needs **both** the API token and SDK ID, a trusted HTTPS Content Connect X return origin, administrator activation and real provider testing. OnlyHost uses a separate explicitly configured HTTPS return origin and **never** falls back to the Content Connect X website. Successful Yoti age threshold results do **not** automatically approve creator identity or protected access. The UI polls the provider after return and keeps independent document/identity review as a separate requirement.

The **Trust & Readiness** area supports voluntary PASS link requests, per-collaboration binary clearance sharing with revocation, and private uploaded evidence reviewed by separate staff. An official PASS partner API is not connected; no clinical reports are exposed to collaboration partners.

Run `npm run test:integrations` for brand return-origin, HTTPS safety and credential-readiness tests. Those tests exercise local policy; authenticated multi-user, provider sandbox and record-retention acceptance tests remain required before enabling live provider operations.
