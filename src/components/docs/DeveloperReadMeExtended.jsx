import React from 'react';
import { Calendar, DollarSign, CheckCircle, Shield, Database } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';

export function BookingSystemSection() {
  return (
    <section id="booking" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <Calendar className="w-6 h-6 text-[#4F8CFF]" />
        5b. Booking System & Marketplace
      </h2>
      <CCCard className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">BookingRequest Lifecycle</h3>
          <p className="text-sm text-[#9AA6BC] mb-3">Photographers, videographers, and studios can receive booking requests:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>PENDING:</strong> Request created via BookingRequestModal (ViewProfile page)</li>
            <li><strong>ACCEPTED:</strong> Recipient accepts. Calls acceptBookingRequest function → creates Collaboration entity with booking_type="photographer"/"videographer"/"studio"</li>
            <li><strong>DECLINED:</strong> Recipient declines. Optional response_message. No collaboration created.</li>
            <li><strong>CANCELLED:</strong> Requester cancels before response.</li>
            <li><strong>EXPIRED:</strong> Auto-expired after 30 days (admin automation).</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Booking Types</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>creator:</strong> Creator-to-creator collaboration (default)</li>
            <li><strong>photographer:</strong> Booking photographer for content</li>
            <li><strong>videographer:</strong> Booking videographer for content</li>
            <li><strong>studio:</strong> Booking studio space/facilities</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Studio Booking Specifics</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li>ScheduleEntry tracks studio availability by room (location_name, room_label)</li>
            <li>max_bookings field allows overbooking if studio allows (e.g., 2 shoots same day in different rooms)</li>
            <li>current_booking_count incremented on acceptance (up to max_bookings)</li>
            <li>studio_location_name + studio_notes captured in BookingRequest</li>
            <li>Studio rates tracked in ServiceDetails.rates (hourly, half_day, full_day)</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Photographer/Videographer Specifics</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li>ServiceDetails.packages define fixed offerings (name, description, price, deliverables, duration)</li>
            <li>ServiceDetails.rates provide hourly/half-day/full-day alternatives</li>
            <li>ServicePortfolioItem entities showcase past work (images/videos only)</li>
            <li>Booking can reference package (BookingRequest.schedule_entry_id → ScheduleEntry.room_label)</li>
            <li>Deliverables captured in Collaboration.deliverables (edit timeline, file format, raw+edited, etc.)</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Marketplace Discovery</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li>Search/Discovery filters by role_type (photographer, videographer, studio)</li>
            <li>ServiceDetails visibility: ServiceDetails.portfolio_public shows portfolio items</li>
            <li>Studio booking visibility: ScheduleEntry entries with entry_type="AVAILABILITY" shown to shoppers</li>
            <li>Rates visibility: ServiceDetails.rates_visibility controls if rates shown or inquire-to-book</li>
          </ul>
        </div>
      </CCCard>
    </section>
  );
}

export function EarningsSection() {
  return (
    <section id="earnings" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <DollarSign className="w-6 h-6 text-[#4F8CFF]" />
        5c. Earnings & Revenue Tracking
      </h2>
      <CCCard className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">EarningsRecord Lifecycle</h3>
          <p className="text-sm text-[#9AA6BC] mb-3">Earnings are created when collaboration completes:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>TRIGGERED:</strong> Collaboration.status → "completed"</li>
            <li><strong>FUNCTION:</strong> autoCreateEarnings backend function parses Contract.post_scene_rules.revenue_split</li>
            <li><strong>CREATED:</strong> One EarningsRecord per revenue recipient (creators, agents, studios)</li>
            <li><strong>FIELDS:</strong> gross_amount, net_amount, split_percentage, agent_commission_rate, studio_split_rate</li>
            <li><strong>STATUS:</strong> Initially "projected". Admin marks as "settled" via updateEarningsSettlement.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Revenue Split Calculation</h3>
          <p className="text-sm text-[#9AA6BC] mb-3">Based on Contract.post_scene_rules.revenue_split:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Multi-creator split:</strong> {'{'} creator_1: 50%, creator_2: 50% {'}'}</li>
            <li><strong>Agent commission:</strong> Deducted from creator's share if AgentRepresentation.exclusive=true</li>
            <li><strong>Studio split:</strong> Deducted if StudioRepresentation.exclusive=true</li>
            <li><strong>Example:</strong> $1000 gross. Creator 60%, Agent 15% of creator, Studio 20% of creator → Creator nets $408, Agent $90, Studio $132</li>
            <li><strong>Validation:</strong> validateContractStudioSplit ensures splits sum to 100%</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Creator Dashboard KPIs</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li>Total earnings (projected + settled) via Dashboard → EarningsTracker component</li>
            <li>Pending settlements (projected earnings not yet marked settled)</li>
            <li>Agent commissions deducted automatically (visible on EarningsRecord)</li>
            <li>Studio splits deducted automatically if represented</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Admin Visibility</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li>EarningsAdminPanel shows all earnings by user/collaboration/period</li>
            <li>Filter by settlement_status (projected/pending/settled/disputed)</li>
            <li>Bulk mark-as-settled actions with optional notes</li>
            <li>Dispute handling if parties disagree on amounts</li>
          </ul>
        </div>
      </CCCard>
    </section>
  );
}

