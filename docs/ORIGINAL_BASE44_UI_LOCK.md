# Content Connect X — Original UI lock and Supabase migration contract

## Canonical frontend reference
- Original pre-Supabase source: commit `00640e05b91478d544dd590084a3f423bf52a47e`
- Permanent reference branch: `reference/original-base44-pre-supabase`
- Current restoration branch: `restore/original-role-shell-supabase`

**No frontend redesign is authorized.** The user requested a Base44-to-Supabase
backend migration, while retaining the original appearance, navigation, data
entry and role-specific workflows.

### Visual contract
Keep the original desktop 64px top header and 256px left sidebar; dark/light
theme variables in `src/globals.css`; icon/nav structure; mobile hamburger,
slide-out drawer, and five-item bottom navigation; original responsive spacing,
profile banners, avatars, tabs, page sections and status badges. Preserve
original labels/routes and user paths.

The **only approved visual departures** are the user-provided desktop and
mobile hero images. Do not independently restyle profiles, dashboards, forms,
cards, calendars or messaging.

### Full role matrix
Creator, Agent, Studio, Photographer, Videographer, Video Editor, Host.
Admins also retain the existing role-preview switcher.
- Legacy roles from `src/components/utils/roleNavConfig.jsx`
- New renderer in `src/supabase/originalRoleNav.jsx` and
  `src/supabase/OriginalShell.jsx`.
- Role-specific dashboards in `src/supabase/OriginalRoleDashboard.jsx`.
- Supabase `member_profiles.role_type` supports all seven.

### Platform and backend
- Supabase Auth, Postgres/RLS, Edge Functions, realtime, storage, provider
  integrations and feature flags are the sole application backend.
- No `@base44/sdk`, Base44 entity reads, or Base44 production functions.
- Retain all existing host migrations, transactional booking, calendar syncing,
  advanced pricing, equipment, workforce, suitability, settlement and compliance.
- Retain the OnlyHost shared-inventory brand, DocuSign, verified identity, consent,
  messaging and completion/earnings services.
- Never re-enable unsafe UI-only authorization, raw private file URLs,
  client-side payment charging, or mock signature flows.

### Original public pages and protected routes
Retain original Landing, HowItWorks, Pricing, FAQ, Terms, Privacy, Dashboard,
Discovery, Search, Favorites, Connections, Messages, Collaborations,
CreateCollaboration, CollaborationDetail, Contracts, ViewContract, Testing,
Verification, Profile, ViewProfile, Settings, Portfolio, Representation,
RosterPortfolio, AvailabilitySchedule, TravelSchedule, Notifications,
HostingMarketplace, HostDashboard, HostProfile, HostSettings, PropertyDetail,
and administration/verification controls.

Restore complete functionality, not just routes. Each old screen must be
mapped to a working Supabase entity/function and visually compared with the
original. No navigation destination should silently land on an unrelated module.

### Migration ledger
- 001–050: existing Supabase and hosting migration history; leave intact.
- 051: owner-private member preferences and creator favorites, dungeon venue type.
- 052: original Host profile role.
- 053: private original CreatorDetails scene/act/positioning/compensation fields.
- Updated directory function preserves age verification, subscription visibility,
  hard bans and opt-in sensitive preference filters.

### Acceptance gate
1. Desktop and mobile visual diffs against the original checkpoint for every role.
2. Original navigation URL, back/forward, sidebar, mobile tabs, forms and colors.
3. Real authenticated multi-account read/write tests for each role, including
   host and guest bookings, creator favorites, messaging, collaboration rooms,
   private creator options and admin controls.
4. Age/identity, membership, RLS, bans, consent, booking collisions, signed
   contract evidence and provider failure paths must fail closed.
5. CI lint/typecheck/tests/build/staging smoke and manual visual QA must pass.
6. Do not call the migration production ready or deploy the new frontend until
   legacy page parity is confirmed; a compiling shell is not sufficient.

## Remaining detailed parity work
The complete original 642-file frontend includes more than its shell. The
full original page-level JSX and operations—especially collaboration room
document/task/calendar components, content catalog moderation, detailed public
profiles, analytics, social/gallery features, agent/studio representations and
role-specific earnings—must still be ported and verified rather than replaced
with generic shortcuts. Track outstanding tasks in GitHub issue #9.
