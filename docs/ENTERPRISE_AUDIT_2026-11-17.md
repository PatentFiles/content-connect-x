# Enterprise audit and verified repairs

**Assessment:** NOT yet enterprise-production ready. A successful build, an enabled module, a database table, or a configured credential is not evidence of a working financial, legal, verification, or delivery integration.

Audit date: November 17, 2026, America/Phoenix. Database migration timestamps use UTC. Repository baseline: `0e8eecb748ca7970a3de037fe57f0f6fcaa89597`. Supabase project: `yxuqbygykpfbioslljlf`. No actual secret values were read or written.

## Scope and evidence

The audit used the complete tracked repository snapshot (367 files), the installed dependency tree and npm audit, public browser navigation on contentconnectx.com, PostgreSQL catalog/RLS/function/migration/cron inspection, Supabase security and performance advisors, and aggregate API errors. All six roles share tested routing, dashboard and access code; the current public website was inspected without signing in or submitting forms. Real authenticated customer sessions, real money, provider callbacks, and destructive restore operations were not exercised.

Public desktop navigation to `/`, `/login`, `/signup`, `/pricing`, and `/hostconnect` loaded without visible errors or overlapping controls. This is a rendering/navigation observation, not a successful signup transaction. `/terms`, `/privacy`, and `/about` returned the homepage instead of dedicated information. Mobile coverage below comes from local Chromium fixtures, not an authenticated live phone session.

At audit time the database had 127 public tables with RLS, no public storage buckets, two Auth accounts and no property/booking/collaboration production inventory. The registry had all ten provider entries disabled. That registry observation does not reveal whether separate Edge secrets exist or prove provider approval.

## Defects repaired in this change

| ID | Finding | Repair / validation |
|---|---|---|
| E01 | Legacy service-role JWTs could pass the browser's substring-only key check. Runtime rejection also happens too late to protect a built JS bundle. | Browser payload-role classification rejects non-anon JWTs; Vite fails before compilation on unsafe public credentials. Tests do not print key material. |
| E02 | nginx child locations added Cache-Control, dropping inherited security headers. | Shared security-header include in every location; CSP embedding baseline and nosniff retained for assets, index, SPA, service worker and health route. The container health test checks actual served headers. |
| E03 | Exported calendar URLs and opaque scheduler bearer credentials were blocked by the Edge JWT gateway before application authentication. | Only calendar/notification-worker gateway checks delegate to the handler. Calendar capability tokens, cron secrets, member auth and ownership stay required. Anonymous/invalid-token tests are explicit. |
| E04 | ICS recurrence was silently collapsed to a single occurrence, risking removal of imported busy dates. Invalid calendar dates could normalize to different dates. | Strict date/DST validation; unsupported recurrence is rejected without replacing existing blocks. Full recurrence expansion remains incomplete, not silently simulated. |
| E05 | Calendar export silently truncated each busy source at 400 rows; subscription expiry was not checked on calendar operations. | Paginated exports with a fail-closed ceiling; expired subscriptions and restricted/missing owner accounts are rejected. No partial calendar is served on a query failure. |
| E06 | Notifications could remain `processing` forever after worker termination. | Service-only row-locking claims, lease tokens, expiry recovery, bounded attempts, and atomic finalization/delivery-log writes. Competing/stale claim behavior tested in rollback-only SQL. |
| E07 | Notification preferences, provider acknowledgement, and delivery state could diverge; push work was unbounded. | Preference lookup fails closed; message/reminder/digest settings honored; three-job bounded batches; provider timeouts; email idempotency key and no redirect forwarding. Counts mean provider acceptance, not guaranteed recipient delivery. |
| E08 | User-supplied push URLs could direct server-side requests to arbitrary HTTPS addresses; endpoint upsert could reassign a known endpoint. | Official push-service allowlist checked at registration and sending, browser-key shape validation, ownership-preserving update/insert, correct ten-device limit. Unsupported vendors are explicit errors. |
| E09 | Mark all read marked only the first visible notification page; a failed Friends lookup hid all notifications. | One recipient-scoped bulk read mutation with server cutoff; independent request loads and honest partial-load notices. 81-record runtime fixture checks cross-user isolation. |
| E10 | Push enrollment raced worker activation, readiness could hang, and failed server enrollment left orphan client subscriptions. | Bounded activation wait, reuse existing subscriptions, rollback newly created subscriptions on server failure, nonblocking registration lookup. Notification click goes to the same-origin Notifications page. |
| E11 | Collaboration creation and membership creation were separate writes; acceptance could race a decline and leave inconsistent membership. | Service-only transactional create/respond functions. No browser-supplied actor identity is trusted. Membership, status, notification and audit are committed together. |
| E12 | Suspended/blocked invitees and closed collaborations were not consistently rejected; expired members could not decline an old invitation. | Current target restrictions enforced; acceptance remains gated; authenticated owners of invitations may decline without buying access to a disabled project feature. |
| E13 | Repeating a friend request could reset an accepted connection or create an opposite-direction pending request. | Pair-scoped advisory lock and atomic request procedure preserve accepted/pending relationships; reverse and repeated requests return a conflict. |
| E14 | Deleted messages affected unread counts and count failures appeared as zero. | Deleted records excluded; unavailable counts remain explicitly unavailable. |
| E15 | Optional Sentry reporting removed request data but still allowed free-form messages, tags, and token-bearing stack URLs. | Conservative event allowlist, generic exception text, bundle-path-only frames; no bodies, private URLs, local variables or user context. |
| E16 | Advisors found 108 foreign keys without covering indexes. | Add missing covering indexes only on small relations, with lock timeout and duplicate avoidance. Post-change catalog count is zero; no existing index or RLS policy was removed. |
| E17 | The CI workflow selected only some regression files, allowing newer tests to be omitted. | Portable `test:unit` runner discovers all offline test files; provider-authenticated E2E remains separately named. New regressions are run by CI. |

