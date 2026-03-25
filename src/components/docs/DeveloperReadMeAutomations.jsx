import React from 'react';
import { Activity } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';

export function AutomationsSection() {
  return (
    <section id="automations" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <Activity className="w-6 h-6 text-[#4F8CFF]" />
        Automations & Scheduled Jobs
      </h2>
      <CCCard className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Scheduled Automations</h3>
          <p className="text-sm text-[#9AA6BC] mb-3">Run on a schedule via backend cron or Base44 scheduled tasks:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-[#9AA6BC]">
            <li><strong>checkTestingDeadlines</strong> (Daily, 6am UTC): Marks TestingCredential.expires_at as passed → status="expired". Triggers auto-pause notifications.</li>
            <li><strong>checkTestingDeadlineWarnings</strong> (Daily, 7am UTC): Sends warnings for testing expiring within 7 days.</li>
            <li><strong>checkCompletionReminders</strong> (Daily, noon UTC): Sends completion reminders 3 days after filming date if collaboration not marked completed.</li>
            <li><strong>checkTestingDeadlineWarnings</strong> (Daily, 7am UTC): Sends notifications 7 days before testing expiry.</li>
            <li><strong>calculateReputationScore</strong> (Daily, 1am UTC): Recalculates ReputationScore for all active users based on collaboration history, response time, verification status.</li>
            <li><strong>executeAgentScan</strong> (Weekly, Sunday 2am UTC): Runs compliance_safety_agent. Analyzes all profiles, collaborations, contracts for suspicious patterns. Creates AgentFlag + AIRiskPrediction records.</li>
            <li><strong>generateMatches</strong> (Daily, 3am UTC): Generates AIMatchSuggestion entries for creators based on profile overlap, geography, travel sync.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Entity Automations (Triggers on Record Change)</h3>
          <p className="text-sm text-[#9AA6BC] mb-3">Automatically fire when entity records are created, updated, or deleted:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-[#9AA6BC]">
            <li><strong>On Collaboration.status="completed":</strong> autoCreateEarnings fires → creates EarningsRecord entries based on Contract.post_scene_rules.revenue_split</li>
            <li><strong>On Collaboration.status="signed":</strong> lockCollaborationBooking fires → creates ScheduleEntry with locked=true for all participants</li>
            <li><strong>On VerificationRecord.status="approved":</strong> checkIdentityConsistency fires → creates IdentityFingerprint + scans for duplicates</li>
            <li><strong>On StudioRepresentation.status="ACTIVE":</strong> autoAddStudioObserver fires → adds studio as RepObserver to all creator's collaborations</li>
            <li><strong>On Contract.status="signed" (all signatories):</strong> createContractSnapshot fires → creates immutable ContractVersion, generates PDF, locks contract terms</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Connector Automations (Webhook-Based, If Enabled)</h3>
          <p className="text-sm text-[#9AA6BC] mb-3">Optional: Triggered by external service webhooks (requires Builder+ OAuth connectors):</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-[#9AA6BC]">
            <li><strong>Google Calendar event created:</strong> (If saveContractToGoogleDrive connected) Auto-add collaboration event to creator's calendar</li>
            <li><strong>Google Drive file shared:</strong> (If Drive connector active) Log file shares in CollaborationDocument or trigger evidence collection</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Manual Automation Triggers (On-Demand)</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-[#9AA6BC]">
            <li><strong>executeAgentScan:</strong> Can be run on-demand via AgentManagement page (admin only) to immediately scan for flags</li>
            <li><strong>generateMatches:</strong> Can be triggered by frontend to refresh suggestions for specific user</li>
            <li><strong>calculateReputationScore:</strong> Can force-recalculate for a user if needed (e.g., after dispute resolution)</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Critical Automation Guarantees</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-[#9AA6BC]">
            <li><strong>Idempotency:</strong> All automations must be idempotent (safe to run multiple times without duplication)</li>
            <li><strong>createContractSnapshot:</strong> CRITICAL. Must fire when Contract.status → "signed" with ALL signatories completed. Creates immutable snapshot.</li>
            <li><strong>triggerConsentRevocation:</strong> CRITICAL. Must be idempotent. Safe to retry if network failure occurs.</li>
            <li><strong>autoCreateEarnings:</strong> Must fire on Collaboration.status="completed". Creates initial "projected" earnings for admin settlement later.</li>
            <li><strong>Audit logging:</strong> All automations log their execution in AdminActionLog or automation-specific logs (AgentRun)</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Deployment Checklist for Automations</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-[#9AA6BC]">
            <li>✓ checkTestingDeadlines → Scheduled (daily 6am UTC)</li>
            <li>✓ checkTestingDeadlineWarnings → Scheduled (daily 7am UTC)</li>
            <li>✓ checkCompletionReminders → Scheduled (daily noon UTC)</li>
            <li>✓ calculateReputationScore → Scheduled (daily 1am UTC)</li>
            <li>✓ executeAgentScan → Scheduled (weekly Sunday 2am UTC) OR on-demand via admin page</li>
            <li>✓ generateMatches → Scheduled (daily 3am UTC) OR on-demand</li>
            <li>✓ autoCreateEarnings → Entity trigger (Collaboration.status="completed")</li>
            <li>✓ createContractSnapshot → Entity trigger (Contract.status="signed", all signers)</li>
            <li>✓ autoAddStudioObserver → Entity trigger (StudioRepresentation.status="ACTIVE")</li>
            <li>✓ checkIdentityConsistency → Entity trigger (VerificationRecord.status="approved")</li>
          </ul>
        </div>
      </CCCard>
    </section>
  );
}