# Content Connect X / Host Connect — marketplace, trust, identity and monetization requirements

Date: 2026-11-19. Product roadmap, **not** a certification of compliance or a claim that every feature is live.

## Implemented in PR #21 (verify deployment separately)

- One Discovery destination; Search redirects to Discovery and its professional-role, country, region, city, name, category and opt-in gender filters. Mobile bottom tabs: Dashboard / Testing / Discovery / Collaborations / Favorites.
- Private identity pilot: green pass / red failure, concise failure dialog; capture UI is immersive during the existing server-validated head turns, 3-2-1 countdown and visible flash. First, optional middle, and family-name fields, including hyphens; submitted as exact combined legal name.
- Custom Dashboard: optional full-width Saved Properties grid via existing approved marketplace browse and owner favorites, no exact addresses; existing layouts remain untouched.
- PostgreSQL rejects certain **clear solicitations for paid sexual services** on profile insert/update; creator and professional profile editors explain the same prohibition. Heuristics are narrow by design. Legitimate legal discussion and ordinary camera/studio/editor rates must remain allowed.
- Draft terms explicitly forbid paid sexual services, coercion, and expanding the scope of a signed production agreement without new documented mutual consent. No purported universal waiver of legal liability.

## Identity-verification incident and remediation boundaries

Reported observation: first/middle name joined, OCR expiration date incorrect, and document cross-check/authenticity/face/liveness checks failed. Railway logs for 2026-11-19 show the first head-turn challenge passed but the second challenge failed direction and return-to-center. This does NOT prove the ID or participant is fraudulent. Synthetic tests are not genuine-document acceptance tests.

- Do not relax document validation, barcode checks, facial thresholds, or age rules to force a pass.
- Do not display low-confidence OCR as a verified document field. If front/back or MRZ conflicts, stop automatic approval and permit a new capture or qualified alternative review.
- Assess a qualified identity vendor (Yoti is already integrated in onboarding) against the homegrown worker on genuine consenting fixtures, false-rejection rates, barcode accuracy, liveness spoof resistance, accessibility, privacy, cost and country coverage.
- Pilot evidence remains scheduled for 24-hour deletion and is not a long-term identity vault. Production verification can retain minimal signed evidence metadata, audit events and controlled evidence only after purpose-specific legal assessment, retention schedule, notices, encryption/key management, role-limited access, deletion and lawful holds.
- The user's uploaded genuine ID and selfie must never appear in CI artifacts, code, app previews, logs or unprotected file links. Do not access raw private evidence to debug without a secure, scoped process and documented need.

## Launch-critical safety capabilities — planned, not built by PR #21

1. Require independent verification and appropriate controls before a participant is discoverable or can collaborate. An ID check is not a promise of safe behavior.
2. Content and abuse reporting: functioning **public** intake, immediate safety triage, actual content disabling/removal where required, reporter updates, NCMEC/legal reporting as applicable, documented appeal and evidence-preservation procedures. Follow actual applicable statutory deadlines.
3. Consent: before each production, each participant voluntarily records an explicit statement that they are capable of consenting and not coerced. Never treat a self-recorded statement as proof of sobriety or freedom from coercion. Store auditable records only with a purpose-bound retention policy and clear access controls. Participants may withdraw or reduce scope at any point; adding activities requires new consent and signed version, not unilateral change.
4. Post-collaboration two-sided feedback: submit privately and independently; show only aggregated, verified collaboration information after anti-retaliation, identity/fraud checks, moderation and appeals. Reports and allegations must never alone produce automated permanent bans or public criminal labels. Immediate temporary restrictions for credible imminent harm need a human review path.
5. Messaging, friendship and collaboration-gated voice/video calls: use a compliant service with reporting controls, consent for any recording, record-access limits and documented deletion. No unannounced recordings.
6. Marketing: responsive **clearly labeled** professional sponsorship placements on web/mobile. No intrusive login pop-ups by default; no ads selected using sexual orientation, sex life, health data, ID evidence or private messages. No pornographic affiliate enrollment, ad pixels or tracking activated in this release. Do not claim a sponsorship until contracted and configured.
7. Country allowlist: legal counsel review for US, UK, individual EU jurisdictions, Canada and Australia before rollout; enforce restrictions server-side, in billing and during marketing. Business exclusions must be country-based, not religion/ethnicity-based.
8. Legal pages: keep stable deep-linkable routes for privacy, terms, removal, law enforcement and accessibility. Modal summaries may be supplementary, but must not hide required reporting or cookie controls. Operator identity and lawyer-approved text required before final policy assent.
9. Premium social links: existing server permission check is authoritative. A free user can be told that professional links are premium without exposing exact private link destinations; owners must opt in before any links are shared.
10. Pricing must enumerate verified current feature availability, role restrictions and actual billing readiness; do not market disabled features as included. CCBill remains the designed billing path, not a verified live merchant approval.
11. Design system: authenticated surfaces use shared tokens, predictable grid spacing, mobile safe-area insets, accessible keyboard focus and contrast. Custom modules must use the same primitives.
12. Product copy may describe verified identities and auditable workflows **only when those gates are operational and confirmed**. No blanket statement that meetings, participants, or the platform are 100% safe; no claim of total immunity from liability.

## Primary references
- NIST SP 800-63A-4 (2025): https://csrc.nist.gov/pubs/sp/800/63/A/4/final
- Yoti document authenticity: https://developers.yoti.com/identity-verification/document
- FTC TAKE IT DOWN Act: https://www.ftc.gov/business-guidance/resources/complying-take-it-down-act
- Supabase signed URL key controls: https://supabase.com/docs/guides/storage/security/signing-keys

## Source-of-truth synchronization
This is a requirements addendum to the authoritative Developer ReadMe supplied with the project. After merging any production enforcement change, reconcile the app's canonical README, entity/index schemas, migration history, and automated tests. A roadmap item does not override the actual deployed database function or provider verdict.