No mandatory MFA, repeated per-feature age gate, fake verification, fake payment, or automatic provider approval was introduced. Membership/ownership/block/privacy restrictions remain real. Job credentials are machine authentication, not user MFA.

## Database changes

- `20261118043348_enterprise_notification_leases_invitation_atomicity_and_fk_indexes.sql`
- `20261118044154_atomic_collaboration_creation_and_connection_requests.sql`

The new public RPC entry points use SECURITY INVOKER and have EXECUTE revoked from PUBLIC, anon and authenticated; only service_role can call them. The Edge handlers derive the actor from the verified Auth subject. They do not expose a client-selected actor bypass. Fixtures were created only inside explicit transactions and rolled back.

The advisor's backend-only RLS/no-client-policy notices are intentional deny-by-default tables. Creating a permissive policy merely to remove those notices would be a security regression.

## Still incomplete or not certified

### Launch-blocking product and provider work

1. **Paid membership billing:** the old Stripe membership endpoints are deliberately retired (410). There is no production-certified replacement subscription purchase/renewal/cancellation/dunning flow. The CCBill rental adapter is not a membership-billing implementation.
2. **Real rental money lifecycle:** CCBill form/webhook code exists but requires approved account/form/event contracts and financial reconciliation. Refund decisions and payout previews are not executable refunds or host transfers. Deposit capture/release, disputes, chargebacks, tax reporting and accounting reconciliation need a real processor integration and sandbox/live acceptance evidence.
3. **Creator collaboration signing:** agreement packet creation exists, but provider sending remains guarded/unimplemented. Host-location DocuSign is a different adapter. Both need approved templates, actual OAuth/merchant permission where applicable, completed envelope/certificate tests and archival/access checks. A checkbox is not a signature.
4. **New-signup verification and health partners:** Yoti/PASS registry entries are disabled. Manual-review code is not proof of provider onboarding, lab-result freshness, consent exchange or full enrollment/recovery. Actual new-email and partner sandbox acceptance are outstanding.
5. **Email, push and scheduled jobs:** infrastructure bugs are repaired, but vendor credentials, sender authorization, VAPID setup, recipient permissions and matching Vault/Edge job secrets still need configuration. The audited scheduler Vault names were absent; enabled cron rows alone do not prove work runs. Exactly-once external delivery is not promised; email idempotency depends on the selected provider, and per-device delivery receipts/redrive operations require further work.
6. **Terms/privacy publication:** tested public legal URLs did not serve dedicated policies. Publish accurate operator identity, jurisdiction, fees, refund/complaint process, processing/retention details and approved terms; obtain appropriate legal/privacy review. This audit does not invent business facts or certify liability immunity.
7. **Dependency security:** npm reports 11 high-severity findings in the transitive build/tooling tree rooted in picomatch. GitHub advisory GHSA-fc5q-39xc-vjpf listed no patched version when checked. No audit suppression, forced framework upgrade, or unreviewed dependency fork was applied. The separate audit remains a failing release result.

### Explicit product limitations