export function CompletionSection() {
  return (
    <section id="completion" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <CheckCircle className="w-6 h-6 text-[#4F8CFF]" />
        5d. Collaboration Completion
      </h2>
      <CCCard className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Completion Flow</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>After filming:</strong> Collaboration.status="signed" (waiting for completion)</li>
            <li><strong>CompletionBanner:</strong> Shown on collaboration detail page after filming date has passed</li>
            <li><strong>CompletionManager:</strong> Admin/collaborators mark as completed via modal (take photos, notes)</li>
            <li><strong>Transition:</strong> Collaboration.status → "completed"</li>
            <li><strong>AUTO TRIGGER:</strong> autoCreateEarnings backend function fires, creates EarningsRecord entries</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Completion Reminders</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Auto-reminder:</strong> Sent 3 days after filming date if collaboration not marked completed</li>
            <li><strong>Function:</strong> checkCompletionReminders (scheduled daily)</li>
            <li><strong>Notification type:</strong> "collaboration_completion_reminder"</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Earnings Auto-Creation</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Function:</strong> completeCollaboration (backend)</li>
            <li><strong>Parses:</strong> Contract.post_scene_rules.revenue_split</li>
            <li><strong>Creates:</strong> EarningsRecord entries for each revenue recipient</li>
            <li><strong>Sets:</strong> settlement_status="projected", EarningsRecord.type="projected"</li>
          </ul>
        </div>
      </CCCard>
    </section>
  );
}

export function IdentitySafetySection() {
  return (
    <section id="identity-safety" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <Shield className="w-6 h-6 text-[#4F8CFF]" />
        5e. Identity Consistency & Safety Systems
      </h2>
      <CCCard className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Identity Fingerprinting</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>When:</strong> VerificationRecord.status → "approved"</li>
            <li><strong>Created:</strong> IdentityFingerprint entity (never stores raw name/DOB)</li>
            <li><strong>Fields:</strong> name_hash (SHA-256), name_metaphone (phonetic), dob_hash</li>
            <li><strong>Purpose:</strong> Detect duplicate accounts without exposing PII</li>
            <li><strong>Function:</strong> checkIdentityConsistency runs after verification approval</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Consistency Flags</h3>
          <p className="text-sm text-[#9AA6BC] mb-3">If IdentityFingerprint matches another user:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Created:</strong> IdentityConsistencyFlag entity</li>
            <li><strong>confidence:</strong> low | medium | high (match strength)</li>
            <li><strong>reason_codes:</strong> name_hash_match, phonetic_match, dob_match, doc_type_match, repeated_rejections, etc.</li>
            <li><strong>Admin review:</strong> CompliancePortal → IdentityConsistencyPanel</li>
            <li><strong>Actions:</strong> Cleared (false positive), suspend, ban, legal_hold (under investigation)</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Safety Check-In</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>When:</strong> Active/signed collaborations, 30min before scheduled start</li>
            <li><strong>SafetyCheckInWidget:</strong> Shown on CollaborationDetail page</li>
            <li><strong>User actions:</strong> Check in (sets status="checked_in"), provide trusted contact, share location (city only)</li>
            <li><strong>Auto-escalation:</strong> If user doesn't check out 30min after expected end, status="escalated" → admin notified</li>
            <li><strong>Location privacy:</strong> Only city-level shared, never exact coordinates</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Consent Revocation Impact</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Creator-only action:</strong> Can revoke consent after signing contract</li>
            <li><strong>Creates:</strong> ConsentRevocation record (immutable)</li>
            <li><strong>Triggers:</strong> Contract.post_scene_rules.takedown_policy</li>
            <li><strong>Deadline:</strong> All parties must remove content by takedown_deadline</li>
            <li><strong>Enforcement:</strong> Admin reviews via ConsentRevocationManager</li>
            <li><strong>Legal record:</strong> ConsentRevocation + Contract snapshot preserved for evidence</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Reputation Scoring</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Entity:</strong> ReputationScore (calculated, non-editable)</li>
            <li><strong>Score:</strong> 0-100, higher = more trustworthy</li>
            <li><strong>Label:</strong> new → established → reliable → highly_reliable → trusted</li>
            <li><strong>Factors:</strong> collaborations completed, cancellations, disputes won/lost, response time, verification status, testing compliance, account age, profile completeness</li>
            <li><strong>Calculation:</strong> calculateReputationScore backend function (scheduled daily)</li>
            <li><strong>Display:</strong> ReputationBadge on profiles + Dashboard</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Account Status Enforcement</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Banned users:</strong> UserProfile.banned=true. Cannot see profiles, send messages, create collaborations. Content hidden from others.</li>
            <li><strong>Suspended users:</strong> UserProfile.suspended=true. Temporary block + reason shown. Access restored after period.</li>
            <li><strong>Legal hold:</strong> UserProfile.legal_hold=true. Account cannot be deleted (legal investigation ongoing).</li>
            <li><strong>Deactivated:</strong> UserProfile.account_deactivated=true. Profile removed from discovery, messaging blocked, collaborations visible to admin only.</li>
            <li><strong>Enforcement:</strong> checkUserAccessStatus function checks all flags before allowing actions</li>
          </ul>
        </div>
      </CCCard>
    </section>
  );
}