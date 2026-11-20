# Content Connect X / Host Connect — Developer ReadMe

**Canonical operational reference · updated November 20, 2026**  
**Source of truth:** deployed server configuration and schema, current GitHub `main`, and verified release checks. Do not mistake a code module, enabled UI flag, mocked integration, or archived design for a production capability.


## November 20, 2026 — Connected collaboration capabilities and provider integrations

**Implementation location:** current GitHub `main`, existing Bolt frontend, Supabase project `yxuqbygykpfbioslljlf`. New migrations and the Edge Functions listed below were applied and deployed on November 20, 2026. GitHub commits do not independently publish the frontend in Bolt. The original signed-out homepages, hero artwork and existing website host have not been changed.

**Shared OpenAI key:** Open the signed-in **Admin → AI agents & risk** page, paste your OpenAI API key in **Shared OpenAI API credential**, and click **Save OpenAI key**. This writes encrypted `openai_api_key` to Supabase Vault (the actual full token is never exposed back to the browser). For installations that set an environment secret, `OPENAI_API_KEY` is read first; otherwise the same server-side Vault credential powers all AI tools. `OPENAI_MODEL` optionally selects the text model (default `gpt-4.1-mini`). The same key is used by AI safety analysis, risk predictions/flags, explainable match recommendations, editable profile bios, audio transcription and AI contract drafting. `profile-ai` and `collab-suite` Edge Functions are deployed with JWT verification.

### Newly integrated capabilities

| Feature | Implementation | Boundaries |
|---|---|---|
| **Profile travel calendar** | `TravelCalendar.jsx` from Profile and Discovery; `ccx_travel_dates` with owner CRUD and explicit member sharing | Month navigation, destination/date ranges; exact addresses never shared |
| **Message before friendship** | `FriendMessaging.jsx` from Connections/Discovery/Settings; `ccx_friend_settings`, `ccx_intro_messages`; DB trigger on `member_connection_requests` | Default message-first requires reciprocal introductions; optional everyone/no-one |
| **Private testing credentials** | `CollaborationTesting.jsx`, protected upload, staff evidence review, `ccx_testing_credentials` | Only credential validity is shared; medical document remains private |
| **Collaboration testing deadlines** | Per-collaboration policy `ccx_collab_testing_policies`; DB triggers on `contracts` and `signature_envelopes`; `ccx_testing_daily_expiry` Cron | Expired/unverified required credentials block signing preparation; owners get expiry notices |
| **AI safety agent and flags** | `AIAgentAdmin.jsx`; `collab-suite` actions `agent_scan`, `agent_dashboard`, `agent_flag_review` | AI runs, private risk predictions and human review flags are persisted and accessible only to staff; no automatic ban |
| **Interest-based AI matches** | `AIMatchSuggestions.jsx` on Discovery; `matches_generate`, `matches_list`, `match_dismiss` | No candidate without shared saved scene/standard/fetish/kink-edge preference is recommended; no clinical or identity details sent to AI |
| **Professional AI bio** | `CreatorProfileEditorBase.jsx`, `profile-ai` | Editable generated text, requires deliberate Save; never sends ID or medical files |
| **Multiparty video** | `GroupVideoCall.jsx`; authenticated `call_signal`/`call_poll`, peer-to-peer WebRTC mesh for up to 6 | HTTPS camera permission; mesh/STUN may require TURN for restricted networks; recording consent separately enforced |
| **Recording and transcripts** | Private `ccx-collab-recordings` bucket, `ccx_collab_recordings`, `ccx_collab_transcripts`, OpenAI speech transcription | Members only, signed upload URLs, recording consent confirmed for all collaboration participants |
| **Shared collaboration notes** | `CollaborationWorkshop.jsx`, `ccx_collab_notes` and append-only `ccx_collab_note_events` | Optimistic concurrency and version history |
| **AI contract drafting** | `collab-suite` `ai_contract` uses plan + shared notes + meeting transcripts | Draft saved to `contracts` for review; no unsigned conversation automatically becomes consent |
| **Individual DocuSign signatures** | `agreement-packets` sender, generated agreement PDFs with individual signer fields, `collaboration-docusign-webhook` authenticates signed callback, archives PDF/certificate | DocuSign account credentials, signing authority and genuine provider completion are separate from OpenAI key |
| **Public safety reports** | Existing `TrustSite.jsx` form + `trust-intake` Edge; new case alerts and hourly overdue Cron; `ccx_trust_public_config().ready=true` verified in database | Reports now accepted without subscription, unique receipts/status codes, staff claim/response actions logged. Real human handling is separate from accepting cases |
| **CCBill membership processing** | Existing `membership-billing` and `membership-ccbill-webhook` use Vault credentials from Admin Integrations as well as server environment; authenticated relay and ledger remain | Payment status is set only by cryptographically authenticated and reconciled provider events; merchant and relay configuration are distinct from OpenAI |

**Deployment and release notes:**
- Supabase migrations applied: travel/friend/testing/AI/calls/notes/recordings; database friend-request enforcement; testing contract locks and daily expiry; DocuSign sending atomicity/events; Vault allowlist extensions; public intake and alert Cron.
- Edge Functions deployed: `collab-suite`, `profile-ai`, `agreement-packets`, `collaboration-docusign-webhook`, `ccx-integrations`, `membership-billing`, `membership-ccbill-webhook`. The existing hosting payment functions and other services remain separate.
- Sensitive provider secrets never enter the public Vite bundle. DocuSign requires account ID, integration key, service user ID, JWT private key and Connect HMAC key in the existing admin integrations (or environment secrets). CCBill has separate approved merchant form and signed callback-relay credentials. These services do not share the OpenAI key.
- Next verification: publish GitHub in the existing Bolt project; test with real admitted participants and browsers; test a real authorized DocuSign envelope and signed callback; test CCBill provider-approved checkout and callback; verify staff actually receive and handle safety alerts. Status labels must reflect observed provider responses rather than installed code alone.
- Historical observations in the November 19 snapshot and subsequent dated release notes remain preserved for audit. Do not interpret them as the newer November 20 state.

