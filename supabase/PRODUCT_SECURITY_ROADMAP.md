# Content Connect X — Supabase Product & Security Roadmap (2026-11)

This document is the **current migration product contract** for the Supabase replacement. The legacy `src/pages/DeveloperReadMe.jsx` describes the intended multi-role business workflows, but its Base44-specific assertions of being "production ready" do **not** establish that the Supabase implementation has been end-to-end verified.

## Product identity

A verified professional collaboration network for adult content creators, performers, photographers, videographers, editors, agents, studios, and location hosts. The two connected systems in the legacy ReadMe remain in scope:

1. **Collaboration Network:** discovery, availability/travel, invitations, messaging, consent, agreements, work-clearance validation, project completion, disputes and reputation.
2. **Hosting Marketplace:** studios/locations, availability, bookings, private access instructions, equipment, incident reporting, and reviews.

## Membership and safety tiers

| Capability | Unverified signup | 18+ verified free | 18+ verified premium |
|---|---|---|---|
| Register/login and submit ID/selfie | Yes | Yes | Yes |
| Account/profile setup | Limited | Yes | Yes |
| Public-facing creator previews | No | Limited sanitized discovery | Full approved search |
| Send abuse report, block, withdraw existing consent | Always available after authentication | Yes | Yes |
| Mutual connections, direct messages, collaborations | No | Preview only | Yes |
| Signed agreements and project consent workflow | No | Existing consent withdrawal remains available | Yes |
| STI work-clearance verification tools | No | No | Yes, current status only |
| Optional third-party background screening | No | No | Opt-in request only until provider configured |
| Studio listings, bookings, scheduling | No | Previews | Yes after operational launch |

**The age check is required for every user, including admins.** Staff cannot verify themselves. The initial administrator must be provisioned through a reviewed trusted bootstrap process after independent ID/age confirmation; never grant admin from browser-editable profile data.

**Safety is not a paywall.** Reporting and withdrawal of previously recorded consent are not blocked because someone's subscription expired or account was suspended.

## Trust signals are distinct

- **Age verified:** Identity/age determination from private ID review; not a background check.
- **Creator/portfolio verified:** Professional presence or linked account verified; not an age or safety determination.
- **Current work-clearance confirmed:** Trusted provider confirmation with expiry; no individual medical diagnoses stored.
- **Optional background screening requested/completed:** Requires the member's separate authorization and an appropriately qualified screening provider. No criminal-history details in profile badges and no implication of personal safety.
- **Studio/agent verified:** Business identity, representation permissions, and actual contact authority reviewed separately.

Do not treat a self-reported value, screenshot, linked social account, or payment as sufficient to mark anyone "verified" in another category.

## Consent and production records

A single contract signature is **not** standing consent for all future scenes or uses. Record performer-specific participation/recording/distribution/download choices and scope. Keep signed terms immutable. A withdrawal pauses operations and alerts the production team; any removal/takedown request requires a human workflow and appropriate records. Implement jurisdiction-specific recordkeeping and retention with counsel before publication or commercial distribution. Federal recordkeeping rules may apply to certain producers and content: https://uscode.house.gov/us/usc/t18/s2257/

## Financial dependencies

The former Base44 ReadMe was CCBill-oriented. Stripe currently states it does not support businesses that sell or offer adult content/services: https://support.stripe.com/questions/prohibited-and-restricted-business-list-faqs . CCBill markets adult creator platform payment services: https://ccbill.com/industries/content-creator-platforms .

Until an appropriate merchant processor approves this **specific** platform, public checkout must remain disabled. Entitlements must be created exclusively from verified server-side payment webhooks with idempotency and audit.

## Competitive landscape / differentiators

- **CollabPls:** City-by-week board, confirmed overlapping trips, matching, shoot slots, tests/status and reviews: https://collabpls.com/about
- **JustCollabs:** Verified discovery and travel dates: https://www.justcollabs.com/
- **ModelBoard:** Creator/agency/studio production and compliance workflow: https://modelboard.net/about
- **PASS:** Standardized time-limited work clearance, with a yes/no determination instead of storing clinical reports: https://www.freespeechcoalition.com/pass
- **O F Collab Map:** City-based discovery and reviewed profiles: https://www.ofcollabmap.com/

**Positioning:** end-to-end verified production workflow rather than another directory: find → mutually connect → plan → confirm status → consent → sign → shoot → settle/review.

## Priorities for subsequent work

### P0 — Must work before operating with real members
- Authenticated multi-account tests covering unverified, verified free, premium, admin, suspended and expired memberships.
- Verify all access policies, signed URLs, identity review audit, self-verification prevention and consent withdrawal.
- Confirm a merchant processor accepts the actual adult-industry network model; implement and test their approved webhooks.
- Migrate existing Base44 users only with account-holder consent, secure identities and private documents, provider-backed verified states, and an explicit rollback plan.
- Restore the full legacy interface design, components and flows on Supabase rather than relying only on the replacement preview shell.
- Verify contract legal templates, co-performer consent, age/identity documentation and retention requirements with appropriate counsel.

### P1 — Product differentiators
- City-by-week availability, travel overlap alerts and shoot windows; opt-in approximate location, never private home coordinates.
- Granular matching preferences, two-sided contact permissions and anti-spam/anti-solicitation controls.
- Single production packet (participants, schedule, roles, confirmed work-clearance at the time of check, agreed scope, rights, emergency workflow and contract snapshots).
- Verified collaborator reviews after both parties confirm a completed collaboration.
- Agent/studio rosters with delegation permissions and explicit signing authority.
- Support reports, content complaint/appeal queue, takedown requests and dispute records.

### P2 — Scale and polish
- Mobile-first responsive UX using the legacy design system.
- Notifications (transactional email + in-app realtime), deep links and reminders with opt-outs.
- Activity metrics: verified conversion, match-to-conversation, collaboration-to-completion, revenue per active professional, and safety response times.
- Optional background checks provided by a qualified vendor, with the necessary consent/disclosure/adverse-action workflow for the particular use.
- Booking operations (availability, cancellation, equipment, deposits, insurance) only after transaction and operational rules are validated.

## Current implementation state

- Supabase has its own project, member database with RLS, private storage, and authenticated Edge Functions.
- Basic Supabase preview screens cover authentication, profiles, discovery, messaging/collaboration drafts, contract signature records, booking requests, consent recording and withdrawal, and safety controls.
- Additional work-clearance and optional background-screening request foundations are implemented, **not** a live PASS or background-check provider integration.
- Stripe checkout is deliberately disabled unless specifically approved and configured.
- The legacy React/Base44 application remains in the repository for reference and is not yet fully ported.
- No claim of completed end-to-end authorization, billing, compliance, test automation, or data migration is warranted until those are actually tested and documented.
