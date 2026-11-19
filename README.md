# Content Connect X / Host Connect — Developer ReadMe

**Canonical operational reference · updated November 19, 2026**  
**Source of truth:** deployed server configuration and schema, current GitHub `main`, and verified release checks. Do not mistake a code module, enabled UI flag, mocked integration, or archived design for a production capability.

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
| **DocuSign** | Authorized electronic signatures and completed evidence | Integration source exists; not certified for actual collaboration signing |
| **CCBill** | Authorized member subscription and approved rental checkout | Integration source exists; live merchant flows require provider approval, secrets and transaction testing |
| **Voice/video provider** | Future authorized private calls | **Not enabled**; never issue a room token from the browser |

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
| Public trust/safety report intake | **Disabled**; policy/reviewer-coverage approvals absent | Establish actual staffed response, timely handling and escalation before opening |
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

Original ID and facial evidence are sensitive. Store only justified evidence in restricted Supabase Storage with access audit, bounded signed URLs, encryption/key controls, explicit deletion schedule and case-based legal hold. Durable decision manifests and hashes are not equivalent to retaining all original images or making the evidence immutable. Law enforcement never receives a standing unrestricted backend login.

## 6. Collaboration lifecycle, agreement and consent

Collaboration records support membership, invitations, versioned plans, professional roles, consent and draft contracts. The system maintains a historical participant record; hiding a collaboration from the dashboard does **not** erase required contract/consent/audit data. Paid features must never permanently block a participant from retrieving records the platform still lawfully retains.

**Proposed state model (not a claim currently enforced everywhere):**
`draft → proposed → accepted → scope-agreed → awaiting-signatures → signed → scheduled → ready → completed → reviewed → archived`.
Cancellation, withdrawal, dispute, blocked scheduling and revision are separate paths; no frontend-only transition controls release.

A collaboration plan contains time-zone aware dates, location or approved Host property reference (**not** a confirmed booking), proposed scope, roles, professional deliverables and usage rights. Individual participation, recording, distribution and download consent are separate. Participants may reduce/withdraw consent; no earlier signature creates permission to force additional activities.

After production, each participant can confirm their own statement of actual activities/services and deliverables. That is not proof of another participant's conduct. Editing signed plans requires explicit amendment/version, renewed consent and signatures when needed. A completed DocuSign event and its certificate must be verified server-side and linked immutably; a saved JSON draft is not a signed contract.

Invitations require an accepted connection or real reciprocal conversation. Unsolicited-volume and decline cooldown restrictions are server-controlled. Appeals and anti-retaliation are required for fair enforcement.

## 7. Representation and exclusivity

Representatives and professionals enter distinct role-scoped agreements. Backend records agreement terms/hash, mutual acceptance, dates, notice, renewal proposal and private audit history. Active public profile linking contains **only** professional names/roles permitted by the signed agreement. Terminated or expired representation must not convey continued privileges.

**Still required:** cross-agreement exclusivity conflicts; a represented participant's contract-signing workflow with scope-limited agent permissions; verified notifications and renewal acceptance; real-world legal review. A representative cannot withdraw or override a creator's consent on their behalf.

## 8. Host Connect booking and payments

Host listings and requests need atomic time-slot reservations, property/host approval, IANA time zones, transparent quote snapshots, booking state, capacity limits, property rules, private location access, cancellation handling, refunds/holds where applicable, and dispute records. Selecting a property on a collaboration plan **does not reserve it**.

CCBill provider adapters are separate for membership versus approved marketplace charges. Subscription or booking entitlements arise only from authenticated/reconciled server events. Do not infer payment from a redirect or a screenshot. No automatic earnings split or escrow promise is made: such services require actual processor approval and a separate legal/accounting design.

## 9. Trust reporting, privacy, moderation and compliance

Content Connect and Host Connect are professional marketplaces, not content distributors. This does **not** eliminate duties arising from hosting profiles, messages, private records or user-uploaded material.