## 1. Product boundary

**Content Connect X:** a professional networking and collaboration-management marketplace for verified adults: creators, videographers, photographers, video editors, agents, studios and production teams.  
**Host Connect:** a separate, connected marketplace for filming/photography properties, booking requests, location terms and host services.

The platforms **do not sell, host for public distribution, publish, distribute, or monetize explicit audiovisual content**. Private verification evidence, contracts and legitimately necessary professional records have separate narrowly defined access and retention. An external creator's content-link does not convert this platform into a publishing service.

The product journey: **identity eligibility → professional profile → Discovery → accepted connection/two-way conversation → collaboration invitation → agreed plan → individual consent and signatures → production readiness → property/schedule confirmation → participant completion → independent reviews → historical archive.** The absence of an approved provider or participant agreement cannot be represented as success.

## 2. Deployment and systems

| Component | Authority | Current deployment boundary |
|---|---|---|
| **Bolt** | Website, public homepages, signed-in React UI, mobile layout | Production website; publishing is user-controlled in existing Bolt project |
| **GitHub** | Versioned React/Vite code, SQL, Edge Function sources, CI | `PatentFiles/content-connect-x`; merging does not publish Bolt |
| **Supabase** | Auth, admission decisions, Postgres/RLS, Storage, Edge Functions, audit and Cron | Established project `yxuqbygykpfbioslljlf` |
| **Railway** | Identity document OCR, face/liveness processing, dedicated retention worker | Separate `Content Connect X - Identity` project only, never website hosting |
| **DocuSign** | Individual electronic signatures and completed evidence | Server-side packet sender and authenticated Connect webhook deployed; merchant sandbox/live signing validation separate |
| **CCBill** | Authorized member subscription and approved rental checkout | Integration source exists; live merchant flows require provider approval, secrets and transaction testing |
| **Group video** | Private collaboration calls | Authenticated six-person WebRTC signaling and local recording UI implemented; TURN optional for restrictive networks |

**Do not place** Supabase service keys, biometric bytes, health documents, processor credentials, private file URLs, or signing secrets in Bolt browser assets, GitHub, ordinary logs, or public storage.

### Source locations

- App entry/navigation: `src/supabase/SupabaseApp.jsx`, `OriginalShell.jsx`, `roleNavigationData.mjs`
- Private identity: `src/supabase/IdentityVerification.jsx`, `IdentityPilot.jsx`, `supabase/functions/identity-verification/`, `supabase/functions/identity-pilot/`, `server/idv-worker/`
- Collaboration: `src/supabase/CollaborationHub.jsx`, `MemberWorkspace.jsx`, `supabase/functions/collaboration-workspace/`, `member-workflows/`
- Consent/agreements: `src/supabase/ConsentCenter.jsx`, `AgreementPackets.jsx`, `supabase/functions/collaboration-consent/`, `agreement-packets/`
- Representation: `RepresentationAgreements.jsx`; private `ccx_workspace_private` procedures
- Host marketplace/booking: `src/supabase/OnlyHostApp.jsx`, `HostingMarketplace.jsx`, `supabase/functions/hosting-*/`
- Safety/trust: `TrustSite.jsx`, `SafetyPanel.jsx`, `supabase/functions/trust-intake/`, `supabase/migrations/20261119141902_trust_request_intake_disabled_until_operator_review.sql`
- Payments: `supabase/functions/membership-billing/`, `membership-ccbill-webhook/`, `hosting-ccbill/`
- Shared professional appearance: `src/supabase/professional-theme.css`, `workspace-refinement.css`; public hero appearance is separate
- Feature availability: `product_feature_flags` and actual provider readiness; do not trust a frontend toggle alone

## 3. Verified live configuration snapshot (November 19, 2026)

This is a **point-in-time audit**, not an invariant or a claim of end-to-end acceptance.

| Capability | Observed | Release rule |
|---|---|---|
| Public production self-hosted ID verification | **Disabled**; security and privacy approvals absent | Validate real documents/camera behavior, recovery, consent, retention and reviewed release |
| Private administrator ID pilot | **Enabled and time-limited**; private bucket and frequent cleanup | Never grant admission from a test run |
| Public trust/safety report intake (Nov 19 snapshot) | **Was disabled Nov 19**; opened for receipt/case routing Nov 20 | Actual staffed review and escalation still need operator coverage |
| Collaboration and contracts UI/backend | Enabled in premium feature registry | Signed-envelope provider and multi-user acceptance not yet established |
| Representation agreements | Backend tables/RPC, expiry job active; zero existing representation records at snapshot | Real two-party flows and legal templates still require acceptance |
| Host property bookings | `property_bookings` **disabled** | Merchant, availability, booking, cancellation and host acceptance |
| Verified collaboration reviews | `verified_reviews` **disabled** | Genuine completed-collaboration checks, moderation and appeal |
| CCBill memberships | Billing adapters present; subscription ledger had **zero entries** | No “active payment” claim without approved and reconciled provider transaction |
| Approved sponsorships | **Zero** current campaigns | Operator review, disclosure, privacy and merchant terms before ads |
| Identity evidence storage | Production and pilot private storage buckets | Purpose-specific retention/holds; no indefinite raw-ID archive |
| Scheduled representation expiry | One active Cron job | Confirm actual notifications reach both parties, not just table insertions |

The existing code's tests and CI provide useful confidence but do **not** certify biometric accuracy, merchant approval, human moderation, a real DocuSign signed envelope, or real iOS/Android behavior.

## 4. Role access and account admission

