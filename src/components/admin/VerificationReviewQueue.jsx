import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, AlertCircle, FileText } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import { toast } from 'sonner';

export default function VerificationReviewQueue() {
  const [rejectionReason, setRejectionReason] = useState({});
  const [overrideReason, setOverrideReason] = useState('');
  const queryClient = useQueryClient();

  const { data: pendingVerifications = [] } = useQuery({
    queryKey: ['verifications', 'pending'],
    queryFn: () => base44.entities.VerificationRecord.filter({ status: 'pending' }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ verificationId, userId }) => {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      const admin = await base44.auth.me();

      await base44.entities.VerificationRecord.update(verificationId, {
        status: 'approved',
        verified_at: new Date().toISOString(),
        expires_at: expiryDate.toISOString()
      });

      await base44.entities.AdminActionLog.create({
        admin_user_id: admin.email,
        action_type: 'verification_approved',
        target_entity_type: 'VerificationRecord',
        target_entity_id: verificationId,
        after_state: { status: 'approved' },
        reason: 'Admin approved identity verification'
      });

      // Notify the user
      await base44.entities.Notification.create({
        user_id: userId,
        type: 'verification_status',
        actor_user_id: admin.email,
        title: 'Verification Approved',
        body: 'Your identity verification has been approved. You now have full access to the platform.',
        action_url: 'Dashboard'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      toast.success('Verification approved');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ verificationId, userId, reason }) => {
      const admin = await base44.auth.me();

      await base44.entities.VerificationRecord.update(verificationId, {
        status: 'rejected',
        rejection_reason: reason
      });

      await base44.entities.AdminActionLog.create({
        admin_user_id: admin.email,
        action_type: 'verification_rejected',
        target_entity_type: 'VerificationRecord',
        target_entity_id: verificationId,
        after_state: { status: 'rejected', rejection_reason: reason },
        reason
      });

      // Notify the user
      await base44.entities.Notification.create({
        user_id: userId,
        type: 'verification_status',
        actor_user_id: admin.email,
        title: 'Verification Rejected',
        body: `Your verification was not approved. Reason: ${reason}. Please re-submit with correct documents.`,
        action_url: 'Verification'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      setRejectionReason({});
      toast.success('Verification rejected');
    },
  });

  const getProfileForUser = (userId) => {
    return profiles.find(p => p.user_id === userId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#E8EEF9]">Verification Review Queue</h2>
        <CCBadge variant="warning">
          {pendingVerifications.length} Pending
        </CCBadge>
      </div>

      <div className="space-y-4">
        {pendingVerifications.map(verification => {
          const profile = getProfileForUser(verification.user_id);
          
          return (
            <CCCard key={verification.id} padding="lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#4F8CFF]" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-[#E8EEF9]">
                      {profile?.display_name || verification.user_id}
                    </span>
                    <CCBadge variant="warning" size="sm">
                      {verification.provider}
                    </CCBadge>
                  </div>

                  <div className="text-sm text-[#9AA6BC] mb-3">
                    Submitted: {new Date(verification.created_date).toLocaleString()}
                  </div>

                  {verification.documents_submitted && verification.documents_submitted.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-[#6B7A94] mb-2">Documents:</p>
                      <div className="space-y-1">
                        {verification.documents_submitted.map((doc, idx) => (
                          <a
                            key={idx}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-[#4F8CFF] hover:underline"
                          >
                            {doc.type} - View Document
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {rejectionReason[verification.id] !== undefined && (
                    <CCInput
                      placeholder="Enter rejection reason..."
                      value={rejectionReason[verification.id] || ''}
                      onChange={(e) => setRejectionReason({
                        ...rejectionReason,
                        [verification.id]: e.target.value
                      })}
                      className="mb-3"
                    />
                  )}

                  <div className="flex gap-2">
                    <CCButton
                      variant="success"
                      size="sm"
                      icon={Check}
                      onClick={() => approveMutation.mutate({
                        verificationId: verification.id,
                        userId: verification.user_id
                      })}
                      loading={approveMutation.isPending}
                    >
                      Approve
                    </CCButton>
                    
                    {rejectionReason[verification.id] === undefined ? (
                      <CCButton
                        variant="danger"
                        size="sm"
                        icon={X}
                        onClick={() => setRejectionReason({
                          ...rejectionReason,
                          [verification.id]: ''
                        })}
                      >
                        Reject
                      </CCButton>
                    ) : (
                      <>
                        <CCButton
                          variant="danger"
                          size="sm"
                          icon={X}
                          onClick={() => rejectMutation.mutate({
                            verificationId: verification.id,
                            userId: verification.user_id,
                            reason: rejectionReason[verification.id]
                          })}
                          loading={rejectMutation.isPending}
                          disabled={!rejectionReason[verification.id]}
                        >
                          Confirm Reject
                        </CCButton>
                        <CCButton
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updated = {...rejectionReason};
                            delete updated[verification.id];
                            setRejectionReason(updated);
                          }}
                        >
                          Cancel
                        </CCButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CCCard>
          );
        })}

        {pendingVerifications.length === 0 && (
          <CCCard padding="lg">
            <div className="text-center text-[#6B7A94]">
              No pending verifications
            </div>
          </CCCard>
        )}
      </div>
    </div>
  );
}