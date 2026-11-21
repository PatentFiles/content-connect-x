# Host Connect X — standalone website extraction

This is the existing Host Connect site, extracted from Content Connect X without recreating the UI.

## Deployment model
- Host Connect X domain: https://hostconnectx.com
- Content Connect X domain: https://contentconnectx.com
- Original source repository: https://github.com/PatentFiles/content-connect-x
- Prepared extraction branch: `host-connect-x-extraction`
- Existing frontend: `src/supabase/OnlyHostApp.jsx`, `HostingMarketplace.jsx`, hosting dashboards and related components.
- Frontend entrypoint: `src/supabase/bootstrap.jsx`. It boots Host Connect X for `/` and all website paths. Trust/support routes are retained separately.
- Frontend appearance: existing Host Connect public imagery and signed-in brand styling, not regenerated assets.
- Host Connect X must have its **own Supabase project** and backend deployments. The browser fails closed if its URL/key are missing or still point to the Content Connect X production Supabase project.

## GitHub → Bolt
1. Create a new GitHub repository named `host-connect-x` under `PatentFiles`. **Import the existing public repository**, not a starter scaffold. GitHub → Import a repository: source `https://github.com/PatentFiles/content-connect-x.git`, destination `PatentFiles/host-connect-x`.
2. Confirm that the `host-connect-x-extraction` branch was imported. Set it as the default branch in the new repository (Settings → Branches → Default branch) and rename it to `main` when ready. If the importer does not copy the branch, use Git on your computer to fetch and push it from the source repository—do not overwrite the existing Content Connect X default branch.
3. In Bolt choose Import from GitHub and select `PatentFiles/host-connect-x`. No new design is necessary.
4. Connect the already-purchased `hostconnectx.com` domain only after staging passes.

## Supabase (REQUIRED BEFORE PUBLISHING)
1. Create a NEW Supabase project called **Host Connect X**. This is not the current Content Connect X project `yxuqbygykpfbioslljlf`.
2. Configure Bolt's public build environment with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the **new Host Connect X project**; never use secret/service-role keys in browser variables.
3. Configure redirect URLs and email confirmation for `https://hostconnectx.com` and `https://www.hostconnectx.com`.
4. Do not point the extracted standalone Host app to the old CCX database to bypass onboarding. That would violate independent account ownership.
5. **Database migration is NOT complete.** The existing combined Supabase backend has properties, bookings, host authority proofs, subscriptions, notifications, cleaning, and identity-linked permissions. Migration requires careful table dependency analysis, tenant/user ID mapping, protected Storage migration, Edge Functions, webhooks, RLS, and validation. Do not copy auth passwords or biometric records casually.
6. Do not launch signups or take bookings until the Host-specific backend and its RLS have been deployed and tested.

## Cross-marketplace integration (NOT YET LIVE)
- Host Connect X will own property inventory and the canonical booking calendar.
- Content Connect X will request listings, availability, quote and booking operations through authenticated, authorized server-to-server APIs; never connect the CCX browser directly to a host database admin key.
- Account linking between two separate Supabase Auth projects should use a secure federation/OIDC flow or explicit verified account linking. Email equality alone is not proof of ownership, and shared passwords must not be copied between projects.
- Existing bookings need a verified old-to-new account mapping before records move. Prevent duplicates, preserve cancellation/refund/audit history, and treat venue addresses as sensitive information.
- Booking requests are not completed payments or confirmed reservations. CCBill and DocuSign remain dependent on approved integration and webhook validation.
- Never deploy production hardware locks or cleaning PINs before approved device integrations, revocation and offline recovery are tested.

## Safe checks
```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
node --test tests/host-standalone-config.test.mjs
```

## Current status
Prepared GitHub branch and standalone frontend bootstrap: **yes**.
New independent GitHub repository: **needs GitHub Import action**.
Host Connect X Supabase project and migration: **not created/deployed**.
Cross-site account linking and booking API: **not deployed**.