Roles: **creator, photographer, videographer, video_editor, agent, studio**. Host Connect has its own host permissions and property ownership rules. Role previews are not authorization. Premium membership gates are checked server-side. Private legal identity and a public stage name are distinct; no private legal/health/ID data may appear in public profile responses.

An Auth account is **not** an approved account. Verified email, applicable versioned notice, document-derived DOB and reliable live face checks form the identity workflow. Access requires trusted `member_admissions` state. Birth-date and legal-name decisions must not depend on user editable Auth metadata, client UI or facial-age estimates.

## 5. Identity verification, recovery and evidence

1. Confirm email and explain private ID/selfie processing and retention.
2. Collect exact legal first/middle/family name and applicable issuing country/document type.
3. Capture ID sides or passport page; read printed fields and independent machine-readable data when available.
4. Perform a server-assigned live selfie challenge, clearly showing each pose and countdown.
5. Validate name, DOB eligibility, expiration, document consistency/authenticity, live facial match, and both head-turn checks independently.
6. Only a fully trusted, bound, completed server decision may grant signup admission.
7. On uncertainty, offer clear **Retake ID**, **Retry live capture**, **Correct entered legal name**, or **Request review**. None of these is a bypass or a declaration of fraud.

Current production verification is disabled pending the recorded approvals. The private pilot is diagnostic only and uses separately retained evidence scheduled for deletion; a pilot pass cannot change membership access. A genuine-document acceptance study is required before general availability.

**Qualified review implementation (gated):** A member's review request is queued once in `ccx_idv_review_cases`. The `identity-verification` Edge Function requires a verified administrator account **and current Supabase Auth AAL2** before accessing the review queue or signed private evidence. Admins must claim cases, cannot read their own evidence or another reviewer's case, and can only close with non-admitting outcome codes. `ccx_idv_review_events` is append-only, with no raw ID text in events. Members see only their own review progress. This is a workflow guard, **not** a declaration that qualified staff are available or an authorization to enable production verification. No manual approval override exists. Follow `ops/IDENTITY_REVIEW_OPERATIONS.md` and issue #26 for remaining independent review, retention, real-ID acceptance and operator signoff.

Original ID and facial evidence are sensitive. Store only justified evidence in restricted Supabase Storage with access audit, bounded signed URLs, encryption/key controls, explicit deletion schedule and case-based legal hold. Durable decision manifests and hashes are not equivalent to retaining all original images or making the evidence immutable. Law enforcement never receives a standing unrestricted backend login.

## 6. Collaboration lifecycle, agreement and consent

Collaboration records support membership, invitations, versioned plans, professional roles, consent and draft contracts. The system maintains a historical participant record; hiding a collaboration from the dashboard does **not** erase required contract/consent/audit data. Paid features must never permanently block a participant from retrieving records the platform still lawfully retains.

**Proposed state model (not a claim currently enforced everywhere):**
`draft → proposed → accepted → scope-agreed → awaiting-signatures → signed → scheduled → ready → completed → reviewed → archived`.
Cancellation, withdrawal, dispute, blocked scheduling and revision are separate paths; no frontend-only transition controls release.

A collaboration plan contains time-zone aware dates, location or approved Host property reference (**not** a confirmed booking), proposed scope, roles, professional deliverables and usage rights. Individual participation, recording, distribution and download consent are separate. Participants may reduce/withdraw consent; no earlier signature creates permission to force additional activities.

After production, each participant can confirm their own statement of actual activities/services and deliverables. That is not proof of another participant's conduct. **Backend deployed November 19, 2026; Bolt publication outstanding:** `ccx_collaboration_actual_statements` and the authenticated `collaboration-actuals` Edge Function permit independently authored completion records only after the scheduled production end time. Statements append revisions rather than overwriting earlier accounts; all participants can compare reports and visible disagreements. Replayed submissions are idempotent, and another member cannot author or amend your record. These are private member statements, not independently verified facts, signed amendments, consent changes or additional contractual duties. The Supabase migration has been applied and `collaboration-actuals` Edge Function version 1 deployed with JWT verification. Live role checks confirm RLS, no direct browser read/execute permissions and service-only RPC use; no participant statements were fabricated. Bolt publication remains a separate user-controlled step. Editing signed plans requires explicit amendment/version, renewed consent and signatures when needed. A completed DocuSign event and its certificate must be verified server-side and linked immutably; a saved JSON draft is not a signed contract.

Invitations require an accepted connection or real reciprocal conversation. Unsolicited-volume and decline cooldown restrictions are server-controlled. Appeals and anti-retaliation are required for fair enforcement.

## 7. Representation and exclusivity

Representatives and professionals enter distinct role-scoped agreements. Backend records agreement terms/hash, mutual acceptance, dates, notice, renewal proposal and private audit history. Active public profile linking contains **only** professional names/roles permitted by the signed agreement. Terminated or expired representation must not convey continued privileges.

**Still required:** cross-agreement exclusivity conflicts; a represented participant's contract-signing workflow with scope-limited agent permissions; verified notifications and renewal acceptance; real-world legal review. A representative cannot withdraw or override a creator's consent on their behalf.

## 8. Host Connect booking and payments

Host listings and requests need atomic time-slot reservations, property/host approval, IANA time zones, transparent quote snapshots, booking state, capacity limits, property rules, private location access, cancellation handling, refunds/holds where applicable, and dispute records. Selecting a property on a collaboration plan **does not reserve it**.

CCBill provider adapters are separate for membership versus approved marketplace charges. Subscription or booking entitlements arise only from authenticated/reconciled server events. Do not infer payment from a redirect or a screenshot. No automatic earnings split or escrow promise is made: such services require actual processor approval and a separate legal/accounting design.

## 9. Trust reporting, privacy, moderation and compliance

Content Connect and Host Connect are professional marketplaces, not content distributors. This does **not** eliminate duties arising from hosting profiles, messages, private records or user-uploaded material.

