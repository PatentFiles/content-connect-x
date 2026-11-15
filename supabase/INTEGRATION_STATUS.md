# Content Connect X — GitHub integration implementation register

Updated 2026-11. Repository: `PatentFiles/content-connect-x`. Supabase project: `yxuqbygykpfbioslljlf`.

## Source strategy

The user requested integration of ten upstream open-source projects. We have **not** merged their entire repositories into one site: that would duplicate user authentication and payment logic, add multiple incompatible backend frameworks, and create overlapping security boundaries. Instead, selected features have been adapted into native React/Vite + Supabase services and SQL schemas. Source links indicate implementation references; do not claim code was copied without verified provenance.

| Source | Selected capabilities implemented in Content Connect X | Still missing or external dependency |
|---|---|---|
| [Documenso](https://github.com/documenso/documenso) | Signed-envelope evidence model, separate consent, immutable contract terms and a private completed-document archive design | Formal provider is **DocuSign** per product decision. A DocuSign developer account, templates, OAuth, Connect webhook, certificate download, attorney-reviewed releases and signed end-to-end verification are still required. **Internal prototype signing is disabled.** |
| [Cal.diy](https://github.com/calcom/cal.diy) | City/date availability, shoot/studio windows, timezone handling, overlap search, member visibility and iCalendar export | Cal.diy is a separate Next.js/Prisma app; Cal.com-managed booking accounts, Google/Outlook OAuth sync, automatic availability reminders and payment collection are not connected. |
| [Cradle](https://github.com/olukareem/cradle) | RLS-authorized `postgres_changes` realtime private messaging, persisted unread cursors, membership-based channel filtering | Private typing/presence and push/email delivery remain missing; public broadcast channels are deliberately not used. Cradle is a Next.js app, not installed wholesale. |
| [Flagsmith](https://github.com/Flagsmith/flagsmith) | Supabase server-authoritative feature flags, percentage rollout and free/premium audience targeting; `@flagsmith/flagsmith` optional client installed | No external Flagsmith project/environment ID connected yet. Browser SDK can only influence *UI experiments*, not entitlement enforcement. |
| [Sentry](https://github.com/getsentry/self-hosted) | Pinned `@sentry/react` client, optionally activated with `VITE_SENTRY_DSN`; sanitizes captured event fields and omits session replay | No Sentry organization/DSN configured and no production event delivery verified. Self-hosted Sentry infrastructure has not been deployed. |
| [Agora](https://github.com/agora-oss-org/agora-server) | Moderated text post feed, comments, reactions, age-verified readership | Agora SDK, semantic search and its additional social-graph backend have not been deployed. |
| [Orbit Social](https://github.com/codecastillo/orbit-social) | Creator following, private moderated media gallery, connection-based visibility | Full groups, profile media portfolios, community events and independent federation are not installed. |
| [OpenCalendar](https://github.com/kudretyilmazz/opencalendar) | Scheduling windows, overlap matching and iCalendar export | External calendar account sync and bidirectional calendar OAuth are not implemented. |
| [OpenModerate](https://github.com/karammm/openmoderate-image-moderation) | Backend adapter for configured private HTTPS `/v1/moderate` service; manual approval required, media stored privately | No Python Docker/GPU service or `OPENMODERATE_SERVICE_URL` and `OPENMODERATE_API_KEY` configured. Video scanning requires a separate worker; AI cannot verify age or consent. |
| [Fider](https://github.com/getfider/fider) | Feature ideas, voting, member request board, admin statuses | Does not run the external Fider service. Internal Supabase service is implemented instead. |

## Privacy and eligibility boundaries

- Every user must be independently age verified; admins cannot approve themselves.
- Verified free users can read moderated posts, submit feature ideas/votes, react and access limited discovery.
- Premium creators can list availability, publish posts for review, comment, connect/messsage, and submit private media for manual review.
- Signed contracts and media-use permissions remain separate from consent. Consent withdrawal survives subscription cancellation.
- Private media, ID records, STI clearance details and background reports must never be sent to general analytics or public channels. Media approval is additionally blocked unless the trusted server setting `ADULT_MEDIA_PUBLICATION_READY=true` is set after approved release/retention procedures; member private uploads and review requests remain available for staging.
- An OpenModerate classifier is **not** proof that a person is 18+, that content is consensual, or that publication is permitted.
- Feature flags are *not* authorization; signed-in endpoints enforce age, bans and actual subscription statuses in Supabase.

## Running the Bolt preview

1. Import the GitHub repository into Bolt.
2. Execute `npm ci` and `npm run dev:supabase`.
3. The public URL and publishable key for Content Connect X are configured as a development fallback in `src/api/supabaseClient.js`. Override with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Bolt environment.
4. For optional services, configure `VITE_SENTRY_DSN` and `VITE_FLAGSMITH_ENVIRONMENT_ID`; these are public client identifiers, never secret keys.
5. Configure Supabase Auth redirect URLs for your actual Bolt preview origin and production domain.
6. **Do not activate formal signing or payment until DocuSign and an adult-industry-approved merchant processor have approved and been configured.** No provider secret should be committed to GitHub.
7. Run `npm run typecheck:supabase`, `npm run lint`, and `npm run build:supabase`.

## Launch blockers

- Supabase project had no auth users at the most recent inspection. Authenticated two-account/role end-to-end tests have NOT passed.
- A first independently age-verified administrator must be provisioned through trusted controls without self-approval.
- No existing Base44 accounts or media have been migrated. The legacy frontend still has a separate typecheck backlog.
- No DocuSign access, approved merchant payments, external age provider, clinical clearance provider, optional background-screening provider, hosted OpenModerate service, or production Sentry/Flagsmith organizations are connected.
- Media rights/recordkeeping, international privacy, moderation escalation, content appeals, retention and adult-industry policies need reviewed production procedures.
- The older Base44/Vite dependency tree still has 10 npm audit advisories (7 moderate, 2 high and 1 critical) after safe nonbreaking updates have been applied. Its critical jsPDF dependency and other breaking upgrades require a separate compatibility-tested remediation.
- The current UI is a Supabase-only preview shell; the original full Base44 visual site has not been completely migrated.

## Verification evidence

- Project migrations `012_community_scheduling_feedback_flags.sql` through `015_media_rights_gating.sql` applied in Supabase.
- `platform-extras`, `media-gateway`, `member-workflows` and `integration-health` Edge Functions deployed.
- Realtime publication includes private `public.messages`, governed by RLS.
- Strict Supabase typecheck, eslint and Vite build pass locally.
- Successful deployment and a 401 from unauthenticated API probes are **not** equivalent to successful multi-user acceptance tests.

## November 2026 production workflow expansion

New Supabase modules include private production teams, capacity-checked events, in-app Cron reminders, protected creator bookings, grouped messaging with realtime presence, moderated collaboration completion and reputation, confidential case reviews, TOTP MFA and DocuSign draft packet routing. See [PRODUCTION_MANAGER_IMPLEMENTATION.md](./PRODUCTION_MANAGER_IMPLEMENTATION.md). These features are not yet authenticated end-to-end tested.
