import React from 'react';
import { FileText, AlertTriangle, Database, Shield, Users, Network, Calendar, FileCheck, Lock, Activity } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';

export default function DeveloperReadMe() {
  return (
    <div className="min-h-screen bg-[#0B0F14] pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-8 h-8 text-[#4F8CFF]" />
            <h1 className="text-3xl font-bold text-[#E8EEF9]">Developer ReadMe</h1>
          </div>
          <p className="text-[#9AA6BC]">
            Authoritative technical documentation for Content Connect. This document covers architecture, 
            enforcement rules, entity relationships, and system guarantees.
          </p>
          <div className="mt-4 p-4 bg-[#FF2DAA]/10 border border-[#FF2DAA]/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#FF2DAA] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#FF2DAA]">
                <strong>Critical:</strong> This documentation represents the source of truth for how the platform 
                enforces consent, verification, testing, and contractual obligations. Any changes to enforcement 
                logic must be reflected here.
              </div>
            </div>
          </div>
        </div>

        {/* Table of Contents */}
        <CCCard className="mb-8">
          <h2 className="text-xl font-bold text-[#E8EEF9] mb-4">Table of Contents</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { id: 'overview', title: '1. Platform Overview', icon: Network },
              { id: 'roles', title: '2. Role System', icon: Users },
              { id: 'directory', title: '3. Directory Tree', icon: FileText },
              { id: 'entities', title: '4. Entity Reference', icon: Database },
              { id: 'enforcement', title: '5. Enforcement Matrix', icon: Shield },
              { id: 'collaboration', title: '6. Collaboration Lifecycle', icon: Activity },
              { id: 'scheduling', title: '7. Scheduling & Availability', icon: Calendar },
              { id: 'testing', title: '8. Health, Testing & Compliance', icon: FileCheck },
              { id: 'representation', title: '9. Representation & Exclusivity', icon: Users },
              { id: 'friends', title: '10. Friends & Trust System', icon: Users },
              { id: 'discovery', title: '11. Discovery & Matching', icon: Network },
              { id: 'notifications', title: '12. Notifications System', icon: Activity },
              { id: 'admin', title: '13. Admin Systems', icon: Shield },
              { id: 'audit', title: '14. Audit & Legal Defensibility', icon: Lock },
              { id: 'agents', title: '15. System Agents', icon: Activity },
              { id: 'deployment', title: '16. Deployment & Production', icon: Database },
              { id: 'governance', title: '17. Change Governance', icon: Shield },
            ].map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#151D2B] text-[#9AA6BC] hover:text-[#E8EEF9] transition-colors"
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.title}</span>
              </a>
            ))}
          </div>
        </CCCard>

        {/* 1. Platform Overview */}
        <section id="overview" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Network className="w-6 h-6 text-[#4F8CFF]" />
            1. Platform Overview
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">What Content Connect Is</h3>
              <p className="text-[#9AA6BC] mb-3">
                Content Connect is a verified collaboration platform for adult content creators, photographers, 
                videographers, agents, and studios. It solves the problem of unsafe, unverified, and undocumented 
                collaboration arrangements in the adult content industry.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Core Problems Solved</h3>
              <ul className="list-disc list-inside space-y-2 text-[#9AA6BC]">
                <li><strong>Identity Fraud:</strong> Every member must complete age/identity verification</li>
                <li><strong>Unsafe Collaboration:</strong> Health testing requirements are enforced before contracts</li>
                <li><strong>Consent Violations:</strong> All contracts are versioned, timestamped, and immutable</li>
                <li><strong>Undocumented Agreements:</strong> Contract snapshots are stored at signing for legal defensibility</li>
                <li><strong>Representation Opacity:</strong> Agent/studio relationships are declared and enforced</li>
                <li><strong>Post-Scene Disputes:</strong> Consent revocation and dispute resolution are built-in</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Core Guarantees</h3>
              <ul className="list-disc list-inside space-y-2 text-[#9AA6BC]">
                <li><strong>Consent:</strong> All contracts require explicit signatures with timestamps</li>
                <li><strong>Auditability:</strong> All state changes are logged (AdminActionLog, CollaborationActivityLog, ContractAuditLog)</li>
                <li><strong>Verification:</strong> Messaging and collaboration features gate on verification status</li>
                <li><strong>Testing Enforcement:</strong> Testing requirements can block contract initiation and schedule locking</li>
                <li><strong>Immutability:</strong> Contract snapshots and audit logs cannot be edited after creation</li>
                <li><strong>Revocation:</strong> Creators can revoke consent post-scene, triggering takedown obligations</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Why Enforcement Exists</h3>
              <p className="text-[#9AA6BC] mb-2">
                The platform's enforcement rules are designed to prevent legal liability, protect participants, 
                and create an auditable trail for disputes. Key enforcement areas:
              </p>
              <ul className="list-disc list-inside space-y-2 text-[#9AA6BC]">
                <li><strong>Verification Gates:</strong> Prevent unverified users from messaging or collaborating</li>
                <li><strong>Testing Gates:</strong> Block contracts if testing requirements aren't satisfied</li>
                <li><strong>Representation Enforcement:</strong> Ensure agents/studios have proper permissions</li>
                <li><strong>Contract Versioning:</strong> Prevent backdating or unauthorized changes</li>
                <li><strong>Friend Gating:</strong> Optionally require friendship before direct collaboration</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 2. Role System */}
        <section id="roles" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#4F8CFF]" />
            2. Role System (Complete)
          </h2>
          <CCCard className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Creator</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Adult content performer</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Can create collaborations, negotiate terms, and sign contracts</li>
                <li>Can upload testing credentials (TestingCredential, TestingDocument)</li>
                <li>Can set representation (agent or studio) via AgentRepresentation or StudioRepresentation</li>
                <li>Can optionally delegate contract signing to agent (if agent has can_sign_contracts permission)</li>
                <li>Can revoke consent post-scene via ConsentRevocation</li>
                <li>Subject to friend gating policies for direct collaboration invites</li>
                <li>Can manage availability/travel dates via ScheduleEntry</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Agent</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Represents creators in negotiations</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Can represent multiple creators via AgentRepresentation</li>
                <li>Permissions per representation: can_negotiate, can_sign_contracts, can_message, can_view_private_gallery</li>
                <li>Can create collaborations on behalf of represented creators</li>
                <li>Can negotiate terms and handle messaging (if permissions allow)</li>
                <li>Cannot override creator consent revocation</li>
                <li>Revenue splits are enforced via Contract.post_scene_rules.revenue_split</li>
                <li>Audit logs capture all agent actions via AdminActionLog and CollaborationActivityLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Studio</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Produces content, manages contracts and spaces</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Can represent multiple creators via StudioRepresentation</li>
                <li>Automatically added as RepObserver to collaborations involving represented creators</li>
                <li>Can view (but not edit) contracts and schedules of represented creators</li>
                <li>Can enforce revenue splits and location provisions in contracts</li>
                <li>Can manage staff via StudioDetails.staff_seats (if implemented)</li>
                <li>Studio contracts require explicit revenue split terms</li>
                <li>Cannot override creator consent revocation</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Photographer</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Captures still images for collaborations</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Can be invited to collaborations as service provider</li>
                <li>Maintains rates/packages in ServiceDetails</li>
                <li>Can maintain public/private portfolios via ServicePortfolioItem</li>
                <li>Deliverable terms are captured in Collaboration.deliverables</li>
                <li>Usage rights are captured in Collaboration.usage_rights</li>
                <li>Can travel or work locally based on ServiceDetails.availability_type</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Videographer</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Captures video content for collaborations</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Same permissions and structure as Photographer</li>
                <li>Deliverable terms include editing scope and timeline</li>
                <li>Raw files and editing rights are negotiated in Collaboration.deliverables</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Admin</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Platform governance and safety</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Has UserProfile.is_admin = true</li>
                <li>Can review verification records (VerificationRecord status approval)</li>
                <li>Can moderate catalog submissions (ContentCatalogItem, CustomValueSubmission)</li>
                <li>Can view all reports (Report entity) and take action</li>
                <li>Can view session history (SessionHistory) for fraud detection</li>
                <li>Can manage agent/studio representations (AgentRepresentation, StudioRepresentation)</li>
                <li>Can review disputes (CollaborationDispute, ArbitrationCase)</li>
                <li>Cannot edit immutable audit logs (AdminActionLog, ContractAuditLog, CollaborationActivityLog)</li>
                <li>All admin actions are logged for accountability</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">RepObserver (Derived Role)</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Read-only observer for studio/agent contracts</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Not a standalone role type, derived from StudioRepresentation or AgentRepresentation</li>
                <li>Auto-added to collaborations via backend function (autoAddStudioObserver)</li>
                <li>Can view contracts, schedules, and documents</li>
                <li>Cannot edit or sign contracts</li>
                <li>Cannot message participants directly (unless also granted message permission)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">System Agents (AI)</h3>
              <p className="text-[#9AA6BC] mb-2"><strong>Primary Role:</strong> Automated analysis and flagging</p>
              <ul className="list-disc list-inside space-y-1 text-[#9AA6BC] text-sm">
                <li>Compliance & Safety Review Agent (agents/compliance_safety_agent)</li>
                <li>Discovery & Matching Optimization Agent (if present)</li>
                <li>Cannot write to entities (read-only)</li>
                <li>Can create AgentFlag records for admin review</li>
                <li>Can create AIRiskPrediction and AIMatchSuggestion records</li>
                <li>Execution tracked via AgentRun entity</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 3. Directory Tree */}
        <section id="directory" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#4F8CFF]" />
            3. Directory Tree (Full & Exhaustive)
          </h2>
          <CCCard>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Frontend Architecture</h3>
                <pre className="bg-[#0B0F14] p-4 rounded-lg text-xs text-[#9AA6BC] overflow-x-auto">
{`pages/
├── Landing.js                   - Public marketing page with stats
├── HowItWorks.js                - Feature explanation (public)
├── Pricing.js                   - Subscription plans (public)
├── FAQ.js                       - Common questions (public)
├── Terms.js                     - Terms of Service (public)
├── Privacy.js                   - Privacy Policy (public)
├── Dashboard.js                 - Main dashboard (role-specific)
├── Discovery.js                 - Profile discovery with filters
├── Search.js                    - Advanced search with AI
├── Testing.js                   - Testing credential management
├── Messages.js                  - Real-time messaging interface
├── Connections.js               - Friends list & requests
├── Collaborations.js            - Active/past collaborations list
├── CreateCollaboration.js       - Collaboration creation wizard
├── CollaborationDetail.js       - Single collaboration detail view
├── ViewProfile.js               - Public profile view
├── Profile.js                   - Own profile editor
├── Settings.js                  - User settings & preferences
├── Verification.js              - Identity verification flow
├── Favorites.js                 - Saved profiles
├── Contracts.js                 - Contract list view
├── ViewContract.js              - Single contract viewer
├── AdminDashboard.js            - Admin overview
├── CompliancePortal.js          - Admin compliance dashboard
├── RosterPortfolio.js           - Agent/studio roster view
├── Representations.js           - Manage agent/studio relationships
├── Portfolio.js                 - Service provider portfolio
├── AgentManagement.js           - System agents dashboard
├── AvailabilitySchedule.js      - Calendar availability manager
├── TravelSchedule.js            - Travel dates manager
├── Notifications.js             - Notification center
└── DeveloperReadMe.js           - This documentation (admin-only)

components/
├── layout/
│   ├── Layout.js                - Main app wrapper (auto-applied)
│   ├── NavBar.js                - Top navigation bar
│   ├── Sidebar.js               - Left sidebar navigation
│   ├── BottomNav.js             - Mobile bottom navigation
│   ├── MobileNavMenu.js         - Mobile hamburger menu
│   └── NotificationsDropdown.js - Notification popover
├── ui-custom/
│   ├── CCButton.js              - Custom button component
│   ├── CCCard.js                - Card components (+ Header/Content/Footer)
│   ├── CCInput.js               - Input with label/error/hint
│   ├── CCSelect.js              - Select dropdown
│   ├── CCModal.js               - Modal dialog
│   ├── CCBadge.js               - Badge component (status, role, etc)
│   ├── CCLoading.js             - Loading spinner + skeletons
│   ├── CCEmpty.js               - Empty state component
│   ├── CCAvatars.js             - Avatar (+ group, online status)
│   ├── CCTabs.js                - Tab navigation component
│   └── CCErrorModal.js          - Error display modal
├── auth/
│   ├── AccessGate.js            - Verification/subscription gate
│   ├── VerificationRequired.js  - Verification prompt
│   └── useVerificationCheck.js  - Verification hook
├── profiles/
│   ├── ProfileCard.js           - Profile grid card
│   ├── ProfileFilters.js        - Discovery filter controls
│   ├── SaveToFavoritesModal.js  - Save profile to list
│   └── ScenePairingFilter.js    - Scene pairing selector
├── friends/
│   ├── FriendRequestButton.js   - Send/cancel friend request
│   ├── FriendRequestsList.js    - Incoming requests list
│   ├── FriendsList.js           - Accepted friends list
│   └── FriendGateWarning.js     - Collaboration friend gate UI
├── messages/
│   └── (Integrated into Messages.js)
├── collaboration/
│   ├── ActivityFeed.js          - Collaboration activity log UI
│   ├── AvailabilityCalendar.js  - Date picker with availability
│   ├── CalendarView.js          - Month/week calendar view
│   ├── CollaborativeEditor.js   - Shared document editor (if present)
│   ├── CollaborationCalendar.js - Schedule view for collaboration
│   ├── CollaborationMessaging.js- In-collab messaging
│   ├── CollaborationPacketExporter.js - Export collab documents
│   ├── ConfirmationManager.js   - Confirmation requests UI
│   ├── ContractManager.js       - Contract UI within collab
│   ├── ConsentRevocationBanner.js - UI for revoked consent
│   ├── ConsentRevocationManager.js - Revocation form
│   ├── DisputeManager.js        - Dispute filing UI
│   ├── DocumentRepository.js    - Collab document storage
│   ├── ExportManager.js         - Export collaboration data
│   ├── RepObserverAccessControl.js - RepObserver permission UI
│   ├── RequirementsManager.js   - Manage collaboration requirements
│   ├── RoleManager.js           - Assign collab roles
│   ├── RolePermissions.js       - Role permission display
│   ├── SuggestedDates.js        - AI date suggestions
│   ├── TaskBoard.js             - Task kanban board
│   ├── TaskManager.js           - Task list manager
│   ├── TestingPolicyManager.js  - Testing policy configurator
│   ├── TestingStatusBanner.js   - Testing status UI
│   └── availabilityHelpers.js   - Date/availability utilities
├── contracts/
│   ├── ContractViewer.js        - Display signed contract
│   ├── ContractGenerator.js     - Generate contract from template
│   ├── TemplateContractGenerator.js - Template picker
│   ├── ContractAuditLog.js      - View contract history
│   └── ContractVersionHistory.js - Version diff viewer
├── admin/
│   ├── AdminContextBanner.js    - "Viewing as..." banner
│   ├── AdminRoleViewSwitcher.js - Role view switcher
│   ├── AgentAlertsCard.js       - Agent flag summary
│   ├── AIRiskPrediction.js      - Display AI risk scores
│   ├── ArbitrationCaseManager.js- Arbitration case UI
│   ├── CatalogModeration.js     - Review custom values
│   ├── CollaborationAnalytics.js- Collab metrics dashboard
│   ├── CollaborationModerationPanel.js - Review collabs
│   ├── ComplianceAgent.js       - Compliance agent UI
│   ├── ComplianceDashboard.js   - Overall compliance metrics
│   ├── CompliancePortal.js      - Compliance portal page
│   ├── CouponManager.js         - Manage promo codes
│   ├── DisputeSimulator.js      - Test dispute workflows
│   ├── InsuranceManager.js      - Insurance records
│   ├── JurisdictionManager.js   - Jurisdiction rules
│   ├── ModerationOverview.js    - Moderation stats
│   ├── PricingManager.js        - Manage pricing tiers
│   ├── RepresentationManager.js - Manage agent/studio reps
│   ├── ReportsQueue.js          - User reports review
│   ├── RiskScoringEngine.js     - Risk score calculator
│   ├── SessionHistoryViewer.js  - View user sessions
│   ├── UserManager.js           - User CRUD & permissions
│   ├── UserModerationPanel.js   - User moderation actions
│   └── VerificationReviewQueue.js - Approve verifications
├── agents/
│   ├── AgentsList.js            - System agents list
│   ├── AgentRunsList.js         - Agent execution history
│   ├── AgentFlagsList.js        - Review AI flags
│   ├── AgentPermissionsEditor.js- Configure agent permissions
│   └── AgentRiskScores.js       - View risk predictions
├── dashboards/
│   ├── CreatorDashboard.js      - Creator-specific dashboard
│   ├── AgentDashboard.js        - Agent-specific dashboard
│   ├── StudioDashboard.js       - Studio-specific dashboard
│   ├── PhotographerDashboard.js - Photographer dashboard
│   └── VideographerDashboard.js - Videographer dashboard
├── matching/
│   └── MatchSuggestions.js      - AI match recommendations
├── moderation/
│   └── ReportModal.js           - Report user/content modal
├── notifications/
│   ├── NotificationBell.js      - Notification icon + count
│   └── notificationHelpers.js   - Notification utilities
├── portfolio/
│   └── VideoPlayer.js           - Video playback component
├── profile/
│   ├── AvailabilityManager.js   - Manage availability dates
│   ├── BioGenerator.js          - AI bio generator
│   ├── ProfileWizard.js         - Onboarding wizard
│   ├── RepresentationManager.js - Manage agent/studio
│   ├── SkillsManager.js         - Manage skills/acts
│   ├── TravelDateManager.js     - Manage travel dates
│   └── TravelDestinationForm.js - Add travel location
├── schedule/
│   ├── ScheduleEntryCard.js     - Single schedule entry
│   └── ScheduleEntryEditor.js   - Edit schedule entry
├── settings/
│   ├── FriendSettingsCard.js    - Friend request policy
│   └── NotificationPreferences.js - Notification settings
├── socials/
│   ├── SocialLinksDisplay.js    - Display social links
│   ├── SocialLinksManager.js    - Manage social links
│   └── VerificationModal.js     - Verify social link
├── studio/
│   └── StudioEarningsDashboard.js - Studio revenue dashboard
├── theme/
│   └── tokens.js                - Design tokens (colors, spacing)
├── utils/
│   ├── roleNavConfig.js         - Navigation per role
│   └── UserNotRegisteredError.js - Error component
└── Layout.js                     - (Root layout file)

globals.css                       - Global styles + theme variables`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Backend Architecture</h3>
                <pre className="bg-[#0B0F14] p-4 rounded-lg text-xs text-[#9AA6BC] overflow-x-auto">
{`entities/
├── User.json                    - Built-in (email, full_name, role)
├── UserProfile.json             - Extended profile data
├── CreatorDetails.json          - Creator-specific fields
├── AgentDetails.json            - Agent-specific fields
├── StudioDetails.json           - Studio-specific fields
├── ServiceDetails.json          - Photographer/videographer fields
├── Collaboration.json           - Collaboration entity
├── CollaborationRequirement.json- Collaboration requirements
├── CollaborationActivityLog.json- Immutable activity log
├── CollaborationTask.json       - Task within collaboration
├── CollaborationDocument.json   - Document within collaboration
├── CollaborationMessage.json    - Collab-specific messages
├── CollaborationDispute.json    - Dispute records
├── CollaborationConfirmation.json- Confirmation requests
├── CollaborationEvent.json      - Calendar events
├── CollaborationRole.json       - Role assignments
├── CollaborationParticipantRole.json - Participant roles
├── CollaborationRiskScore.json  - Risk scoring
├── CollaborationTestingPolicy.json- Testing policy per collab
├── CollaborationPacketItem.json - Packet export items
├── CollaborationFile.json       - File attachments
├── CollaborationInsurance.json  - Insurance records
├── Contract.json                - Contract entity
├── ContractTemplate.json        - Contract templates
├── ContractVersion.json         - Contract versions
├── ContractSignature.json       - Signature records
├── ContractAuditLog.json        - Immutable contract history
├── ContractReminder.json        - Reminder events
├── Conversation.json            - Message threads
├── Message.json                 - Messages
├── Friendship.json              - Friend relationships
├── FriendSettings.json          - Friend policies per user
├── FriendActivityLog.json       - Friend activity history
├── Notification.json            - Notifications
├── NotificationPreference.json  - Notification settings
├── TestingCredential.json       - Testing credentials
├── TestingDocument.json         - Testing documents
├── TestingRequirement.json      - Testing requirements
├── ConsentRevocation.json       - Consent revocations
├── VerificationRecord.json      - Identity verification
├── AgentRepresentation.json     - Agent-creator relationship
├── StudioRepresentation.json    - Studio-creator relationship
├── StudioRoster.json            - Studio rosters
├── StudioCollaborationObserver.json - Studio observer records
├── Report.json                  - User/content reports
├── BlockedUser.json             - Blocked user records
├── Subscription.json            - Subscription records
├── PricingTier.json             - Pricing plans
├── Coupon.json                  - Promo codes
├── CouponRedemption.json        - Redemption records
├── Gallery.json                 - Gallery entities
├── GalleryPermission.json       - Gallery access control
├── Favorite.json                - Saved profiles
├── Tag.json                     - Tags
├── UserSettings.json            - User settings
├── SocialPlatform.json          - Social platforms
├── SocialLink.json              - Social links
├── SocialLinkVerification.json  - Social verification
├── ScheduleEntry.json           - Availability/travel dates
├── SessionHistory.json          - Login sessions
├── AdminActionLog.json          - Immutable admin log
├── ComplianceRecord.json        - Compliance records
├── ComplianceScoreEvent.json    - Compliance score changes
├── CompliancePortalAccess.json  - Portal access log
├── ArbitrationCase.json         - Arbitration cases
├── JurisdictionRule.json        - Jurisdiction-specific rules
├── DisputeSimulation.json       - Dispute test scenarios
├── ContentCatalogItem.json      - Content catalog items
├── CustomValueSubmission.json   - User-submitted values
├── CustomCity.json              - Custom city submissions
├── ProfileSkill.json            - User skills
├── ServicePortfolioItem.json    - Service portfolio
├── AIMatchSuggestion.json       - AI match suggestions
├── AIRiskPrediction.json        - AI risk predictions
├── AgentProfile.json            - System agent profiles
├── AgentPermissionPolicy.json   - Agent permissions
├── AgentRun.json                - Agent execution log
├── AgentFlag.json               - Agent-flagged items
└── QuickTask.json               - Quick tasks

functions/
├── startConversation.js         - Create conversation
├── sendFriendRequest.js         - Send friend request
├── respondToFriendRequest.js    - Accept/decline friend request
├── cancelFriendRequest.js       - Cancel friend request
├── isFriends.js                 - Check friendship status
├── validateFriendRequestEligibility.js - Check friend request rules
├── validateCollaborationFriendGate.js - Check collab friend gate
├── validateVerificationStatus.js- Check verification for action
├── logVerificationBlock.js      - Log blocked actions
├── validateContractInitiation.js- Check contract preconditions
├── validateContractStudioSplit.js - Validate studio splits
├── validateTestingRequirements.js - Check testing satisfaction
├── checkTestingDeadlines.js     - Check testing expiry
├── checkTestingDeadlineWarnings.js - Send testing warnings
├── sendTestingNotification.js   - Send testing reminders
├── markTestingRequirementSatisfied.js - Mark testing satisfied
├── lockCollaborationBooking.js  - Lock schedule dates
├── releaseCollaborationBooking.js - Release schedule dates
├── createContractSnapshot.js    - Create immutable snapshot
├── triggerConsentRevocation.js  - Process consent revocation
├── autoAddStudioObserver.js     - Add studio as observer
├── executeAgentScan.js          - Run compliance agent
├── generateMatches.js           - Generate AI matches
├── saveContractToGoogleDrive.js - Google Drive export
└── (other custom functions)

agents/
└── compliance_safety_agent.json - Compliance agent config`}
                </pre>
              </div>
            </div>
          </CCCard>
        </section>

        {/* 4. Entity Reference */}
        <EntityReferenceSection />

        {/* 5. Enforcement Matrix */}
        <div style={{display:'none'}} id="old-entity-stub">
              <div className="text-xs">
                <p>REMOVED</p>
                <p>REMOVED</p>
                <p><strong>Enforcement:</strong> Friend gate checked via validateCollaborationFriendGate. Testing requirements checked before contract initiation. Status transitions logged in CollaborationActivityLog.</p>
                <p><strong>Lifecycle:</strong> draft → pending_approval (if multi-party) → active (all approved) → negotiating (terms discussion) → agreed (terms finalized) → contract_pending (contract generation) → contract_sent (signatures requested) → signed (all signatures collected) → completed (after scene) OR disputed (if issue)</p>
                <p><strong>UI Dependencies:</strong> CreateCollaboration, CollaborationDetail, Collaborations list, Dashboard</p>
                <p><strong>Write Functions:</strong> Create/update via CollaborationDetail, status updates via backend</p>
              </div>
            </div>

        </div>

        {/* 5. Enforcement Matrix */}
        <section id="enforcement" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#4F8CFF]" />
            5. Enforcement Matrix (Critical Section)
          </h2>
          <CCCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#263248]">
                  <tr className="text-left text-[#E8EEF9]">
                    <th className="p-2">Action</th>
                    <th className="p-2">Preconditions</th>
                    <th className="p-2">Validation Functions</th>
                    <th className="p-2">What Blocks</th>
                    <th className="p-2">UI State</th>
                    <th className="p-2">Logs Written</th>
                  </tr>
                </thead>
                <tbody className="text-[#9AA6BC]">
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">View Profile</td>
                    <td className="p-2">Must be verified</td>
                    <td className="p-2">validateVerificationStatus</td>
                    <td className="p-2">VerificationRecord.status != "approved"</td>
                    <td className="p-2">VerificationRequired component</td>
                    <td className="p-2">logVerificationBlock</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Send Message</td>
                    <td className="p-2">Must be verified + subscribed</td>
                    <td className="p-2">validateVerificationStatus, startConversation</td>
                    <td className="p-2">Verification missing OR subscription expired</td>
                    <td className="p-2">AccessGate component (type="both")</td>
                    <td className="p-2">logVerificationBlock, Conversation creation</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Send Friend Request</td>
                    <td className="p-2">Target's policy allows + not blocked + within rate limit + no cooldown</td>
                    <td className="p-2">validateFriendRequestEligibility</td>
                    <td className="p-2">FriendSettings.friend_request_policy="NO_ONE" OR MESSAGE_FIRST without prior message OR daily limit exceeded OR decline cooldown active</td>
                    <td className="p-2">CCErrorModal with reason</td>
                    <td className="p-2">FriendActivityLog</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Accept Friend Request</td>
                    <td className="p-2">Friendship.status="PENDING" + user is addressee</td>
                    <td className="p-2">respondToFriendRequest</td>
                    <td className="p-2">Request not pending OR user not addressee</td>
                    <td className="p-2">Accept button disabled</td>
                    <td className="p-2">FriendActivityLog (REQUEST_ACCEPTED)</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Create Collaboration</td>
                    <td className="p-2">Verified + subscribed + optionally friends (if target requires)</td>
                    <td className="p-2">validateCollaborationFriendGate</td>
                    <td className="p-2">FriendSettings.allow_collaboration_invites_non_friends=false AND not friends</td>
                    <td className="p-2">FriendGateWarning component</td>
                    <td className="p-2">CollaborationActivityLog (CREATED)</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Join Collaboration</td>
                    <td className="p-2">Invited + verified + subscribed</td>
                    <td className="p-2">validateCollaborationFriendGate (if applicable)</td>
                    <td className="p-2">Not invited OR verification/subscription missing</td>
                    <td className="p-2">Invitation button disabled</td>
                    <td className="p-2">CollaborationActivityLog (JOINED)</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Upload Testing</td>
                    <td className="p-2">Is creator + verified</td>
                    <td className="p-2">None</td>
                    <td className="p-2">Not creator role</td>
                    <td className="p-2">Upload form hidden</td>
                    <td className="p-2">TestingCredential created, AdminActionLog (if admin approves)</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Initiate Contract</td>
                    <td className="p-2">Collaboration.status="agreed" + testing requirements satisfied</td>
                    <td className="p-2">validateContractInitiation, validateTestingRequirements</td>
                    <td className="p-2">Collaboration not agreed OR TestingRequirement.satisfied=false for any participant</td>
                    <td className="p-2">TestingStatusBanner, contract button disabled</td>
                    <td className="p-2">ContractAuditLog (INITIATED), CollaborationActivityLog (CONTRACT_INITIATED)</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Sign Contract</td>
                    <td className="p-2">Contract.status="sent" + user is signatory + agent permissions allow (if agent signing)</td>
                    <td className="p-2">None (permissions checked in UI)</td>
                    <td className="p-2">Contract not sent OR user not signatory OR agent lacks can_sign_contracts</td>
                    <td className="p-2">Sign button disabled</td>
                    <td className="p-2">ContractSignature created, ContractAuditLog (SIGNED), Contract snapshot created if all signed</td>
                  </tr>
                  <tr className="border-b border-[#263248]">
                    <td className="p-2 font-medium">Revoke Consent</td>
                    <td className="p-2">User is creator + Contract.status="signed"</td>
                    <td className="p-2">triggerConsentRevocation</td>
                    <td className="p-2">Not creator OR contract not signed</td>
                    <td className="p-2">Revoke button hidden</td>
                    <td className="p-2">ConsentRevocation created, AdminActionLog, CollaborationActivityLog, Notification to all parties</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CCCard>
        </section>

        {/* 6. Collaboration Lifecycle */}
        <section id="collaboration" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#4F8CFF]" />
            6. Collaboration Lifecycle (End-to-End)
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">State Transitions</h3>
              <div className="space-y-3 text-sm text-[#9AA6BC]">
                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>1. Draft</strong>
                  <p>Initial state. Creator filling out collaboration form. Not visible to other participants yet.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: None. Logs: None.</p>
                </div>

                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>2. Pending Approval (Multi-party)</strong>
                  <p>If multiple participants invited, each must approve before becoming "active".</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: Invitation notifications sent. Logs: CollaborationActivityLog (INVITED).</p>
                </div>

                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>3. Active</strong>
                  <p>All participants have accepted invitation. Scene negotiation begins.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: Conversation created/linked. Logs: CollaborationActivityLog (ACTIVATED).</p>
                </div>

                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>4. Negotiating</strong>
                  <p>Participants discussing scene details, acts, boundaries, compensation, schedule, location.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: CollaborationMessaging updates. Logs: CollaborationActivityLog (SCENE_UPDATED, SCHEDULE_PROPOSED).</p>
                </div>

                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>5. Agreed</strong>
                  <p>All terms finalized. Ready for contract generation.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: Testing deadlines checked. Logs: CollaborationActivityLog (TERMS_AGREED).</p>
                </div>

                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>6. Contract Pending</strong>
                  <p>Contract being generated from template. Testing requirements checked.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: validateTestingRequirements run. Logs: ContractAuditLog (GENERATED).</p>
                </div>

                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>7. Contract Sent</strong>
                  <p>Contract sent to all signatories. Awaiting signatures.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: ContractReminder notifications. Logs: ContractAuditLog (SENT), Notification to signatories.</p>
                </div>

                <div className="border-l-2 border-[#4F8CFF] pl-4">
                  <strong>8. Signed</strong>
                  <p>All signatures collected. Schedule locked via lockCollaborationBooking.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: Contract snapshot created (createContractSnapshot). ScheduleEntry.locked=true. Logs: ContractAuditLog (ALL_SIGNED), CollaborationActivityLog (CONTRACT_SIGNED).</p>
                </div>

                <div className="border-l-2 border-[#22C55E] pl-4">
                  <strong>9. Completed</strong>
                  <p>Scene filmed. Post-scene obligations in effect (posting rules, embargo, crediting).</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: None. Logs: CollaborationActivityLog (COMPLETED).</p>
                </div>

                <div className="border-l-2 border-[#EF4444] pl-4">
                  <strong>10. Cancelled</strong>
                  <p>Collaboration cancelled by participant. Schedule released via releaseCollaborationBooking.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: Cancellation notifications. Logs: CollaborationActivityLog (CANCELLED).</p>
                </div>

                <div className="border-l-2 border-[#EF4444] pl-4">
                  <strong>11. Disputed</strong>
                  <p>Dispute filed. Admin review via CollaborationDispute.</p>
                  <p className="text-xs text-[#6B7A94] mt-1">Triggers: Notification to admin and parties. Logs: CollaborationActivityLog (DISPUTED), AdminActionLog.</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Scene Selection & Act Filtering</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                When creating a collaboration, the scene selection determines available acts:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>scene_type:</strong> standard | fetish | kink_edge</li>
                <li><strong>scene_selected[]:</strong> e.g., boy_girl, girl_girl, boy_boy (from ContentCatalogItem category=scene_pairing)</li>
                <li><strong>acts_selected[]:</strong> Filtered based on scene_type:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>If scene_type="standard": acts from CreatorDetails.standard_acts</li>
                    <li>If scene_type="fetish": acts from CreatorDetails.fetish_acts</li>
                    <li>If scene_type="kink_edge": acts from CreatorDetails.kink_edge_acts</li>
                  </ul>
                </li>
                <li><strong>acts_other_text:</strong> Free-form for acts not in catalog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Auto-Cancellations & Auto-Pauses</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Collaborations can be auto-cancelled or paused under certain conditions:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Testing Expiry:</strong> If TestingCredential.expires_at passes before contract signed, collaboration auto-paused. Notification sent via sendTestingNotification.</li>
                <li><strong>Verification Revoked:</strong> If VerificationRecord.status changes to "expired" or "rejected", all active collaborations auto-paused.</li>
                <li><strong>Subscription Lapse:</strong> If Subscription.status != "active" | "trial", collaborations paused until reactivated.</li>
                <li><strong>User Blocked:</strong> If Report results in admin blocking user, all collaborations cancelled.</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 7. Scheduling & Availability */}
        <section id="scheduling" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#4F8CFF]" />
            7. Scheduling & Availability System
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">ScheduleEntry</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Central entity for all calendar events:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>entry_type:</strong> "availability" (user available), "travel" (traveling), "booked" (locked for collaboration)</li>
                <li><strong>date:</strong> ISO date</li>
                <li><strong>start_time, end_time:</strong> Optional time range</li>
                <li><strong>location:</strong> For travel entries, the destination</li>
                <li><strong>collaboration_id:</strong> For booked entries, the collaboration</li>
                <li><strong>locked:</strong> Boolean. If true, cannot be double-booked.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Booking Locks</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                When a contract is fully signed:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>lockCollaborationBooking function called</li>
                <li>Creates ScheduleEntry with entry_type="booked", locked=true</li>
                <li>All participants have date locked</li>
                <li>SuggestedDates filters out locked dates</li>
                <li>If collaboration cancelled, releaseCollaborationBooking deletes locked entries</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Conflict Resolution</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Conflicts are checked before scheduling:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>UI checks existing ScheduleEntry records for date + user_id</li>
                <li>If locked=true entry exists, date unavailable</li>
                <li>If availability entry exists, date available</li>
                <li>If travel entry exists, location shown</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Lazy-Loading Calendar</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Calendar views paginate by month/year:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>AvailabilityCalendar loads 1 month at a time</li>
                <li>Query: ScheduleEntry.filter(user_id=user.id, date &gt;= start_of_month, date &lt;= end_of_month)</li>
                <li>Previous/next month buttons trigger new queries</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">External Calendar Export</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                If implemented (not confirmed):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>ICS export of ScheduleEntry records</li>
                <li>Google Calendar sync via saveContractToGoogleDrive (possibly extended)</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 8. Health, Testing & Compliance */}
        <section id="testing" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-[#4F8CFF]" />
            8. Health, Testing & Compliance
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Testing Statuses</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                TestingCredential.status_badge values:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>valid:</strong> Admin verified, not expired</li>
                <li><strong>expired:</strong> Past expires_at date</li>
                <li><strong>pending_review:</strong> Uploaded, awaiting admin verification</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Visibility Levels</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                CreatorDetails.health_testing.testing_visibility:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>private:</strong> Only visible to creator</li>
                <li><strong>collaboration_room_only:</strong> Shared with collaboration participants</li>
                <li><strong>verified_collaborators:</strong> Shared with verified users in active collaborations</li>
                <li><strong>public:</strong> Badge visible on profile (document not shared)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Upload Handling</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                TestingDocument entity:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>file_type:</strong> pdf | png | jpg | jpeg | heic</li>
                <li><strong>file_url:</strong> Private storage URL</li>
                <li><strong>status:</strong> pending | verified | rejected</li>
                <li><strong>collaboration_id:</strong> Optional, if uploaded for specific collab</li>
                <li>Admin reviews via VerificationReviewQueue</li>
                <li>On verification, TestingCredential created with tested_at, expires_at</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Testing Requirements in Collaborations</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                CollaborationTestingPolicy entity configures per-collaboration rules:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>require_verified_testing:</strong> Only admin-verified credentials allowed</li>
                <li><strong>require_full_panel_within_days:</strong> 14 | 30 | 60 | null</li>
                <li><strong>require_hiv_negative_only:</strong> Block if HIV positive (detectable)</li>
                <li><strong>allow_hiv_undetectable:</strong> Allow HIV positive undetectable (U=U)</li>
                <li><strong>allow_self_reported:</strong> Allow self-reported testing</li>
                <li><strong>require_testing_before_contract:</strong> Block contract initiation if not satisfied</li>
                <li><strong>require_testing_before_schedule_lock:</strong> Block schedule lock if not satisfied</li>
              </ul>
              <p className="text-sm text-[#9AA6BC] mt-2">
                Validation via validateTestingRequirements function. If not satisfied, contract button disabled + TestingStatusBanner shown.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Deadline Enforcement</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Backend functions:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>checkTestingDeadlines:</strong> Checks expires_at, sets status="expired"</li>
                <li><strong>checkTestingDeadlineWarnings:</strong> Sends warnings 7 days before expiry</li>
                <li><strong>sendTestingNotification:</strong> Sends notification to user</li>
                <li>Run via cron/scheduler (if implemented) or on-demand</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Auto-Cancellation Logic</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                If testing expires before contract signed:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Collaboration.status → "cancelled" (or paused, if implemented)</li>
                <li>Notification sent to all participants</li>
                <li>Schedule locks released via releaseCollaborationBooking</li>
                <li>Logged in CollaborationActivityLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Compliance Scoring</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                ComplianceScoreEvent entity (if implemented):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Tracks user compliance score changes</li>
                <li>Factors: testing uploads, timely renewals, verification maintenance</li>
                <li>Used for risk scoring and admin prioritization</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Backend Reports Inclusion</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Testing credentials included in CollaborationPacketExporter:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>CollaborationPacketItem.item_type = "testing_document"</li>
                <li>References TestingDocument.file_url</li>
                <li>Exported for legal compliance packets</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 9. Representation & Exclusivity */}
        <section id="representation" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#4F8CFF]" />
            9. Representation & Exclusivity
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">AgentRepresentation</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Agent-creator relationships:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>permissions.can_negotiate:</strong> Agent can handle negotiation messages</li>
                <li><strong>permissions.can_sign_contracts:</strong> Agent can sign on behalf of creator</li>
                <li><strong>permissions.can_message:</strong> Agent can send/receive messages for creator</li>
                <li><strong>permissions.can_view_private_gallery:</strong> Agent can view creator's private portfolio</li>
                <li><strong>commission_rate:</strong> Percentage of revenue (enforced in Contract.post_scene_rules.revenue_split)</li>
                <li><strong>exclusive:</strong> If true, only one agent can have active representation</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">StudioRepresentation</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Studio-creator relationships:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>revenue_split:</strong> Studio's percentage of revenue (enforced in Contract.post_scene_rules.revenue_split)</li>
                <li><strong>exclusive:</strong> If true, only one studio can have active representation</li>
                <li><strong>Auto RepObserver:</strong> Studio automatically added to collaborations via autoAddStudioObserver</li>
                <li>Studio can view contracts and schedules but cannot edit or sign (read-only)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Revenue Split Enforcement</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Contract.post_scene_rules.revenue_split must include:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Each creator's percentage</li>
                <li>Agent commission (if AgentRepresentation.exclusive = true)</li>
                <li>Studio split (if StudioRepresentation.exclusive = true)</li>
                <li>Validated via validateContractStudioSplit function</li>
                <li>If percentages don't sum to 100%, contract generation blocked</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Admin Overrides</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Admins can:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Terminate representations via RepresentationManager</li>
                <li>Override exclusive flag (e.g., for multi-agency creators)</li>
                <li>Adjust commission rates (logged in AdminActionLog)</li>
                <li>Remove RepObserver access (via StudioCollaborationObserver deletion)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Audit Logging</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                All representation actions logged:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>AgentRepresentation creation → AdminActionLog (if admin-created) or CollaborationActivityLog</li>
                <li>Permission changes → AdminActionLog</li>
                <li>Revenue split updates → ContractAuditLog</li>
                <li>Representation termination → AdminActionLog</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 10. Friends & Trust System */}
        <section id="friends" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#4F8CFF]" />
            10. Friends & Trust System
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Message-First Gating</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                FriendSettings.friend_request_policy = "MESSAGE_FIRST":
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>User cannot send friend request until they've had a conversation</li>
                <li>Conversation.participants_who_replied[] must include requester</li>
                <li>Validated via validateFriendRequestEligibility</li>
                <li>If not met, CCErrorModal shows "You must message first before sending a friend request"</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Friend Request Lifecycle</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Friendship entity states:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>PENDING:</strong> Request sent, awaiting response</li>
                <li><strong>ACCEPTED:</strong> Both users are friends</li>
                <li><strong>DECLINED:</strong> Request rejected, cooldown applied</li>
                <li><strong>CANCELLED:</strong> Requester cancelled before response</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Cooldowns & Rate Limits</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Friendship.decline_cooldown_until:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Set to 30 days after DECLINED status</li>
                <li>Requester cannot send another request until cooldown expires</li>
                <li>FriendSettings.friend_request_daily_limit enforces max requests per day</li>
                <li>Tracked via FriendActivityLog count for today</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Privacy Settings</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                FriendSettings.friend_count_visibility:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>PUBLIC:</strong> Friend count visible to all</li>
                <li><strong>VERIFIED_ONLY:</strong> Visible to verified users only</li>
                <li><strong>PRIVATE:</strong> Only visible to user</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Collaboration Trust Enforcement</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                FriendSettings.allow_collaboration_invites_non_friends:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>If false, only friends can invite user to collaborations</li>
                <li>Checked via validateCollaborationFriendGate</li>
                <li>If blocked, FriendGateWarning component shown</li>
                <li>User must send friend request first, wait for acceptance</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Admin Moderation Hooks</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Admins can:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>View FriendActivityLog for abuse patterns</li>
                <li>Override cooldowns (via direct Friendship update)</li>
                <li>Block friend requests between specific users (via BlockedUser entity)</li>
                <li>All overrides logged in AdminActionLog</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 11. Discovery & Matching */}
        <section id="discovery" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Network className="w-6 h-6 text-[#4F8CFF]" />
            11. Discovery & Matching
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">AIMatchSuggestion</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                AI-generated match recommendations:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>match_score:</strong> 0-100, higher is better match</li>
                <li><strong>reasons[]:</strong> Explainability (e.g., "Similar content types", "Nearby location")</li>
                <li><strong>dismissed:</strong> User dismissed suggestion</li>
                <li><strong>clicked:</strong> User clicked to view profile</li>
                <li>Generated by generateMatches backend function</li>
                <li>Displayed in MatchSuggestions component on Discovery page</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Match Scoring Logic</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Factors considered (high level, actual implementation may vary):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Content Type Overlap:</strong> Creator's scene_selected[] vs viewer's scene_selected[]</li>
                <li><strong>Geographic Proximity:</strong> Distance between base_location coordinates</li>
                <li><strong>Travel Overlap:</strong> Viewer's travel_dates intersect with creator's availability_dates</li>
                <li><strong>Role Compatibility:</strong> Creator looking_for_genders matches viewer's gender_identity</li>
                <li><strong>Acts Overlap:</strong> Creator's acts match viewer's acts preferences</li>
                <li><strong>Response Time:</strong> Lower response_time_hours = higher score</li>
                <li><strong>Verification Status:</strong> Verified users ranked higher</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Hard Gates vs Soft Signals</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Discovery filtering:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Hard Gates (block visibility):</strong>
                  <ul className="list-disc list-inside ml-6">
                    <li>Verification status (only show verified to verified)</li>
                    <li>Subscription status (only show active to active)</li>
                    <li>Blocked users (BlockedUser records hide profiles)</li>
                  </ul>
                </li>
                <li><strong>Soft Signals (ranking/filtering):</strong>
                  <ul className="list-disc list-inside ml-6">
                    <li>Scene type preferences (filter, don't hide)</li>
                    <li>Location distance (show all, rank by proximity)</li>
                    <li>Friend status (show friends first)</li>
                  </ul>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Explainability Rules</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                AIMatchSuggestion.reasons[] examples:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>"Both interested in boy/girl content"</li>
                <li>"Within 50 miles of your location"</li>
                <li>"Available during your travel dates"</li>
                <li>"High response rate (avg 2 hours)"</li>
                <li>"Verified and highly rated"</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Admin Discovery Insights</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Admins can view:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Match suggestion click-through rates</li>
                <li>Most commonly dismissed suggestions (improve algo)</li>
                <li>Profile view analytics (via CollaborationAnalytics)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Creator-Facing KPIs</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Displayed on Dashboard:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Profile views (last 7 days)</li>
                <li>Collaboration invites received</li>
                <li>Response time (calculated from message timestamps)</li>
                <li>Friend requests received</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 12. Notifications System */}
        <section id="notifications" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#4F8CFF]" />
            12. Notifications System
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Notification Types</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                NotificationPreference.notification_type values:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>messages:</strong> New message received</li>
                <li><strong>collaboration_invites:</strong> Invited to collaboration</li>
                <li><strong>role_changes:</strong> Role updated (e.g., agent permission change)</li>
                <li><strong>contract_updates:</strong> Contract signed, updated, or voided</li>
                <li><strong>testing_deadlines:</strong> Testing expiring soon or expired</li>
                <li><strong>dispute_updates:</strong> Dispute status changed</li>
                <li><strong>representation_actions:</strong> Agent/studio representation changes</li>
                <li><strong>verification_status:</strong> Verification approved/rejected</li>
                <li><strong>system_announcements:</strong> Platform-wide announcements</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Triggers</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Notifications created by:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Backend functions (e.g., sendTestingNotification)</li>
                <li>Entity state changes (e.g., Collaboration status update)</li>
                <li>Admin actions (e.g., verification approval)</li>
                <li>Helper functions in notificationHelpers.js</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Preferences</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                NotificationPreference.channels:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>in_app:</strong> Show in NotificationBell + Notifications page</li>
                <li><strong>email:</strong> Send email (if email integration active)</li>
                <li>Users can disable per-type via NotificationPreferences component (Settings page)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">UI Flow</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Notification display:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>NotificationBell component shows unread count</li>
                <li>NotificationsDropdown shows recent notifications</li>
                <li>Clicking notification marks as read (Notification.read_at set)</li>
                <li>action_url navigates to related entity (e.g., collaboration, contract)</li>
                <li>Notifications page shows full history</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Unread Logic</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Unread count calculation:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Query: Notification.filter(user_id=user.id, read_at=null).count()</li>
                <li>Real-time polling (refetchInterval: 30s)</li>
                <li>Badge color: red for unread, gray for read</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 13. Admin Systems */}
        <section id="admin" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#4F8CFF]" />
            13. Admin Systems
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">User Moderation</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                UserManager + UserModerationPanel:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>View all users (UserProfile + User entities)</li>
                <li>Edit user roles, verification status, subscription status</li>
                <li>Block/unblock users (creates BlockedUser record)</li>
                <li>View session history (SessionHistory)</li>
                <li>All actions logged in AdminActionLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Verification Queue</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                VerificationReviewQueue:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Lists VerificationRecord.status="pending"</li>
                <li>Shows submitted documents (VerificationRecord.documents_submitted[])</li>
                <li>Admin can approve (status="approved") or reject (status="rejected", set rejection_reason)</li>
                <li>Approval triggers notification to user</li>
                <li>Logged in AdminActionLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Catalog Moderation</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                CatalogModeration:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Lists CustomValueSubmission.status="pending"</li>
                <li>Admin can approve (creates ContentCatalogItem) or reject (sets rejection_reason)</li>
                <li>Approved values become available in dropdowns (CreateCollaboration, ProfileWizard)</li>
                <li>Logged in AdminActionLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Reports Queue</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                ReportsQueue:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Lists Report.status="pending"</li>
                <li>Shows reporter, target, reason, details</li>
                <li>Admin can investigate (status="investigating"), resolve (status="resolved"), or dismiss (status="dismissed")</li>
                <li>Resolution actions: warn user, block user, delete content</li>
                <li>All actions logged in AdminActionLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Session History</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                SessionHistoryViewer:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Shows SessionHistory records per user</li>
                <li>Displays IP address, user agent, login/logout times</li>
                <li>Flags suspicious activity (e.g., multiple IPs in short time)</li>
                <li>Used for fraud detection and security audits</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Representation Management</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                RepresentationManager (admin view):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>View all AgentRepresentation and StudioRepresentation records</li>
                <li>Terminate representations</li>
                <li>Override exclusive flags</li>
                <li>Adjust commission rates</li>
                <li>All changes logged in AdminActionLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Export Capabilities</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Admin exports:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>User data exports (CSV, JSON)</li>
                <li>Collaboration reports (via CollaborationAnalytics)</li>
                <li>Contract exports (PDF batch download)</li>
                <li>Audit log exports (AdminActionLog, ContractAuditLog)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Safety Tooling</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Admin safety features:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>RiskScoringEngine (calculate user/collab risk scores)</li>
                <li>AIRiskPrediction viewer (review AI-flagged items)</li>
                <li>DisputeSimulator (test dispute workflows before production)</li>
                <li>ComplianceAgent (automated compliance checks)</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 14. Audit & Legal Defensibility */}
        <section id="audit" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Lock className="w-6 h-6 text-[#4F8CFF]" />
            14. Audit & Legal Defensibility
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Immutable Logs</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Three core immutable log entities:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>AdminActionLog:</strong> All admin actions (user edits, verification approvals, report resolutions)</li>
                <li><strong>CollaborationActivityLog:</strong> All collaboration state changes (created, negotiated, signed, completed, disputed)</li>
                <li><strong>ContractAuditLog:</strong> All contract changes (generated, edited, signed, voided)</li>
                <li>Cannot be edited or deleted after creation</li>
                <li>Include timestamps, actor IDs, before/after state, IP addresses</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Snapshot Guarantees</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Contract snapshots:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Created via createContractSnapshot function when Contract.status → "signed"</li>
                <li>Stored as ContractVersion entity with version hash (signed_version_hash)</li>
                <li>Includes full contract terms, all parties, signatures, timestamps</li>
                <li>PDF generated and stored (Contract.pdf_url)</li>
                <li>Cannot be modified after creation</li>
                <li>Used for legal disputes and compliance audits</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Contract Defensibility</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Features ensuring contract validity:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Versioning:</strong> ContractVersion tracks all edits before signing</li>
                <li><strong>Signatures:</strong> ContractSignature records IP, timestamp, signed_version_hash</li>
                <li><strong>E-signature legality:</strong> Meets ESIGN Act requirements (intent, consent, record retention)</li>
                <li><strong>Immutable snapshot:</strong> signed_version_hash prevents backdating</li>
                <li><strong>Audit trail:</strong> ContractAuditLog shows all changes</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Consent Revocation Impact</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                When ConsentRevocation created:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Immutable record with timestamp, revoking user, reason</li>
                <li>Contract.post_scene_rules.takedown_policy activated</li>
                <li>All parties notified with takedown_deadline</li>
                <li>Admin reviews via CompliancePortal</li>
                <li>takedown_completed_at marks when content removed</li>
                <li>Logged in AdminActionLog and CollaborationActivityLog</li>
                <li>Does NOT delete contract or collaboration (legal record preserved)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Dispute Handling</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                CollaborationDispute workflow:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Filed by participant via DisputeManager</li>
                <li>Evidence uploaded (evidence_urls[]) - immutable after upload</li>
                <li>Admin reviews via CompliancePortal or ArbitrationCaseManager</li>
                <li>Status progression: filed → investigating → mediation → arbitration → resolved</li>
                <li>Resolution notes and outcome logged in AdminActionLog</li>
                <li>Contract snapshot used as evidence</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Evidence Preservation</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Data preserved for legal defense:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>All contracts (signed PDFs + snapshots)</li>
                <li>All audit logs (admin, collaboration, contract)</li>
                <li>All messages (Conversation + Message entities)</li>
                <li>Testing credentials (TestingDocument files)</li>
                <li>Verification records (VerificationRecord.documents_submitted)</li>
                <li>Session history (SessionHistory for fraud detection)</li>
                <li>Exported via CollaborationPacketExporter for legal packets</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 15. System Agents */}
        <section id="agents" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#4F8CFF]" />
            15. System Agents (AI)
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Compliance & Safety Review Agent</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                agents/compliance_safety_agent.json:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Purpose:</strong> Automated safety and compliance checks</li>
                <li><strong>Read-only access:</strong> Cannot write to entities</li>
                <li><strong>Analyzes:</strong> User profiles, collaborations, contracts, messages</li>
                <li><strong>Flags:</strong> Creates AgentFlag records for admin review (e.g., "Profile contains suspicious keywords")</li>
                <li><strong>Risk scoring:</strong> Creates AIRiskPrediction records</li>
                <li><strong>Execution:</strong> Triggered via executeAgentScan function (scheduled or on-demand)</li>
                <li><strong>Logs:</strong> AgentRun entity tracks execution time, entities scanned, flags created</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Discovery & Matching Optimization Agent</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                (If implemented):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Purpose:</strong> Generate AI match suggestions</li>
                <li><strong>Analyzes:</strong> User profiles, collaboration history, message patterns</li>
                <li><strong>Creates:</strong> AIMatchSuggestion records</li>
                <li><strong>Execution:</strong> Triggered via generateMatches function</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">What They Cannot Do</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Critical constraints:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Cannot edit user profiles</li>
                <li>Cannot create or modify collaborations</li>
                <li>Cannot sign contracts</li>
                <li>Cannot send messages</li>
                <li>Cannot block users</li>
                <li>Cannot delete data</li>
                <li>Can only CREATE: AgentFlag, AIRiskPrediction, AIMatchSuggestion</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">How Admins Use Them</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Admin workflow:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Review AgentFlagsList (AgentManagement page)</li>
                <li>Sort by severity (low/medium/high/critical)</li>
                <li>Click flag to view flagged entity (profile, collab, contract)</li>
                <li>Take action (warn, block, approve, dismiss)</li>
                <li>Mark flag as reviewed</li>
                <li>Action logged in AdminActionLog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Agent Configuration</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                AgentProfile + AgentPermissionPolicy:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>AgentProfile.enabled: Admins can enable/disable agents</li>
                <li>AgentPermissionPolicy: Defines read access scope (e.g., "can_read_profiles", "can_read_contracts")</li>
                <li>Configured via AgentPermissionsEditor (AgentManagement page)</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 16. Deployment & Production */}
        <section id="deployment" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Database className="w-6 h-6 text-[#4F8CFF]" />
            16. Deployment & Production Notes
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Required APIs</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Base44 SDK:</strong> @base44/sdk for backend functions and API calls</li>
                <li><strong>Storage:</strong> File uploads via Base44 storage (UploadFile integration)</li>
                <li><strong>Email:</strong> SendEmail integration for notifications</li>
                <li><strong>LLM:</strong> InvokeLLM integration for AI agents and bio generation</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Verification Providers</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Yoti:</strong> Primary identity verification provider (API integration required)</li>
                <li><strong>Passbase:</strong> Alternative verification provider</li>
                <li><strong>Manual:</strong> Admin manual review for edge cases</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Testing Providers</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Talent Testing Service (TTS)</li>
                <li>Private labs (user-uploaded PDFs)</li>
                <li>Clinic/doctor reports</li>
                <li>Self-reported (if allowed by CollaborationTestingPolicy)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">File Storage Assumptions</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Public files: Avatars, cover images, portfolio items (via UploadFile integration)</li>
                <li>Private files: Testing documents, verification documents (via UploadPrivateFile + CreateFileSignedUrl)</li>
                <li>Contract PDFs: Signed contracts stored as private files, accessed via signed URLs</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Security Boundaries</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Row-level security:</strong> Entity queries filtered by user permissions (Base44 platform handles)</li>
                <li><strong>Verification gating:</strong> Most features require VerificationRecord.status="approved"</li>
                <li><strong>Subscription gating:</strong> Features require Subscription.status="active" | "trial"</li>
                <li><strong>Admin actions:</strong> All logged in AdminActionLog for accountability</li>
                <li><strong>API rate limiting:</strong> Base44 platform handles (no custom implementation needed)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Scaling Considerations</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Message polling:</strong> 30s refetch interval may need optimization for large user base (consider websockets)</li>
                <li><strong>Notification polling:</strong> 30s refetch interval (same consideration)</li>
                <li><strong>Calendar queries:</strong> Lazy-loading by month reduces load</li>
                <li><strong>Discovery filtering:</strong> Client-side filtering may need server-side pagination at scale</li>
                <li><strong>AI agent execution:</strong> Schedule during off-peak hours to reduce load</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Known Limitations</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Real-time messaging not implemented (polling-based)</li>
                <li>Video calls not implemented (external tools required)</li>
                <li>Payment processing not implemented (external Stripe/PayPal integration needed)</li>
                <li>Analytics dashboards limited (basic metrics only)</li>
                <li>Multi-language support not implemented (English only)</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* 17. Change Governance */}
        <section id="governance" className="mb-8">
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#4F8CFF]" />
            17. Change Governance
          </h2>
          <CCCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">What Requires Admin Approval</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>New ContentCatalogItem additions (via CustomValueSubmission approval)</li>
                <li>VerificationRecord status changes (pending → approved)</li>
                <li>TestingCredential status changes (pending_review → valid)</li>
                <li>Report resolutions (Report.status updates + actions)</li>
                <li>Representation terminations (AgentRepresentation, StudioRepresentation)</li>
                <li>User role changes (UserProfile.role_type or is_admin)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">What Can Be User-Generated</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Profile updates (UserProfile, CreatorDetails, etc)</li>
                <li>Collaboration creation and updates (Collaboration)</li>
                <li>Contract signatures (ContractSignature)</li>
                <li>Messages (Message)</li>
                <li>Friend requests (Friendship)</li>
                <li>Testing uploads (TestingDocument - pending admin review)</li>
                <li>Verification uploads (VerificationRecord - pending admin review)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">What Is Versioned</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Contracts:</strong> ContractVersion entity tracks all pre-signature edits</li>
                <li><strong>Content Catalog:</strong> ContentCatalogItem.metadata.version + previous_values[]</li>
                <li><strong>Testing Credentials:</strong> New upload creates new TestingCredential (old remains)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">What Is Immutable</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>AdminActionLog (append-only)</li>
                <li>CollaborationActivityLog (append-only)</li>
                <li>ContractAuditLog (append-only)</li>
                <li>FriendActivityLog (append-only)</li>
                <li>ContractVersion (after contract signed)</li>
                <li>Contract snapshots (signed_version_hash prevents tampering)</li>
                <li>ConsentRevocation (cannot be deleted or edited)</li>
                <li>AgentFlag (cannot be deleted, only marked reviewed)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">How Future Developers Should Extend Safely</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                <strong>Critical rules for modifications:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li><strong>Never edit immutable logs:</strong> AdminActionLog, ContractAuditLog, CollaborationActivityLog are append-only. Add new log types if needed, never modify existing.</li>
                <li><strong>Always version contracts:</strong> Any contract change pre-signature must create new ContractVersion. Post-signature changes create new contract.</li>
                <li><strong>Preserve snapshots:</strong> createContractSnapshot MUST be called on full signature. Never skip or modify this step.</li>
                <li><strong>Maintain enforcement functions:</strong> Validation functions (validateTestingRequirements, validateContractInitiation, etc) are critical. If adding new preconditions, add new validation functions.</li>
                <li><strong>Log all admin actions:</strong> Any admin write operation MUST create AdminActionLog entry. No exceptions.</li>
                <li><strong>Gate on verification:</strong> New user-facing features should check VerificationRecord.status="approved" before allowing access.</li>
                <li><strong>Test consent revocation:</strong> Any new content-related feature must respect ConsentRevocation records.</li>
                <li><strong>Audit AI agents:</strong> New system agents must be read-only. They can only create AgentFlag, AIRiskPrediction, or AIMatchSuggestion.</li>
                <li><strong>Update this README:</strong> Any architectural change MUST be reflected in this document.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Testing & Validation</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                Before deploying changes:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Test all enforcement functions with edge cases</li>
                <li>Verify audit logs are created correctly</li>
                <li>Test contract snapshot creation</li>
                <li>Verify consent revocation triggers work</li>
                <li>Check friend gating rules</li>
                <li>Test testing requirement validation</li>
                <li>Verify notifications are sent</li>
                <li>Test dispute workflows end-to-end</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Documentation Requirements</h3>
              <p className="text-sm text-[#9AA6BC] mb-2">
                When adding new features:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
                <li>Update this README with new entities, functions, and enforcement rules</li>
                <li>Document new validation functions in Enforcement Matrix</li>
                <li>Add new notification types to Notifications System section</li>
                <li>Update Role System if permissions change</li>
                <li>Document new audit log types</li>
              </ul>
            </div>
          </CCCard>
        </section>

        {/* Footer */}
        <div className="mt-8 p-4 bg-[#151D2B] border border-[#263248] rounded-lg text-center text-sm text-[#6B7A94]">
          <p>Last Updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-2">
            This documentation is the canonical source of truth for Content Connect's architecture. 
            Consult it before making architectural changes or debugging enforcement issues.
          </p>
        </div>
      </div>
    </div>
  );
}