The public reporting interface must work without a paid account once a monitored staffed response is operational. Reports require a reference, real case routing, severity triage, deadline tracking, evidence access and deletion/hold policy, reporter updates, qualified human moderation and appeals. As of November 20, the server-side trust intake is **enabled for public case submissions**, with private staff alerts and hourly overdue notifications. Its new private follow-up allows a reporter to check a *previously accepted* report only with both its random receipt reference and a separate private access code (not saved in browser storage). MFA-approved staff must explicitly claim a case before changing its outcome; case queue age and internal due dates are visible only to authorized reviewers. These features do not create staffing, emails, automatic removal, law-enforcement access or legal compliance on their own. Reporting suspected crime is distinct from a publicly visible rating or unreviewed allegation.

**Voluntary on-location safety records (backend deployed November 19, 2026; Bolt frontend publication outstanding):** The private `collaboration-safety` Edge Function and `ccx_collaboration_safety_action` procedure allow accepted, admitted participants to self-report arrival, departure, safe check-out, or a concern. A server-side schedule window limits arrival claims; leaving and recording a concern remain available independently. Actions are private per participant, idempotent where appropriate, and recorded in append-only `ccx_collaboration_safety_events`. No GPS, contact names, phone numbers, emergency dispatch or third-party notifications are collected or claimed. Members may optionally state that they personally informed a trusted contact; this is not validated or sent by the platform. A recorded concern is **not** a staffed safety case. The UI links to safety-reporting options, clearly says emergency response is not monitored, and preserves independent consent withdrawal. See `ops/COLLABORATION_SAFETY_CHECKIN.md`; full staffed escalation is still blocked by issue #25.

Law-enforcement access is verified, case-specific, least-privilege, expiring and fully logged, subject to the applicable legal basis and jurisdiction. Safety concerns require a separate immediate escalation path. Do not claim automated scanning, staffing or legal compliance without actual evidence.

Use an explicit **country allowlist** only after country/service-specific review; do not infer legal eligibility from religion or ethnicity. Cookie preferences, opt-in discovery details, deletion rights and accessibility are separate from marketing consent.

## 10. Messaging, notifications and calls

Current private messages require account and mutual-contact eligibility. Notification DB entries are not proof of actual delivery. Implement provider acknowledgement, bounded retries, dead-letter work, monitoring, user controls, and transactional email/push acceptance.

Voice/video calls are **planned**: server-signed short-lived room tokens, participant permissions, blocks, call invite/accept, report, reconnection and platform/region review. Recording must be off by default; if added it needs participant notice, explicit applicable consent, retention and access policy. Never treat a call recording as proof of capacity or consent.

## 11. Reviews, Discovery, sponsorship, deliverables

Only independently verified completed collaborations qualify for professional reviews; use double-blind publication, abuse/retaliation screening, moderation and appeals. No automatic criminal labels or permanent bans solely from ratings.

Discovery ranks relevant professional criteria and substantiated completed work, not private sex-life/health/identity details. Creator orientation disclosure requires affirmative choice; sensitive data cannot be used for ad targeting. Sponsors require approval, clear labels, allowed destinations and contextual/non-sensitive placement only. No partner account or campaign is active by code alone.

Private deliverables will be restricted to legitimate non-explicit professional documents, briefs, receipts, approvals, and file manifests. Do not build an explicit media distribution or monetization feature.

## 12. Providers and activation requirements

Before a live provider is marked ready, record: approved merchant/vendor account, configured server-only keys and HMAC/OAuth/Webhook credentials, matching feature flags, endpoint ownership, explicit allowed service categories, webhook replay/idempotency tests, sandbox transaction lifecycle, cancellations/refunds, failure/retry paths, and documented legal/compliance approval. **Adding a key alone is insufficient**.

Reference:
- `docs/PROVIDER_READINESS_2026-11-18.md` — historic provider implementation snapshot (may be stale)
- `docs/PROVIDER_AND_SAFETY_ACTIVATION_RUNBOOK.md` — current acceptance and activation gates for CCBill, DocuSign, identity, safety and communications
- `docs/MARKETPLACE_SAFETY_PRODUCT_REQUIREMENTS_2026-11-19.md` — scope and safety roadmap
- `docs/IDENTITY_GUIDANCE_RESULTS.md` — guided ID-capture implementation
- `docs/RELEASE_NOTES_ARCHIVE_2026-11-19.md` — previous README preserved for history, not current authority

## 13. Security, test and release acceptance

Supabase exposed public-schema tables must have RLS and narrowly scoped grants. Review `SECURITY DEFINER` RPCs for ownership, authenticated actor, explicit search paths, data exposure and abuse protections. The project currently has security-advisor warnings; investigate rather than relaxing controls just to suppress warnings. Leaked-password checks can be enabled with an eligible paid Supabase plan; until then use robust password policy, optional or role-mandated MFA as appropriate, and abuse monitoring.

Release checklist:
1. Change sources via feature branch and reviewed PR; include migrations and tests.
2. Validate lint, types, production build, actual browser layouts, unit checks, CI authorization tests, disposable PostgreSQL and provider-specific fixture tests.
3. Test with **separate consenting adult accounts** in an isolated non-billable environment; never use actual IDs for CI, never generate fictitious production admission or payments.
4. Apply migrations through tracked history, verify RLS/grants, deploy matched Edge Functions; keep unapproved capabilities disabled.
5. Run signed-webhook/callback and delivery tests with the relevant provider's sandbox; verify idempotency and no access escalation.
6. Verify monitoring, scheduled cleanup, backups/restore, rollback, retention and incident response.
7. Publish the frontend from **Bolt**. A GitHub merge or Railway worker success does not publish Bolt.
8. Record exact deployed revisions, externally approved services, open risks and owner acceptance.

## 14. Feature status vocabulary

