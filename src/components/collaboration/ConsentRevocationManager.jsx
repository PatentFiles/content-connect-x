import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Shield, XCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ConsentRevocationManager({ collaborationId, currentUser, userRole }) {
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revocationForm, setRevocationForm] = useState({
    consent_type: '',
    reason: '',
    reason_details: '',
  });
  const queryClient = useQueryClient();

  const { data: revocations = [] } = useQuery({
    queryKey: ['consentRevocations', collaborationId],
    queryFn: () => base44.entities.ConsentRevocation.filter({ collaboration_id: collaborationId }),
    enabled: !!collaborationId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['revocationProfiles'],
    queryFn: async () => {
      const userIds = [...new Set(revocations.map(r => r.user_id))];
      if (!userIds.length) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: revocations.length > 0,
  });

  const revokeConsentMutation = useMutation({
    mutationFn: async (data) => {
      const revocation = await base44.entities.ConsentRevocation.create({
        ...data,
        collaboration_id: collaborationId,
        user_id: currentUser.email,
        immutable: true
      });

      // Update collaboration status
      await base44.entities.Collaboration.update(collaborationId, { 
        status: 'disputed' 
      });

      // Log activity
      await base44.entities.CollaborationActivity.create({
        collaboration_id: collaborationId,
        user_id: currentUser.email,
        activity_type: 'consent_revoked',
        description: `${currentUser.full_name} revoked ${data.consent_type} consent`,
        metadata: { 
          consent_type: data.consent_type, 
          reason: data.reason 
        }
      });

      // Log admin action
      await base44.entities.AdminActionLog.create({
        admin_user_id: 'system',
        target_type: 'Collaboration',
        target_id: collaborationId,
        action: 'consent_revocation_triggered',
        reason: `Consent revocation by ${currentUser.email}`,
        notes: `Type: ${data.consent_type}, Reason: ${data.reason}`
      });

      return revocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Consent revocation submitted');
      setShowRevokeModal(false);
      setRevocationForm({
        consent_type: '',
        reason: '',
        reason_details: '',
      });
    },
    onError: () => {
      toast.error('Failed to submit revocation');
    }
  });

  const handleRevoke = () => {
    if (!revocationForm.consent_type || !revocationForm.reason) {
      toast.error('Please complete all required fields');
      return;
    }
    revokeConsentMutation.mutate(revocationForm);
  };

  const statusColors = {
    'Submitted': 'warning',
    'Under Review': 'primary',
    'Acknowledged': 'success',
    'Contested': 'danger',
    'Resolved': 'success'
  };

  return (
    <CCCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#EF4444]" />
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Consent Management</h3>
        </div>
        {(userRole === 'Admin' || userRole === 'Member') && (
          <CCButton 
            variant="danger" 
            size="sm" 
            icon={XCircle}
            onClick={() => setShowRevokeModal(true)}
          >
            Revoke Consent
          </CCButton>
        )}
      </div>

      {revocations.length === 0 ? (
        <div className="text-center py-6">
          <Shield className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-sm text-[#9AA6BC]">No consent revocations</p>
          <p className="text-xs text-[#6B7A94] mt-1">All consents remain active</p>
        </div>
      ) : (
        <div className="space-y-3">
          {revocations.map(revocation => {
            const profile = profiles.find(p => p.user_id === revocation.user_id);
            
            return (
              <div key={revocation.id} className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                      <p className="text-sm font-medium text-[#E8EEF9]">
                        {revocation.consent_type.replace(/_/g, ' ')} Revoked
                      </p>
                      <CCBadge variant={statusColors[revocation.status]} size="sm">
                        {revocation.status}
                      </CCBadge>
                    </div>
                    <p className="text-xs text-[#6B7A94] mb-2">
                      By: {profile?.display_name || revocation.user_id} • {format(new Date(revocation.created_date), 'MMM d, yyyy h:mm a')}
                    </p>
                    <div className="text-xs">
                      <p className="text-[#9AA6BC] mb-1">Reason: {revocation.reason.replace(/_/g, ' ')}</p>
                      {revocation.reason_details && (
                        <p className="text-[#E8EEF9]">{revocation.reason_details}</p>
                      )}
                    </div>
                  </div>
                </div>
                {revocation.admin_notes && (
                  <div className="mt-3 bg-[#151D2B] rounded-lg p-3">
                    <p className="text-xs text-[#6B7A94] mb-1">Admin Notes:</p>
                    <p className="text-xs text-[#E8EEF9]">{revocation.admin_notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Revoke Modal */}
      <CCModal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        title="Revoke Consent"
        description="This action is permanent and will trigger admin review"
      >
        <div className="space-y-4">
          <CCSelect
            label="Consent Type *"
            value={revocationForm.consent_type}
            onChange={(e) => setRevocationForm({ ...revocationForm, consent_type: e.target.value })}
            required
          >
            <option value="">Select type</option>
            <option value="scene_participation">Scene Participation</option>
            <option value="distribution">Distribution</option>
            <option value="promotional_usage">Promotional Usage</option>
          </CCSelect>

          <CCSelect
            label="Reason *"
            value={revocationForm.reason}
            onChange={(e) => setRevocationForm({ ...revocationForm, reason: e.target.value })}
            required
          >
            <option value="">Select reason</option>
            <option value="boundary_violation">Boundary Violation</option>
            <option value="misrepresentation">Misrepresentation</option>
            <option value="contract_breach">Contract Breach</option>
            <option value="personal_choice">Personal Choice</option>
            <option value="safety_concern">Safety Concern</option>
            <option value="other">Other</option>
          </CCSelect>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Additional Details</label>
            <textarea
              value={revocationForm.reason_details}
              onChange={(e) => setRevocationForm({ ...revocationForm, reason_details: e.target.value })}
              placeholder="Provide additional context..."
              rows={4}
              className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>

          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
            <p className="text-xs text-[#EF4444] font-medium">⚠️ Important</p>
            <p className="text-xs text-[#9AA6BC] mt-1">
              Consent revocation is permanent and immutable. This will freeze the collaboration, notify admins, and may trigger arbitration.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <CCButton variant="outline" onClick={() => setShowRevokeModal(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="danger"
              onClick={handleRevoke}
              loading={revokeConsentMutation.isPending}
            >
              Submit Revocation
            </CCButton>
          </div>
        </div>
      </CCModal>
    </CCCard>
  );
}