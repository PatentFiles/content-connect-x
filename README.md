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
```

The smoke script checks authentication protection on deployed backend endpoints; it is not a substitute for end-to-end tests with verified users.

## Configuration

The browser receives only a Supabase URL and publishable key through `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put a service-role key in browser variables. Optional monitoring and UI experiments use `VITE_SENTRY_DSN` and `VITE_FLAGSMITH_ENVIRONMENT_ID`.

## Project layout

- `src/supabase/` — application screens, workflows and client integrations
- `src/api/supabaseClient.js` — the single Supabase client
- `supabase/functions/` — secure server-side operations
- `supabase/sql/` — database migrations, policies and constraints
- `supabase/PRODUCTION_MANAGER_IMPLEMENTATION.md` — current feature status and launch gates

## Release status

The frontend and database foundation compile. No complete authenticated multi-user acceptance suite has passed yet. Real document signing requires DocuSign setup and qualified review; paid subscriptions require an approved adult-industry merchant processor. Media publication and provider-backed clearance remain protected until their corresponding procedures are ready. A successful build is **not** production certification.

## Production location marketplace

The private age-gated Hosting Marketplace supports filtered venue discovery, galleries, favorites, hourly booking requests, host dashboards, image moderation, protected addresses and entry instructions, availability buffers, turnovers and guest reviews. See [hosting implementation](supabase/HOSTING_MARKETPLACE.md). Requests do not process payments, and listings require human approval.


## Identity provider integration controls

The **Integrations** area is available to independently age-verified administrators with MFA (AAL2). API credentials are stored server-side using Supabase Vault and are never returned to the browser. In **Verification**, users can start a Yoti hosted age-threshold check, or use the private ID-and-selfie review fallback.

Yoti needs **both** the API token and SDK ID, a trusted HTTPS Content Connect X return origin, administrator activation and real provider testing. OnlyHost uses a separate explicitly configured HTTPS return origin and **never** falls back to the Content Connect X website. Successful Yoti age threshold results do **not** automatically approve creator identity or protected access. The UI polls the provider after return and keeps independent document/identity review as a separate requirement.

The **Trust & Readiness** area supports voluntary PASS link requests, per-collaboration binary clearance sharing with revocation, and private uploaded evidence reviewed by separate staff. An official PASS partner API is not connected; no clinical reports are exposed to collaboration partners.

Run `npm run test:integrations` for brand return-origin, HTTPS safety and credential-readiness tests. Those tests exercise local policy; authenticated multi-user, provider sandbox and record-retention acceptance tests remain required before enabling live provider operations.