- **Source present:** Code exists; may be dormant, untested or incompatible with deployed schema.
- **Deployed:** Server/asset is installed; no claim of actual customer transaction.
- **Validated in isolation:** Mocks, browser fixtures, or disposable database tests pass.
- **Provider accepted:** Real eligible sandbox flow plus required merchant/vendor approval passed.
- **Operational:** Production provider, tested real workflows, monitoring, support and policy/retention coverage confirmed.
- **Disabled:** Feature remains intentionally unavailable even if code or UI exists.
- **Proposed:** Not yet implemented; not included in pricing/marketing guarantees.

## 15. Legacy capability decision register — choose REBUILD, REPLACE, or RETIRE

The following capabilities were described by the historical Developer ReadMe. The old descriptions are **not evidence they exist or work in the current repository**. The proposed disposition is a product decision, not a migration assertion. Leave this appendix at the **bottom of the README** for operator review.

| Historical capability | Current direction | Suggested decision |
|---|---|---|
| Advanced professional role wizard, agent/studio detail entities | Modern shared professional profile forms; parity still to audit | REBUILD selectively |
| Legacy one-page scene/contract creation and auto-locking | Guided, multi-party production workflow with explicit acceptance | REPLACE |
| Standalone CollaborationRequirement / Task / PacketItem entities | Readiness checklist and signed packet manifest | REPLACE |
| CollaborationActivityLog and ContractAuditLog | Server-owned versioned plan, consent, signature and action ledgers | REBUILD gaps |
| CollaborationConfirmation and collaboration calendar | Multi-party completion attestations and schedule-aware timeline | REBUILD |
| CollaborationDispute and ArbitrationCase | Confidential safety and commercial dispute/case system with appeals | REPLACE |
| DisputeSimulation test runner | Isolation and abuse-case CI fixtures | REPLACE |
| ContractTemplate / ContractVersion / ContractReminder | Approved provider templates, versioned envelopes and reminder outbox | REBUILD |
| StudioCollaborationObserver | Role-limited, contract-bound representative involvement | REPLACE |
| Delegated agent signature permissions | Explicit contract-scope delegation plus independent participant consent | REBUILD |
| Automated agent/studio revenue split and EarningsRecord settlement | No settlement until separately approved processor/accounting mandate | RETIRE for initial marketplace |
| Creator booking requests that automatically create collaborations | Explicit accepted booking/invitation and separate agreement lifecycle | REPLACE |
| Studio room availability and package rates | Host property availability, role-specific service offerings | REBUILD selectively |
| Automatic recurrence, Google Calendar/Outlook sync | Provider-backed synchronization with recurrence acceptance tests | REBUILD later |
| Social media link verification | Owner-opted-in premium professional link visibility; validation remains | REBUILD selectively |
| FriendActivityLog and decline warnings | Audited anti-spam cooldown, appeal and fair recipient limits | REBUILD |
| IdentityFingerprint and consistency agent | Privacy-reviewed duplicate-account detection with human appeal | REEVALUATE |
| SafetyCheckInWidget and SafetyCheckIn history | Replaced by private, voluntary event-timestamp workflow without GPS or false emergency coverage claims; staffed escalation remains pending | REPLACE |
| ConsentRevocation automated takedown | Real consent withdrawal, scope changes and case handling | REBUILD |
| Work-health document sharing | Do not expose private medical records to collaborators | RETIRE raw sharing |
| ComplianceRecord and compliance-score events | Audited case outcomes and documented control checks | REPLACE |
| CompliancePortalAccess | Narrow lawful case-specific disclosure with logged authorization | REBUILD |
| ReputationScore calculation | Moderated verified completed-work feedback, appeals and clear provenance | REPLACE |
| Background screening scanner | Separate lawful vendor-supported service with human review if justified | DEFER |
| `autoCreateEarnings` and `updateEarningsSettlement` | No automatic payment/earnings promise in initial marketplace | RETIRE |
| Gallery, GalleryPermission, media albums | Non-explicit professional portfolios, separate access-controlled document vault | REBUILD selectively |
| Full raw video/file delivery features | Non-explicit artifacts and permitted external delivery receipts only | RETIRE explicit hosting |
| Custom tags, city submissions and catalog moderation | Controlled professional taxonomies/region catalog | REBUILD selectively |
| QuickTask / creator action widget | Contextual readiness tasks inside collaboration, not a global task farm | REPLACE |
| Provider-to-Drive contract export | Optional later authorized document connector | DEFER |
| Google calendar automatic event creation | Optional later synchronized events after OAuth approval | DEFER |
| Legal hold / compliance evidence exports | Case-scoped audit exports, retention and verified lawful requests | REBUILD |
| Coupon / CouponRedemption | Processor-approved membership promotions, not self-created payment grants | DEFER |
| Automated affiliate networks and payout attribution | Reviewed contextual professional sponsorship/affiliate attribution | DEFER pending partner approval |
| Miscellaneous retired backend shortcuts and stale UI modules | Remove only after owner decides and parity/usage evidence is recorded | REEVALUATE |

**Decision instructions:** Mark each item REBUILD, REPLACE or RETIRE after reviewing the current implementation. Do not remove unknown legal records or re-enable retired services as a side effect of the documentation cleanup.

### Identity recovery reliability increment (November 19, 2026)

The capture interface deduplicates its approved-session completion callback across repeated or concurrent status checks, while allowing retry if the callback itself fails. This is **frontend navigation reliability only**, not a new source of verification authority, a change to member admission, or evidence of real-ID acceptance. Production self-hosted verification remains disabled pending issue #26's real-document, liveness, false-positive, retention and human-review gates. The later selective-retake release below supersedes the earlier restart-only recovery behavior.

### Phase One selective evidence recovery (backend deployed; production verification disabled)

