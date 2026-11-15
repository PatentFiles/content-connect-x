# Supabase deployment and operations

**Supabase is the only application backend.** There is no alternate runtime, SDK, or dual-provider mode.

## Local development

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
```

Use `npm run smoke:supabase` to confirm deployed authenticated Edge Functions reject anonymous requests.

## Configuration

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your deployment. Both are public browser configuration values. Keep any Supabase secret and service-role keys entirely on the server. Supabase Auth redirect URLs must include the deployed application origin.

The PostgreSQL schema is represented by `supabase/sql/`. All exposed application tables use RLS; sensitive writes use Edge Functions with database-backed account and membership checks. Signed agreements and private ID/media are stored in private buckets.

## Operational boundaries

- All users, including administrators, require independent age verification.
- Free and premium entitlements are checked server-side.
- Admin privileged functions require a second authentication factor.
- Agreements use DocuSign, not a local imitation of a signature.
- Production release requires an adult-industry-approved payment processor, external vendor configuration, and verified document/consent retention.
- A privacy-preserving work-clearance status is not an individual medical test result.
- Media approval stays disabled until the required human review and publication procedures exist.

## Testing and launch

The Supabase frontend passes lint, JavaScript/TypeScript validation, and Vite production build. Authenticated tests with several independently verified test accounts, provider sandbox signing, billing, rights handling, booking conflicts, consent withdrawal and media moderation still need to pass before public production release.

Read [PRODUCTION_MANAGER_IMPLEMENTATION.md](./PRODUCTION_MANAGER_IMPLEMENTATION.md), [DOCUSIGN_INTEGRATION.md](./DOCUSIGN_INTEGRATION.md), [INTEGRATION_STATUS.md](./INTEGRATION_STATUS.md) and [PRODUCT_SECURITY_ROADMAP.md](./PRODUCT_SECURITY_ROADMAP.md) for implementation status.

## Location rentals

See [HOSTING_MARKETPLACE.md](./HOSTING_MARKETPLACE.md) for the Supabase-only Airbnb-style discovery, host operations, booking integrity, private media and turnover workflows. No external rental-provider authentication or payments are introduced.