The public reporting interface must work without a paid account once a monitored staffed response is operational. Reports require a reference, real case routing, severity triage, deadline tracking, evidence access and deletion/hold policy, reporter updates, qualified human moderation and appeals. The server-side trust intake is currently deployed **but disabled** for new public submissions. Its new private follow-up allows a reporter to check a *previously accepted* report only with both its random receipt reference and a separate private access code (not saved in browser storage). MFA-approved staff must explicitly claim a case before changing its outcome; case queue age and internal due dates are visible only to authorized reviewers. These features do not create staffing, emails, automatic removal, law-enforcement access or legal compliance on their own. Reporting suspected crime is distinct from a publicly visible rating or unreviewed allegation.

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
| Travel calendar / ScheduleEntry | Timezone-correct schedules and consented travel-availability sharing | REBUILD |
| Automatic recurrence, Google Calendar/Outlook sync | Provider-backed synchronization with recurrence acceptance tests | REBUILD later |
| Social media link verification | Owner-opted-in premium professional link visibility; validation remains | REBUILD selectively |
| FriendSettings / MESSAGE_FIRST / NO_ONE | Current mutual connection + two-way invite guard; expand privacy settings | REBUILD |
| FriendActivityLog and decline warnings | Audited anti-spam cooldown, appeal and fair recipient limits | REBUILD |
| IdentityFingerprint and consistency agent | Privacy-reviewed duplicate-account detection with human appeal | REEVALUATE |
| SafetyCheckInWidget and SafetyCheckIn history | Consent-aware production safety check-ins without permanent tracking | REBUILD |
| ConsentRevocation automated takedown | Real consent withdrawal, scope changes and case handling | REBUILD |
| TestingCredential, TestingRequirement, TestingDeadline jobs | Provider-confirmed, explicit opt-in binary work clearance if legally appropriate | REPLACE |
| Work-health document sharing | Do not expose private medical records to collaborators | RETIRE raw sharing |
| ComplianceRecord and compliance-score events | Audited case outcomes and documented control checks | REPLACE |
| CompliancePortalAccess | Narrow lawful case-specific disclosure with logged authorization | REBUILD |
| AI safety agent, AgentRun, AgentFlag | Human-review-first prohibited-solicitation/abuse detection | REPLACE |
| AIRiskPrediction | No opaque automated permanent restriction or public criminal risk score | RETIRE |
| AIMatchSuggestion / `generateMatches` | Explainable skill/availability/location matching, no sensitive-data ads | REPLACE |
| ReputationScore calculation | Moderated verified completed-work feedback, appeals and clear provenance | REPLACE |
| Background screening scanner | Separate lawful vendor-supported service with human review if justified | DEFER |
| `autoCreateEarnings` and `updateEarningsSettlement` | No automatic payment/earnings promise in initial marketplace | RETIRE |
| Gallery, GalleryPermission, media albums | Non-explicit professional portfolios, separate access-controlled document vault | REBUILD selectively |
| Full raw video/file delivery features | Non-explicit artifacts and permitted external delivery receipts only | RETIRE explicit hosting |
| Profile AI bio generator | Optional professional writing assistance subject to moderation | DEFER |
| Custom tags, city submissions and catalog moderation | Controlled professional taxonomies/region catalog | REBUILD selectively |
| QuickTask / creator action widget | Contextual readiness tasks inside collaboration, not a global task farm | REPLACE |
| Provider-to-Drive contract export | Optional later authorized document connector | DEFER |
| Google calendar automatic event creation | Optional later synchronized events after OAuth approval | DEFER |
| Platform-specific admin agent console | Real safety/financial/provider operations dashboard with least privilege | REPLACE |
| Legal hold / compliance evidence exports | Case-scoped audit exports, retention and verified lawful requests | REBUILD |
| Coupon / CouponRedemption | Processor-approved membership promotions, not self-created payment grants | DEFER |
| Automated affiliate networks and payout attribution | Reviewed contextual professional sponsorship/affiliate attribution | DEFER pending partner approval |
| One-click voice/video rooms | Authorized participants, provider tokens and recording-off default | REBUILD |
| Miscellaneous retired backend shortcuts and stale UI modules | Remove only after owner decides and parity/usage evidence is recorded | REEVALUATE |

**Decision instructions:** Mark each item REBUILD, REPLACE or RETIRE after reviewing the current implementation. Do not remove unknown legal records or re-enable retired services as a side effect of the documentation cleanup.

### Identity recovery reliability increment (November 19, 2026)

The capture interface deduplicates its approved-session completion callback across repeated or concurrent status checks, while allowing retry if the callback itself fails. This is **frontend navigation reliability only**, not a new source of verification authority, a change to member admission, or evidence of real-ID acceptance. Production self-hosted verification remains disabled pending issue #26's real-document, liveness, false-positive, retention and human-review gates. Existing immutable evidence still requires a fresh session for recapture; selective-side retake is not yet implemented.
