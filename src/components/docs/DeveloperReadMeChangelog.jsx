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