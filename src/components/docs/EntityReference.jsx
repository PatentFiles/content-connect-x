import React from 'react';
import CCCard from '@/components/ui-custom/CCCard';

export default function EntityReference() {
  return (
    <section id="entities" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <span className="text-[#4F8CFF]">🗄</span>
        4. Entity Reference (Source of Truth)
      </h2>
      <CCCard className="space-y-6">
        {[
          {
            name: 'UserProfile', purpose: 'Extended profile data for all users',
            fields: 'user_id, real_name, display_name, age, ethnicity, bio, role_type, is_admin, avatar_url, cover_url, profile_theme, base_location, travel_enabled, travel_regions, availability_dates, visibility_settings, last_active_at, response_time_hours, profile_complete, primary_representation_type, primary_representation_id, allow_direct_contact_while_represented',
            enforcement: 'Only visible to verified+subscribed users. Admin can see real_name.',
            ui: 'Profile, ViewProfile, Discovery, Search, ProfileCard',
          },
          {
            name: 'Collaboration', purpose: 'Core entity for all collaboration agreements',
            fields: 'collaboration_name, participant_ids[], scene_type, acts_selected[], boundaries, compensation_type, schedule, location, deliverables, usage_rights, status (draft→signed→completed), created_by_role, conversation_id',
            enforcement: 'Friend gate via validateCollaborationFriendGate. Testing checked before contract initiation. All status transitions logged.',
            ui: 'CreateCollaboration, CollaborationDetail, Collaborations list',
          },
          {
            name: 'Contract', purpose: 'Legal agreement for collaboration',
            fields: 'collaboration_id, template_type, status (draft→signed), parties[], scenes[], post_scene_rules (revenue_split, platforms[], takedown_policy, ai_use_policy), pdf_url, signed_version_hash, signatories[]',
            enforcement: 'Cannot initiate if testing not satisfied. Immutable snapshot on full signature. All changes in ContractAuditLog.',
            ui: 'ContractManager, ContractViewer, ViewContract, Contracts list',
          },
          {
            name: 'TestingCredential', purpose: 'Health testing credentials for creators',
            fields: 'user_id, status_badge (valid/expired/pending_review), tested_at, expires_at, docs_private_url, share_settings, verified_by_admin',
            enforcement: 'Must be "valid" to satisfy testing requirements. Expiry checked via checkTestingDeadlines.',
            ui: 'Testing page, CollaborationDetail, TestingStatusBanner',
          },
          {
            name: 'TestingRequirement', purpose: 'Testing requirements per collaboration',
            fields: 'collaboration_id, user_id, requirement_type, satisfied, satisfied_at, testing_credential_id',
            enforcement: 'Checked before contract initiation (validateTestingRequirements). All must be satisfied=true.',
            ui: 'CollaborationDetail, TestingPolicyManager',
          },
          {
            name: 'ConsentRevocation', purpose: 'Record of consent being revoked post-scene',
            fields: 'collaboration_id, contract_id, revoking_user_id, reason, revoked_at, takedown_deadline, takedown_completed_at, admin_notes',
            enforcement: 'Immutable once created. Triggers takedown obligations. All parties notified.',
            ui: 'ConsentRevocationManager, ConsentRevocationBanner, CompliancePortal',
          },
          {
            name: 'Friendship', purpose: 'Friend relationships between users',
            fields: 'requester_user_id, addressee_user_id, status (PENDING/ACCEPTED/DECLINED/CANCELLED), dm_thread_id, gating_mode_at_request, decline_cooldown_until',
            enforcement: 'Status transitions via validateFriendRequestEligibility. Cooldown on DECLINED. Rate limits via FriendSettings.',
            ui: 'FriendRequestButton, FriendRequestsList, FriendsList, Connections',
          },
          {
            name: 'FriendSettings', purpose: 'Friend request policy per user',
            fields: 'user_id, friend_request_policy (EVERYONE/MESSAGE_FIRST/NO_ONE), allow_collaboration_invites_non_friends, friend_count_visibility, friend_request_daily_limit',
            enforcement: 'Checked before sendFriendRequest. MESSAGE_FIRST requires prior conversation.',
            ui: 'FriendSettingsCard, FriendRequestButton',
          },
          {
            name: 'AgentRepresentation', purpose: 'Agent-creator relationship',
            fields: 'agent_user_id, creator_user_id, permissions (can_negotiate/can_sign_contracts/can_message/can_view_private_gallery), commission_rate, exclusive, status',
            enforcement: 'Agent actions checked against permissions. Exclusive flag enforced. Logged in AdminActionLog.',
            ui: 'RepresentationManager, Representations page',
          },
          {
            name: 'StudioRepresentation', purpose: 'Studio-creator relationship',
            fields: 'studio_user_id, creator_user_id, revenue_split, exclusive, status, contract_terms',
            enforcement: 'Studio auto-added as RepObserver via autoAddStudioObserver. Revenue splits validated via validateContractStudioSplit.',
            ui: 'RepresentationManager, RosterPortfolio',
          },
          {
            name: 'ScheduleEntry', purpose: 'Availability and travel dates',
            fields: 'user_id, entry_type (AVAILABILITY/TRAVEL/BOOKED), start_date, end_date, start_time, location_city, collaboration_id, status, locked',
            enforcement: 'Booked entries locked via lockCollaborationBooking. Released via releaseCollaborationBooking on cancellation.',
            ui: 'AvailabilitySchedule, TravelSchedule, AvailabilityCalendar, ViewProfile',
          },
          {
            name: 'Notification', purpose: 'In-app notifications',
            fields: 'user_id, type, actor_user_id, title, body, read_at, related_entity_type, related_entity_id, action_url',
            enforcement: 'Created per NotificationPreference settings. Real-time via polling.',
            ui: 'NotificationBell, NotificationsDropdown, Notifications page',
          },
          {
            name: 'VerificationRecord', purpose: 'Identity/age verification',
            fields: 'user_id, provider (yoti/passbase/manual), status (pending/approved/rejected/expired), verified_at, expires_at, rejection_reason, documents_submitted[]',
            enforcement: 'Must be "approved" to message, collaborate, or view profiles. Approval logged in AdminActionLog.',
            ui: 'Verification page, VerificationReviewQueue (admin), AccessGate',
          },
          {
            name: 'Subscription', purpose: 'Subscription status',
            fields: 'user_id, plan_id, status (active/cancelled/past_due/expired/trial), started_at, renews_at, payment_provider, external_subscription_id',
            enforcement: 'Must be "active" or "trial" for platform access. Checked via AccessGate.',
            ui: 'AccessGate, Pricing page, Settings',
          },
          {
            name: 'Gallery', purpose: 'User photo/video galleries',
            fields: 'user_id, type (public/private), items[] (url, type, caption)',
            enforcement: 'Private gallery requires GalleryPermission.status="granted". Comment policy via UserSettings.',
            ui: 'Profile, ViewProfile, GalleryGrid, GalleryLightbox',
          },
          {
            name: 'Report', purpose: 'User/content reports',
            fields: 'reporter_id, target_user_id, target_content_type, reason, status (pending/investigating/resolved/dismissed), admin_notes, resolved_at',
            enforcement: 'Immutable — cannot be deleted, only dismissed. All actions in AdminActionLog.',
            ui: 'ReportModal, ReportsQueue (admin)',
          },
          {
            name: 'AdminActionLog', purpose: 'Immutable audit log for admin actions',
            fields: 'admin_user_id, action_type, target_entity_type, target_entity_id, before_state, after_state, reason',
            enforcement: 'Append-only. Cannot be edited or deleted.',
            ui: 'AdminDashboard, SessionHistoryViewer',
          },
          {
            name: 'CollaborationActivityLog', purpose: 'Immutable activity log for collaborations',
            fields: 'collaboration_id, actor_user_id, activity_type, description, metadata',
            enforcement: 'Append-only. Covers all collaboration state changes.',
            ui: 'ActivityFeed (CollaborationDetail), CompliancePortal',
          },
          {
            name: 'ContractAuditLog', purpose: 'Immutable audit log for contract changes',
            fields: 'contract_id, actor_user_id, action_type, version_before, version_after, changes_json, signature_hash',
            enforcement: 'Append-only. Covers contract generation, edits, signatures.',
            ui: 'ContractAuditLog component, CompliancePortal',
          },
          {
            name: 'BookingRequest', purpose: 'Booking requests between users',
            fields: 'requester_user_id, recipient_user_id, schedule_entry_id, requested_date, requested_time, message, status (pending/accepted/declined/cancelled), response_message, responded_at',
            enforcement: 'Created from ViewProfile booking flow. Recipient notified. Accepted bookings can create ScheduleEntry.',
            ui: 'BookingRequestModal (ViewProfile), BookingRequestsInbox',
          },
          {
            name: 'ProfileView', purpose: 'Profile and gallery view tracking',
            fields: 'profile_owner_id, viewer_user_id, viewed_date, view_type (profile/gallery)',
            enforcement: 'Auto-created on profile/gallery view (once per day per viewer per profile). Used for analytics.',
            ui: 'ViewProfile, ProfileAnalytics (Profile page)',
          },
          {
            name: 'GalleryComment', purpose: 'Comments on gallery items',
            fields: 'gallery_id, item_index, profile_owner_id, commenter_user_id, commenter_display_name, commenter_avatar_url, content',
            enforcement: 'Respects UserSettings.privacy.gallery_comment_policy (everyone/friends_only/no_one).',
            ui: 'GalleryComments, GalleryLightbox',
          },
          {
            name: 'AIMatchSuggestion', purpose: 'AI-generated match recommendations',
            fields: 'user_id, suggested_user_id, match_score, reasons[], dismissed, clicked',
            enforcement: 'Generated by generateMatches function. Read-only for users. Dismissed flag prevents re-showing.',
            ui: 'MatchSuggestions, Discovery',
          },
          {
            name: 'AIRiskPrediction', purpose: 'AI risk scoring for users/collaborations',
            fields: 'entity_type, entity_id, risk_score, risk_factors[], prediction_model, confidence',
            enforcement: 'Generated by executeAgentScan. Read-only. Used by admins for prioritization.',
            ui: 'AIRiskPrediction component, CompliancePortal',
          },
          {
            name: 'AgentFlag', purpose: 'AI agent-flagged items for admin review',
            fields: 'agent_run_id, flag_type, entity_type, entity_id, severity (low/medium/high/critical), reviewed, reviewed_by, action_taken',
            enforcement: 'Created by compliance agent. Admins review via AgentFlagsList.',
            ui: 'AgentFlagsList, AgentManagement',
          },
          {
            name: 'ContentCatalogItem', purpose: 'Platform catalog of scenes/acts/platforms',
            fields: 'category (scene_pairing/standard_act/fetish_act/kink_edge_act/platform/deliverable/usage_right/niche_tag), value, status (active/disabled/archived), approved_by, usage_count',
            enforcement: 'Admin-moderated. Users submit CustomValueSubmission. Approved items become catalog entries.',
            ui: 'CatalogModeration (admin), CreateCollaboration, ProfileWizard',
          },
        ].map(entity => (
          <div key={entity.name} className="border border-[#263248] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-1">{entity.name}</h3>
            <p className="text-xs text-[#9AA6BC] mb-2"><strong className="text-[#E8EEF9]">Purpose:</strong> {entity.purpose}</p>
            <p className="text-xs text-[#9AA6BC] mb-1"><strong className="text-[#E8EEF9]">Key Fields:</strong> {entity.fields}</p>
            <p className="text-xs text-[#9AA6BC] mb-1"><strong className="text-[#E8EEF9]">Enforcement:</strong> {entity.enforcement}</p>
            <p className="text-xs text-[#9AA6BC]"><strong className="text-[#E8EEF9]">UI Dependencies:</strong> {entity.ui}</p>
          </div>
        ))}
      </CCCard>
    </section>
  );
}