# Dashboard and workflow integration — November 17, 2026

## Scope
Continue the existing Bolt/Supabase migration, not a redesign. Keep the current sidebar, mobile drawer/bottom tabs, public pages, hero PNGs and role-specific profile layouts. Preserve the newer Host Connect branding. Backend is only `yxuqbygykpfbioslljlf`; the paused duplicate was not changed.

## Configurable dashboard
All six CCX roles use the same owner-scoped dashboard system with role-specific defaults. Customize dashboard adds/removes widgets, reorders them with accessible controls, changes card width, resets defaults, cancels edits and saves to the account. Layouts persist across devices. Revision checking prevents a second device silently overwriting newer changes. Empty layouts remain empty.

The 15 allowed widget types cover profile views, accepted friends, incoming friend requests, Favorites, unread messages, active collaborations, invitations, pending contracts, upcoming property requests, testing submissions, roster, portfolio, upcoming schedule, recent notifications and actual account verification/membership. Roster and portfolio widgets are restricted to their actual professional roles. Metrics are real account queries; blocked/unavailable values never masquerade as zero. Role previews display no invented metrics and do not write account settings.

## Access mismatch
The frontend previously treated administrator status as age approval, then converted a denied feature RPC into an empty flag map. The next screen called that result a disabled module. The live admin account inspected had no current independent age-verification record.

Availability and eligibility are now separate server fields. The UI distinguishes explicit admin disablement, rollout exclusion, verification needed, administrator MFA needed, membership needed, role mismatch and unavailable configuration. It presents the appropriate next action without granting access. The Verification page and profile badge use actual owner-scoped verification records, not the administrator flag. Admin role preview remains read-only and does not become a second Agent/Studio/Photographer account.

## Member workflow fixes
- Search directory profiles by name to select friends and invite collaborators; no raw database UUID input.
- Direct messages use accepted friend connections. Group selection uses accepted-member chips.
- Conversation lists and messages have separate state. Sending, editing, deleting, reacting and refreshing no longer erase the selected chat.
- Late requests cannot replace the messages of a newly selected conversation.
- Realtime is complemented by a visible-tab refresh fallback; read cursors stay server-authorized.
- Draft contracts use scope, compensation, usage rights and deliverables fields rather than a raw JSON entry box. A draft is not a completed signature.
- Optional SDK telemetry headers are stripped only for this project's Edge Function requests to match older deployed CORS handlers. Authorization, API keys and security headers are retained. Auth, REST and Storage traffic is untouched.
- The Host Connect startup selector's stale variable name was corrected; branding/routes were not reverted.
- Existing Discovery/Search/Favorites cards, private Testing, Properties, role rosters and professional portfolios are retained and gated by their actual backend requirements.

## Applied backend migrations
Both versions are already applied in the canonical database and saved in source:
- `20261117171719_custom_dashboard_and_explicit_module_access.sql`
- `20261117172731_explain_administrator_mfa_workflow_prerequisites.sql`

The dashboard table is RLS protected, owner-readable and not directly browser-writable. Public RPC wrappers are invoker functions; privileged implementations are in the existing non-exposed private schema. Anonymous execution is revoked. The testing-history compatibility column is also present. No real user's role, age approval, membership, consent or medical clearance was fabricated.

## Validation performed
43 live database dashboard checks passed under authenticated synthetic identities in a rolled-back transaction: six-role layouts, persistence, stale-write conflicts, empty layouts, row isolation, real owner counters, invalid/extra/duplicate widget rejection, role restrictions, actual unverified-admin state and anonymous denial. `scripts/check-dashboard-database.sql` reproduces these checks; never remove its ROLLBACK.

Another 26 live database checks passed for Agent/Studio roster invitation/accept/end ownership, all three portfolio-role link save/feature/delete operations, cross-account isolation, anonymous RPC denial and private photo-bucket settings. These fixtures were also rolled back. No test accounts or approvals remain.

The CI test job checks lint, full frontend typechecking, local policy suites, actual React server rendering, dashboard/transport tests, frontend/backend action contracts, builds, container health and anonymous backend gateway protection. Check the run for the final commit rather than assuming previous diagnostic runs passed. An actual authenticated mobile upload or multi-user chat browser session has not been completed by this change.

## Dependency audit status
The unchanged dependency tree reported picomatch advisory GHSA-fc5q-39xc-vjpf (https://github.com/advisories/GHSA-fc5q-39xc-vjpf). At inspection GitHub listed affected versions through 4.0.7 and no patched version. The dependency audit remains a failing job, not suppressed or continued on error. It runs separately so it cannot prevent the functional/build tests from reporting their own results. No forced Tailwind major upgrade was made merely to silence the audit.

## Remaining external prerequisites
The actual administrator account still needs an operational independent age approval and applicable MFA before protected member operations can run. Roster/Portfolio edits need the corresponding actual role, not only a dashboard preview selection. PASS synchronization, live payment processing and formal document signing still require their approved provider configurations and acceptance tests. These are not converted into fake successful operations.

Sync the final `main` source in Bolt and publish for hands-on testing. This change does not publish the Bolt site automatically or certify the entire platform as production-ready.