The next identity recovery increment introduces a server-owned `ccx_idv_request_retake` operation for a specific front image, back image (non-passport), or live camera challenge after an inconclusive verification result. Existing retained evidence is never overwritten; its reference is removed from the active session and it remains in the private deletion ledger until its original retention deadline. A successful retake request clears the previous decision, increments an evidence revision and requires a new trusted engine evaluation. A camera retry rotates its challenge. An upload carrying an obsolete revision is rejected by `ccx_idv_upload_versioned` under the same user/session database lock.

**Verified deployment (November 19, 2026):** PRs #36 and #37 are merged; the versioned upload/retake database migration is applied to the existing Supabase project and `identity-verification` Edge Function version 2 bundles the current repository-local handler and policy. The Bolt frontend source is in GitHub `main`, but Bolt publication has not been performed by this release. After deployment the identity feature flag remains `enabled=false`; security and privacy approval timestamps are unset. Service-only retake RPCs remain inaccessible to browser database roles. No live identity documents or approval results were created in this release.

**Release boundary:** New retakes are not allowed on approved or underage sessions, after expiry, on legal hold, with a pending qualified review, or when the processing retry cap is reached. Identity verification remains disabled until production validation, privacy/security approval and issue #26's real-document and attack tests. This change does not admit users or lift the public safety intake gate.

### Voluntary check-in deployment verification (November 19, 2026)

PR #39 was merged after passing four CI workflows (including isolated PostgreSQL and handler authorization tests). The reviewed `voluntary_collaboration_safety_checkins_20261119` migration was applied to the established Supabase project and `collaboration-safety` Edge Function **version 1** was deployed with JWT verification enabled. Live SQL confirmed RLS on the private check-in table, no direct authenticated-role execute access to the RPC, service-only authorization for backend actions, and no GPS/contact fields. Identity verification and public trust intake remain **disabled**. No real emergency alerts or contact notifications were created. The updated React interface is versioned on GitHub `main` but not yet published through Bolt.

### Connect Feed and Community Groups (November 19, 2026)

The approved product treatment is `docs/CONNECT_FEED_GROUPS_ADVERTISING_TREATMENT.md`. The logged-in dashboard keeps up to four personalized widgets in a compact top strip; a permanent, moderated Connect Feed occupies the center; the right rail reserves **Sponsored** placements without inventing paid campaigns. Verified Free members can browse, react, bookmark and submit moderated comments. Premium members may publish posts, submit photos for independent media approval and repost unrestricted community posts. The existing `community_posts` system is extended with audience-specific server-owned privacy, rather than duplicating social records. Private posts must not be exposed by the legacy Creator Community API.

**Source-controlled group implementation:** `ccx_social_groups`, `ccx_social_group_members` and immutable group events are served by the authenticated `connect-groups` Edge Function. Public groups are held in `pending_platform` until an independent MFA-authenticated platform administrator approves them; founders cannot self-approve. Public membership applications require a group owner/admin decision. Private group metadata and membership are hidden from discovery, with voluntary invitation acceptance. Owners can promote/demote administrators; authorized administrators can invite and remove eligible members. Revoked members immediately lose group-post reads. The existing moderated `community_posts` timeline supports group-only text posts with Premium-only publishing and verified Free-member reactions/comments; group-only photo distribution remains off until its own private-media rights and moderation pipeline is implemented. Group membership is never an advertising targeting signal. See `ops/CONNECT_GROUPS_OPERATIONS.md`.

The treatment also requires public searchable groups with moderated applications, and private invite-only groups with accountable administrators, membership controls, private membership lists and group-only post access. Sensitive group interests never become advertising-targeting signals. Advertiser and affiliate-provider account enrollment requires a verified provider list, ownership consent, credentials in a protected vault and a separate activation gate; provider integrations are not declared active without evidence. This social release does not change the Bolt website host, identity admission safeguards or public safety intake controls.

### Feed profile timelines, sharing and advertising inventory (November 19, 2026)

The Connect Feed release adds a private, owner/recipient-authorized post deep link at `/Dashboard?ccx_post=<uuid>`. The server resolves a single post using the **same** audience, friendship, blocking, moderation and group-membership restrictions as the timeline; possession of the link is never an access grant. Approved posts also appear on the owner's own Profile page and other members' Discovery profile view subject to the viewer's current permissions. Existing post history is not duplicated in profile-specific tables.

The right-hand Sponsored rail supports up to three approved text campaigns from the existing sponsorship registry. It is empty rather than faking ads when none are approved. External PPC and affiliate registration and network-specific attribution are pending exact verified provider names and consent; see `ops/AD_NETWORK_ONBOARDING.md`. No provider tracking pixel, ad account or third-party credential was created by this release. Bolt publication remains a separate step.

### Connect Feed, Groups and sharing deployment reconciliation (November 19, 2026)

**Verified source:** PR #41 (Connect Feed), PR #42 (public/private Groups), and PR #43 (profile timelines, secure post links, multi-sponsor rail) are merged to GitHub `main`; their four required workflows passed. The deployed Supabase project has the `connect_feed_private_audiences_20261119`, `connect_groups_private_public_20261119`, and `connect_feed_post_permalink_20261119` SQL migrations applied. Deployed Edge Functions: `connect-feed` **version 3**, `connect-groups` **version 1**, and the legacy community privacy compatibility patch in `platform-extras` **version 13**. New group and feed Edge Functions validate JWTs, and group platform-review actions additionally require current MFA AAL2.

**Verified security:** The group-membership tables have RLS. Ordinary authenticated database roles cannot execute the group-management or feed-page privileged procedures. Public safety submissions and self-hosted production identity approval remain disabled. No real groups, paid clicks, external ad accounts or dummy campaigns were created. The sponsor registry had zero active approved campaigns at this reconciliation. The sidebar supports up to three independently approved sponsor links but installs no outside ad scripts or pixels.

