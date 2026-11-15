# Content Connect X — Railway staging deployment

This repository now builds a non-root static Nginx container for the **Supabase-only** frontend. It is prepared for staging; the commercial service is **not yet approved for production**.

## Build-time environment

Set these two **public** variables on the Railway service before deployment:

- `VITE_SUPABASE_URL`: complete HTTPS URL for the intended Supabase project.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: that same project's **publishable** browser key.

The Dockerfile deliberately refuses to build with either variable empty. The React application no longer silently falls back to a different Supabase project.

Optional browser-exposed settings: `VITE_SENTRY_DSN`, `VITE_FLAGSMITH_ENVIRONMENT_ID`, `VITE_HOSTING_MAP_TILE_URL` (licensed tile provider), `VITE_HOSTING_PUSH_PUBLIC_KEY`. These values are compiled into public JavaScript and are **not secrets**. Never add service-role, CCBill or DocuSign credentials to `VITE_*` variables.

Railway Dockerfile builds match service variables to the Dockerfile `ARG` names. The container uses an Nginx unprivileged runtime with `PORT` defaulting to 8080; Railway's dynamic PORT can override it. Its process health check is `/healthz`.

## Safe staging procedure

1. Create a **dedicated Content Connect X staging** Railway project/environment, not an unrelated project. No domain migration is required to test this.
2. Attach `PatentFiles/content-connect-x`, `main`; deploy only after GitHub quality gate is green.
3. Set the public build variables for a staging Supabase project or approved isolated staging setup. Keep live production secrets separate.
4. Configure Supabase Auth redirect allowlist to the staging Railway HTTPS URL.
5. Test `https://<staging-host>/healthz` for 200 and SPA deep links for fallback behavior. Then test login, age checks, RLS, file uploads, realtime and all restricted pages.
6. Do not activate financial release flags, send real DocuSign envelopes, or publish content merely because the container is healthy.
7. Capture the deployed Git SHA, error-monitoring baseline, smoke test results and rollback SHA.
8. Only after independent business and security review, provision production settings, enable production branch protection and make a separate DNS cutover plan.

## Container defaults

- Two-stage Docker build; Vite output only, no Node build dependencies in runtime image.
- Unprivileged Nginx static server, SPA routing and health probe.
- No-store HTML, immutable versioned assets, basic security headers and no origin-specific backend proxy.
- All identity, signing, payment, upload and private-data operations go directly to Supabase-backed authenticated Edge Functions.

## Not provided by a healthy container

Merchant approval, provider sandbox certification, documented payout and refund settlement, age verification of test users, reviewed adult-content releases, backup restore drills and production incident staffing. See [Enterprise launch runbook](../ops/ENTERPRISE_RELEASE_RUNBOOK.md).

Current Railway account inventory was checked without creating a service. The only visible existing project was not named Content Connect X, so it was deliberately left unchanged.