8. **Hotel-style/multi-night inventory:** current quote engine caps bookings at 72 hours and lacks true nightly pricing/check-in/check-out semantics. Hourly minimums do not implement those features.
9. **Full calendar interoperability:** expanded individual VEVENTs are supported. RRULE/RDATE/EXDATE/RECURRENCE-ID now fail safely, not expand automatically. Google/Outlook OAuth two-way synchronization is not implemented. Real vendor import/export tests are outstanding.
10. **Raw Matterport:** source archives can be stored; only a hosted Showcase link is playable. Raw-model processing/import is a separate integration, not completed by file upload.
11. **Background screening and automated media review:** screening is explicitly unimplemented; automated moderation/publication needs a supported provider, human review operations and acceptance tests. No fake clearance or moderation pass is generated.
12. **Market coverage and maps:** basic approved-area maps work, but production tile/routing service terms, geographic coverage, geocoder accuracy and real comparative inventory remain limited/unverified. The audited approved-area seed contained 13 US cities; there were no live property comparables.
13. **Optional cleaning marketplace:** hosts arrange their own cleaning. A local cleaning-service network is not implemented.

### Enterprise operational acceptance still required

14. **Authenticated end-to-end acceptance:** exercise every role with real test accounts, invitation/message isolation, host creation/upload/approval, booking conflicts, signing, payments, refunds and notifications. Local mocks and SQL fixtures are necessary but insufficient.
15. **Deployment/schema reproducibility:** historical numbered SQL and migration histories do not fully align with remote timestamps; some changes were applied directly. A clean restore/replay in an isolated project and a migration reconciliation plan are still required. Do not blindly reset or reapply old migrations against production. Deploy the latest frontend and affected functions together.
16. **Operational controls:** backups/PITR and successful restore drill, load/concurrency/soak testing, uptime alerts, incident response, secret rotation, retention/deletion requests, abuse escalation and documented support ownership are not certified. No branch-protection or backup setting was assumed from unavailable administration permissions.
17. **Remaining advisor warnings and policy choices:** leaked-password protection was disabled; pg_net is installed in public and is non-relocatable, so it was not destructively dropped. Review supported remediation with Supabase. Administrator MFA remains optional per the owner's policy, requiring explicit operational risk acceptance rather than a false claim of mandatory protection.
18. **Performance:** the current production JS bundle is about 920kB before gzip (~252kB gzip). Code splitting and real mobile-network/Web Vitals testing are still outstanding; increasing the warning threshold is not a performance fix.

## Validation record and limits

- 133 offline unit/policy/runtime tests passed (111 baseline plus 22 new regression tests).
- 24 Chromium layout checks passed across mobile/desktop/enlarged-text layouts; 27 React role/card render checks passed.
- 19 rollback-only live database integrity checks completed without retained fixtures: atomic collaboration membership, blocked/unrelated invitation denial, conflicting responses, notification lease recovery/token isolation/log integrity, and duplicate/opposite-direction friend requests.
- Lint, full application typecheck, build, release guards and frontend/Edge action/import contracts passed locally.
- Database verification: missing FK indexes = 0; browser roles cannot execute the new service-only procedures.
- CI repeats those tests and verifies nginx headers on real container responses. Live unauthenticated gateway smoke checks do not certify authenticated business transactions.
- The independent dependency audit remains failing. It is not marked successful or ignored.

## Deployment and rollback

Apply the two additive migrations before deploying the changed member-workflows and notification functions. Deploy member-workflows, hosting-operations, hosting-calendar and hosting-notification-worker with their checked-in helpers. Keep handler authentication enabled when the calendar/worker gateway is set to verify_jwt=false. Leave all other authentication settings as documented in config.toml.

Rebuild the Bolt frontend from the final main commit. Aggregate API logs showed requests from an older frontend using member_notifications.user_id, removed media-album shapes, and the nonexistent admin_toggle_self_verification RPC. Current source uses recipient_id and intentionally has no self-verification bypass. Do not add insecure database compatibility paths to accommodate a stale bundle.

Code rollback uses the previous source version; the additive lease columns/indexes can stay. Do not remove admission, consent or financial safeguards as a rollback shortcut. Test worker rollback carefully because older workers do not honor leases.

Primary references reviewed: Supabase Edge Function authentication documentation/changelog; nginx add_header inheritance documentation; GitHub GHSA-fc5q-39xc-vjpf; Google web.dev push-server documentation; Apple Web Push documentation; Microsoft WNS domain validation documentation.
