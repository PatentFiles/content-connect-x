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