**Deployment boundary:** GitHub and Supabase are updated; **Bolt has not been republished with these new frontend changes**. The previous Bolt publish predates these three PRs. Synchronize and publish latest `main` from the existing Bolt project before end-user UI testing. Do not migrate hosting or enable external identity, public safety, CCBill or third-party advertising solely to test social UI. Platform-human moderation remains a real operating requirement. Group-specific media uploads are deliberately disabled pending a privacy-protected media/audience design. See `docs/CONNECT_FEED_GROUPS_ADVERTISING_TREATMENT.md`, `ops/CONNECT_GROUPS_OPERATIONS.md` and `ops/AD_NETWORK_ONBOARDING.md`.

### Verified creator photo publishing update (November 19, 2026)

The logged-in **Feed** now defaults to Verified Community (not Friends), with optional Friends-only and Only-me audiences. Verified Premium adults may publish their own professional and nude solo photos without a separate manual image-approval click when they attest to their sole depiction, legal age, rights and the absence of a sexual act. The browser re-encodes photos to remove EXIF/GPS metadata, the backend checks the stored MIME/size and signature, writes `approval_origin=verified_self_attestation` and records a private audit event. The new `ccx_feed_create_trusted` procedure reuses all original Premium/admission/rate/media-access checks but publishes the verified Feed update immediately; **groups and comments retain independent moderation**. Reported privacy, rights or severe safety issues can temporarily hide a post for qualified review. A report alone never imposes an automatic account penalty. This does **not** substitute for verified third-party performer releases, 18 U.S.C. §§ 2257/2257A compliance where applicable, or staffed trust operations. Details are tracked in the source-controlled treatment.

### Feed-first layout and solo creator photo release — verified November 19, 2026

PR #44 and PR #45 are merged into `main`; their four CI gates passed. The logged-in web dashboard starts with a Feed composer and defaults to the entire Verified Community, with Friends-only and Only-me available. Up to four optional cards (including featured professional portrait cards with name, location, a verified-adult label and expansion) are stacked in a **desktop-only right rail**; the separate approved-sponsored rail follows beneath. Mobile hides widgets and sponsored placements and shows the Feed first.

**Supabase rollout verified:** `feed_verified_self_photo_20261119` migration applied; `connect-feed` Edge Function **version 4** and `media-gateway` Edge Function **version 8** are active with JWT verification. The trusted-feed publishing procedure is service-role-only and unavailable to ordinary authenticated database users. New self-attested photo metadata columns were verified. Self-hosted identity production admission and public safety-reporting intake remain disabled. CI used synthetic fixtures; no real user photo or paid affiliate record was fabricated.

**Policy boundary:** Verified Premium members may immediately share adult-nude or ordinary *solo self-images* after rights, self-only and no-sex-act attestations. The browser strips EXIF/GPS via re-encoding; the server validates size, MIME and file signatures, rate limits and records a private audit. This is not permission to distribute another performer's image, waive age/consent evidence, or bypass recordkeeping laws. The Feed uses trusted Premium publication without routine prior image moderation; group posts and comments remain on the existing separate moderated path. Serious report categories trigger **temporary content quarantine**, not automatic account penalties. A substantiated trust/safety process is still necessary.

**Gamma Entertainment integration status:** The user's official GammaStats screenshot and vendor site identify FameDollars, BlazingBucks and BuddyProfits as one Gamma affiliate-account umbrella at https://www.gammastats.com/signup.php . Provider registration remains pending the application contact/payment fields and operator acceptance of terms; no credentials were stored in source code, no account signup completed, and no referral tracking URL was fabricated. The dashboard's sponsored rail continues to show only preapproved real campaigns (no inventory is currently active). See `ops/AD_NETWORK_ONBOARDING.md`.

**Bolt publication:** These are newly merged frontend changes after the owner's last Bolt publish. The owner must sync and publish current GitHub `main` through the existing Bolt project before real-device UI acceptance; hosting is unchanged.


### Host Connect mobile search, range dates, map and public-address privacy (November 19, 2026)

Host Connect guest navigation now contains only **Explore spaces / Saved / My requests**; host dashboards, staff, cleaning and approval operations stay in the separate Host Connect owner account. **Find a space** is a collapsible search panel. Date selection is a two-click check-in/checkout calendar, across month boundaries, with only hourly/half-hour time slots; the rental quote and reservation engine still enforces its independent 72-hour maximum and final availability, while area search can scan up to 31 days for browsing. The UI must not imply long-term bookings are automatically reservable until quote policies support them.

The location map uses active-view OpenStreetMap tiles (or a configured contracted HTTPS tile provider), non-passive scroll-wheel handling to zoom the **map only**, double click/double tap zoom, drag-to-pan, and only +, − and north compass controls inside the canvas. Pin icons distinguish houses, apartments/high-rises, studios, sets, outdoor spaces, equipment and dungeons/castle-like venues. Public areas are approved city/neighborhood centers, with deterministic privacy offsets for separate listings. The map re-queries approved listings after viewport changes; no real addresses are fabricated and OSM attribution is visible below the canvas. The operator must provision a licensed commercial-scale tile source when the free community tile service's usage limits are exceeded.

Hosts can explicitly opt to expose their street address and optionally a trusted public coordinate pair. By default, `property_private.public_address_visible=false`; private addresses and all entry instructions remain protected behind the existing signed, accepted, paid booking gates. The backend only surfaces exact address details for independently approved active listings with explicit host opt-in. Listing categories now support `apartment`. Signed-in Host Connect uses restrained cyan/violet/fuchsia accents derived from public landing branding, with white backgrounds retained and **no change to the logged-out hero artwork**. No Gamma Entertainment affiliate campaign was activated; provider approval/tracking remains pending.


### Host Connect customer interface rollout verification (November 19, 2026)

