import React from 'react';
import { Activity } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';

export function RecentChangesSection() {
  const changes = [
    { date: 'March 2026', title: 'Booking System — Full Studio, Photographer & Videographer Pipeline', items: [
      'BookingRequest entity created with booking_type: creator/photographer/videographer/studio',
      'acceptBookingRequest backend function creates Collaboration on booking acceptance',
      'Studio-specific fields: studio_location_name, studio_notes, room_label, max_bookings, current_booking_count',
      'BookingRequestModal added to ViewProfile page',
      'BookingRequestsInbox added to Photographer/Videographer/Studio dashboards',
      'StudioBookingModal and StudioAvailabilityManager components implemented',
    ]},
    { date: 'March 2026', title: 'Earnings Automation — autoCreateEarnings + updateEarningsSettlement', items: [
      'EarningsRecord entity added with gross_amount, net_amount, split_percentage, agent/studio commission fields',
      'autoCreateEarnings fires on Collaboration.status="completed", creates earnings per revenue_split',
      'updateEarningsSettlement admin function marks earnings as settled/disputed',
      'EarningsTracker component on Creator/Agent dashboards',
      'StudioEarningsDashboard component for studio revenue tracking',
      'AgentEarningsWidget on AgentDashboard for commission visibility',
    ]},
    { date: 'March 2026', title: 'Completion Flow — CompletionBanner + CompletionManager', items: [
      'CompletionBanner shown after filming date passes on CollaborationDetail',
      'CompletionManager modal allows participants to mark collaboration as completed',
      'checkCompletionReminders scheduled job sends reminders 3 days after filming date',
      'completeCollaboration backend function handles status transition and earnings trigger',
    ]},
    { date: 'March 2026', title: 'Identity Consistency — Fingerprinting + Duplicate Detection', items: [
      'IdentityFingerprint entity created using SHA-256 hash of name/DOB (never raw values)',
      'checkIdentityConsistency fires after VerificationRecord.status="approved"',
      'IdentityConsistencyFlag entity tracks suspicious matches with confidence levels',
      'IdentityConsistencyPanel in AdminDashboard for admin review',
      'Actions: clear (false positive), suspend, ban, add legal hold',
    ]},
    { date: 'March 2026', title: 'Safety Check-In System', items: [
      'SafetyCheckIn entity with status: pending/checked_in/safe/missed/escalated',
      'SafetyCheckInWidget shown on CollaborationDetail for signed/active collaborations',
      'Trusted contact and city-level location shared at check-in (never exact coordinates)',
      'Auto-escalation if user does not check out within 30min after expected end time',
      'Admin safety alerts queue updated to surface escalated check-ins',
    ]},
    { date: 'March 2026', title: 'Reputation Scoring — calculateReputationScore', items: [
      'ReputationScore entity with score 0-100 and label (new/established/reliable/highly_reliable/trusted)',
      'Factors: completed/cancelled/disputed collaborations, response time, verification, testing, account age',
      'calculateReputationScore backend function, scheduled daily',
      'ReputationBadge component on profiles and dashboard',
      'TopCreators component on Discovery page shows highest-scoring verified users',
      'Trust score included in discovery card and ViewProfile',
    ]},
    { date: 'March 2026', title: 'Discovery System — TravelSync, TopCreators, CollaborationFeed', items: [
      'TravelSync component: detects overlapping travel dates between users in discovery',
      'TopCreators component: ranked by ReputationScore, filtered by verification status',
      'CollaborationFeedItem entity + CollaborationFeed component: public activity stream',
      'Feed types: collaboration_completed, user_verified, user_newly_joined, travel_announced, testing_updated, milestone_reached',
      'visible_to: verified_members | all_members — admin controls feed item audience',
      'ProfileView entity tracks who viewed your profile (once per day per user)',
    ]},
    { date: 'March 2026', title: 'AI Contract Builder — Template + AI-Assisted Drafting', items: [
      'ContractTemplate entity with token_schema ({{token}} placeholders), applicable_roles, version',
      'TemplateContractGenerator component picks template + fills tokens from collaboration data',
      'AIContractBuilder component allows AI-assisted drafting via InvokeLLM',
      'Contract.template_type: creator_to_creator/studio_contract/photographer/videographer/agent_managed',
      'ContractVersion entity tracks all edits; ContractAuditLog ensures immutable history',
    ]},
    { date: 'April 2026', title: 'Unified Session Abstraction — Solo Sessions, Service & Location Bookings', items: [
      'SoloSession entity: session_type (solo_session/service_booking/location_booking), booking_mode (solo/collaboration), participant_mode (on_platform/external/mixed)',
      'Unified session concept sits above the Collaboration entity — solo sessions are first-class auditable records, not lightweight stubs',
      'manageSoloSession backend function: actions: create, confirm, attach_contract, contract_signed, complete, cancel, upgrade_to_collaboration',
      'upgrade_to_collaboration: converts a SoloSession into a full Collaboration without data loss — SoloSession preserved with collaboration_id set and upgraded_to_collaboration=true',
      'BookingRequest extended: booking_mode (collaboration/solo), participant_mode, session_type, solo_session_id — solo bookings route to SoloSession; collaboration bookings route to Collaboration as before',
      'acceptBookingRequest updated: isSoloMode branch creates SoloSession on accept instead of Collaboration — existing collaboration flow is 100% unchanged',
      'Collaboration entity extended with session_origin (direct/from_booking/upgraded_from_solo_session), solo_session_id, booking_mode, participant_mode — full audit trail on upgrade path',
      'External participants captured for external/mixed modes — stored for legal record-keeping, private and admin-visible only',
      'Agreement text snapshot captured at booking time and stored immutably on SoloSession.agreement_text_snapshot — no separate consent system',
      'All SoloSession status transitions write to AdminActionLog (SYSTEM_SESSION) — same immutable log pattern as Collaboration and Booking',
      'Solo sessions integrate with: contracts (existing Contract entity via attach_contract), ScheduleEntry (reserved/released on create/cancel), SafetyCheckIn (safety_checkin_id field), Notifications, EarningsRecord (via completion log)',
      'components/sessions/SoloSessionCard: compact status card for dashboards and inboxes',
      'components/sessions/SoloSessionBookingModal: 3-step booking flow (type/participants → schedule/compensation → agreement acceptance)',
      'components/sessions/SoloSessionsInbox: host/guest dual-mode inbox — feature-gated behind solo_sessions flag',
      'solo_sessions feature flag (default: off) controls all session UI surfaces via FeatureGate — enable from AdminDashboard → Feature Flags',
      'Architecture: solo_session is a leaf node; collaboration is an orchestrated multi-party agreement. A solo session can be promoted but a collaboration is never demoted.',
    ]},
    { date: 'April 2026', title: 'Feature Flag Architecture — Platform-Wide Module Rollout System', items: [
      'PlatformFeatureFlag entity: flag_key, label, category (core/safety/compliance/marketplace/experimental), value_type (boolean/number/text), bool_value/number_value/text_value, affects_nav, nav_pages, is_system',
      'lib/featureFlags.jsx: DEFAULT_FLAGS defines all known flags with in-code defaults. FeatureFlagProvider wraps App.jsx, fetches DB overrides every 2 min. DB always wins over defaults.',
      'Hooks: useFeatureFlag(key) → scalar value; useFeatureFlags() → full map; useFilteredNav(navItems) → nav array filtered by disabled flags.',
      'components/feature/FeatureGate.jsx: <FeatureGate flag="key"> hides children when flag is off. Supports fallback= and invert= props.',
      'Sidebar and BottomNav now use useFilteredNav() — disabling a flag with affects_nav=true auto-hides pages from both nav surfaces.',
      'AdminDashboard "Feature Flags" tab: FeatureFlagsPanel renders all flags grouped by category with live toggles, number inputs, and text inputs.',
      '24 initial flags seeded covering: messaging, discovery, collaborations, contracts, favorites, connections, portfolio, representations, verification, testing, search, comm_filter, safety_checkin, compliance_portal, hosting_marketplace (off), solo_sessions (off), gps_checkin (off), smart_lock (off), pro_host_tier (off), equipment_rentals (off), damage_deposits (off), favorites_by_type (off), max_messages_per_day=100, platform_policy_version=1.0',
      'pages/Messages comm_filter check now reads from useFeatureFlag("comm_filter") instead of static COMM_FILTER_ENABLED constant — flag toggleable live from admin panel without deploy.',
      'To add a new flag: add entry to DEFAULT_FLAGS in lib/featureFlags.jsx — it appears immediately in the admin panel and can be toggled without code changes.',
    ]},
    { date: 'April 2026', title: 'Communication Filter — Off-Platform Sharing Prevention', items: [
      'CommunicationViolation entity added: tracks user_id, conversation_id, violation_type, message_snippet (redacted), attempt_count, escalation_level, admin_reviewed',
      'lib/commFilter.js: pure detection logic for phone numbers, email addresses, external links, and obfuscated variants (dot/at encoding, social platform redirects)',
      'COMM_FILTER_ENABLED feature flag in lib/commFilter.js — default true, disable for phased rollout without code change',
      'Escalation levels: warn (1st attempt) → restrict (2nd-3rd) → flag_admin (4th+)',
      'Client-side pre-check in pages/Messages blocks send before server round-trip; warning clears on message edit',
      'CommFilterWarning component: reusable, level-aware inline warning rendered above message input',
      'Server-side enforcement in protectedActions send_message: returns comm_filter_blocked with violation_type and escalation_level',
      'Every violation writes to AdminActionLog (SYSTEM_COMM_FILTER) and CommunicationViolation — no separate audit system created',
      'flag_admin level also creates a Report (reporter: SYSTEM_COMM_FILTER) surfaced in existing Reports Queue / Safety Alerts',
      'No new moderation queue created — violations feed into existing Report + AdminActionLog architecture',
    ]},
    { date: 'April 2026', title: 'Timed Suspension Lifecycle + Banned Re-entry Dispute Flow', items: [
      'UserProfile extended with: suspension_start_at, suspension_end_at, suspension_category, reinstated_at, reinstated_by_admin_id, on_probation, probation_restrictions',
      'adminModerationAction now supports: suspend (7d/30d/6mo/1yr/custom), unsuspend, convert_to_ban, set_probation — all with immutable audit log writes',
      'Permanent ban remains a distinct action separate from timed suspension',
      'checkUserAccessStatus auto-expires timed suspensions server-side and logs SYSTEM_AUTO_EXPIRY action',
      'AuthContext client-side auto-expiry check prevents stale blockStatus from persisting after suspension ends',
      'AccountBlockedScreen shows suspension end date, reason category, and in-app dispute submission for banned users',
      'SuspensionManager component: SuspensionStatusBadge (inline badge) + SuspensionActionButtons (in user rows) — no duplication of moderation logic',
      'BannedReentryDispute entity added; admin panel surfaces prior ban reason, moderation history, identity match context from IdentityConsistencyFlag',
      'Admin decisions: deny permanently / approve reinstatement / approve with probation (feature-flagged) / request more info / mark under review',
      'Probation mode: restricted_messaging, no_hosting, no_accelerated_payouts, elevated_moderation — applied via probation_restrictions on UserProfile',
      'AdminDashboard: Re-entry Disputes tab added as lazy-loaded component',
      'All suspension/ban/reinstatement actions write to existing immutable AdminActionLog — no new logging system created',
    ]},
    { date: 'March 2026', title: 'Ban/Suspension Hardening + Account Deletion', items: [
      'UserProfile.banned, .suspended, .suspension_reason added and enforced on every action',
      'checkUserAccessStatus backend function returns access status before any protected mutation',
      'AccountBlockedScreen shown globally in Layout when user is banned/suspended',
      'deleteUserAccount function implements GDPR deletion with legal hold bypass',
      'UserProfile.legal_hold=true prevents deletion under investigation',
      'UserProfile.deletion_status lifecycle: requested → blocked_legal_hold → anonymized → completed',
    ]},
    { date: 'March 2026', title: 'Discovery & Search — Client-Side Filtering Unified', items: [
      'Both Discovery and Search now use useMemo-based client-side filtering',
      'Role quick-filter buttons added to Discovery matching Search layout',
      'TravelSync module centered in Discovery layout',
      'ProfileFilters moved to Near You section header',
      'Profile grid changed to 2-column layout (left-aligned)',
    ]},
    { date: 'Ongoing', title: 'ViewProfile — Booking & Private Gallery Access', items: [
      'BookingRequestModal added to ViewProfile for photographers/videographers/studios',
      'GalleryPermission.status="granted" checked for private gallery visibility',
      'Profile theme banners from PROFILE_THEMES when no cover image',
      'ProfileView entity records visits once per day per viewer',
    ]},
    { date: 'Ongoing', title: 'Profile — AI Bio Generator, Analytics, Gallery Grid', items: [
      'BioGenerator uses InvokeLLM to generate 3 bio suggestions from profile data',
      'ProfileAnalytics shows profile/gallery views per week via recharts',
      'GalleryGrid supports drag-and-drop reordering via @hello-pangea/dnd',
    ]},
    { date: 'Ongoing', title: 'Friends & Connections — Complete Friend System', items: [
      'Friendship lifecycle: PENDING → ACCEPTED / DECLINED / CANCELLED',
      'MESSAGE_FIRST gating: checks Conversation.participants_who_replied[] before request',
      '30-day cooldown after DECLINED enforced via decline_cooldown_until',
      'FriendGateWarning shown in CreateCollaboration if target requires friends',
    ]},
  ];

  return (
    <section id="recent-changes" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <Activity className="w-6 h-6 text-[#4F8CFF]" />
        18. Recent Changes & Updates
      </h2>
      <CCCard className="space-y-4">
        {changes.map((item, i) => (
          <div key={i} className="border-l-2 border-[#263248] pl-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[#6B7A94]">{item.date}</span>
              <h3 className="text-sm font-semibold text-[#E8EEF9]">{item.title}</h3>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
              {item.items.map((point, j) => <li key={j}>{point}</li>)}
            </ul>
          </div>
        ))}
      </CCCard>
    </section>
  );
}