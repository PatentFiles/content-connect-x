import React from 'react';
import CCCard from '@/components/ui-custom/CCCard';

export default function ChangeGovernance() {
  return (
    <section id="governance" className="mb-8">
      <h2 className="text-2xl font-bold text-[#E8EEF9] mb-4 flex items-center gap-2">
        <span className="text-[#4F8CFF]">🛡</span>
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
          <ul className="list-disc list-inside space-y-1 text-sm text-[#9AA6BC]">
            <li><strong>Never edit immutable logs:</strong> Append-only. Add new log types if needed.</li>
            <li><strong>Always version contracts:</strong> Any pre-signature change creates new ContractVersion.</li>
            <li><strong>Preserve snapshots:</strong> createContractSnapshot MUST be called on full signature.</li>
            <li><strong>Maintain enforcement functions:</strong> validateTestingRequirements, validateContractInitiation, etc are critical.</li>
            <li><strong>Log all admin actions:</strong> Any admin write MUST create AdminActionLog entry.</li>
            <li><strong>Gate on verification:</strong> New features should check VerificationRecord.status="approved".</li>
            <li><strong>Test consent revocation:</strong> Any content feature must respect ConsentRevocation records.</li>
            <li><strong>Audit AI agents:</strong> New system agents must be read-only.</li>
            <li><strong>Update this README:</strong> Any architectural change MUST be reflected here.</li>
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Testing & Validation Before Deploy</h3>
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
      </CCCard>
    </section>
  );
}