PR #46 was merged into GitHub `main` after the required full application, trust/dashboard and identity-database CI gates passed. The updated mobile **guest** tabs show **Explore spaces**, **Saved** and **My requests** only. Staff approval, cleaner work, host management, and notifications remain in their separate protected workspaces. **Find a space** is collapsible. Calendar check-in/checkout selection takes two date clicks across months, with half-hour or full-hour time dropdowns. The independent server quotation engine still caps any booking at **72 hours** (3 days), so a longer range can be selected for discovery but cannot receive a confirmed reservation quote; the UI explicitly explains this.

The location map uses actual approved public-area data with type-specific house, studio, apartment/high-rise, production set, outdoor and dungeon/castle icons. Non-passive wheel interception prevents scrolling the page while zooming the map, and double click/tap zooms in; drag pans and updates approved area search. The map canvas has only zoom in, zoom out and a fixed north compass, with legally required OpenStreetMap attribution below the map. A contracted tile provider can replace the active-viewport OSM tile source without changing hosting. **The live database contained 13 approved public area anchors and no active approved properties**, so there are no fabricated test markers.

**Production deployment verified:** `host_address_public_opt_in_20261119` was applied to the existing Supabase project. The `hosting-marketplace` Edge Function is ACTIVE at **version 15**, with JWT verification. The new `property_private.public_address_visible` column defaults to `false`; zero properties had opted in at verification. Its existing RLS is enabled with an authenticated owner-only SELECT policy. The service may expose an exact address and optional owner-provided map coordinates only for active independently approved listings when the host explicitly enables public sharing. All other addresses stay owner/approved-booking private and all entry instructions remain in the protected booking flow. Updated Host Connect category `apartment` and approved-area assignment are source-controlled.

Signed-in screens retain white surfaces while gaining restrained cyan/violet/fuchsia public-homepage accents. The logged-out Content Connect and Host Connect hero artwork, pages, and hosting configuration were not changed. **Bolt frontend publication is still required:** the latest GitHub `main` must be synchronized and published from the existing Bolt project before real-browser acceptance of the new UI. Gamma Entertainment provider enrollment is pending approval and no affiliate ads were activated.

### Feed composer, durable account preferences, Discovery and Host Connect responsive refresh (November 19, 2026)

The logged-in Feed composer is intentionally compact: a text area with an **attach-photo icon** and **paper-airplane send icon inside the box**. The audience dropdown and Friends / Following / Discover tabs are removed from the dashboard. A small Feed settings icon links to **Settings → Feed preferences**, where each member chooses their default publishing audience (Entire verified community, Friends only, or Only me) and home Feed view (Discover, Friends, Following). Preferences are stored in `ccx_feed_display_preferences` with per-user PostgreSQL RLS (and a default of verified community / Discover) so they persist across devices and logins. The original post-specific visibility, Premium publishing, signed photo access, and moderation/rights checks remain enforced; changing defaults cannot change existing post audiences. Administrators also have Feed preferences available alongside their platform settings.

On mobile, the member Discovery filter panel is **collapsed by default** and expands by tapping its header; it starts expanded on desktop. The signed-out Host Connect hero uses `/Host_Connect_Banner_Mobile.png` at 640px and below, while its existing desktop banner `/Host_Connect_Banner.png` remains unchanged at wider screens. Host Connect provides a visible **Log out** button for authenticated users on mobile and desktop. Host Connect and Content Connect footer content is centered on both desktop and mobile layouts; the original public homepages, artwork files and authenticated styling boundary are preserved.

The frontend changes are source-controlled through GitHub and require republishing the existing Bolt project to go live. The preferences database migration must be deployed and its RLS verified before a refreshed frontend is published. No CCBill, Gamma affiliate program, production identity admission or public safety intake gate is enabled by these UX changes.


### Compact Feed and Host Connect mobile hero deployment (November 19, 2026)

**Source:** PR #47 merged after all five CI workflows passed (application quality gate, Feed/Groups privacy integration, identity database, collaboration integration and dashboard validation). The guest dashboard Feed composer now places the photo attachment and send airplane buttons inside its text box; photo rights/nudity attestations appear only when a file is selected. The member's account-level post audience and home Feed view are selected in **Settings → Feed preferences** (including administrator Settings), not via dashboard tabs or a visible composer dropdown.

**Production database:** `feed_member_display_preferences_20261119` migration applied to the existing Supabase project. `ccx_feed_display_preferences` has RLS enabled with three member-owned SELECT/INSERT/UPDATE policies, and anonymous roles cannot read it. The independently tested policies deny cross-account reads or writes. Verified current saved rows: zero; returning members use default Discover / Entire verified community until they save a choice. No synthetic preferences or member data were inserted.

Mobile Discovery filters default collapsed, desktop defaults expanded. Footer content in both branded properties is centered at every width. The signed-out Host Connect homepage uses the **existing** `Host_Connect_Banner_Mobile.png` at 640px and below and retains the original desktop banner above it. Host Connect's authenticated header has a clearly labeled Log out button on desktop and mobile. The public hero files themselves, Bolt hosting, production identity acceptance, payment and public safety approval gates were not altered.

**Publication boundary:** The latest GitHub `main` contains the frontend changes, but publishing them from the existing Bolt project is still the owner's separate action. The database release alone does not update the website's appearance.

### Host Connect mobile benefits and footer (November 19, 2026)
The signed-out Host Connect benefits grid uses native accessible `<details>` cards: mobile feature summaries are collapsed by default and can be expanded individually, while desktop cards remain expanded. The redundant **Return to Content Connect X** link beneath the signup area is removed. The centered footer stacks **Host Connect** above the **Content Connect X** link and copyright. Mobile hero assets and signed-in account controls are unchanged. The public marketing text now describes the proposed standard 24-hour host booking window, with actual booking engine and daily rate migration tracked separately; prior hourly price quotes remain active until the new tested database migration is installed.
