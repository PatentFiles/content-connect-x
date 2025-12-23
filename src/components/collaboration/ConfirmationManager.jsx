import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';

export default function ConfirmationManager({ collaborationId, currentUser, userRole, collaborationStatus }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sceneCompleted, setSceneCompleted] = useState(true);
  const [issues, setIssues] = useState('');
  const [consentAck, setConsentAck] = useState(false);
  const queryClient = useQueryClient();

  const { data: confirmations = [] } = useQuery({
    queryKey: ['confirmations', collaborationId],
    queryFn: () => base44.entities.CollaborationConfirmation.filter({
      collaboration_id: collaborationId
    }),
    enabled: !!collaborationId,
  });

  const { data: participantRoles = [] } = useQuery({
    queryKey: ['participantRoles', collaborationId],
    queryFn: () => base44.entities.CollaborationParticipantRole.filter({
      collaboration_id: collaborationId
    }),
    enabled: !!collaborationId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['confirmationProfiles', participantRoles],
    queryFn: async () => {
      const userIds = [...new Set(participantRoles.map(r => r.user_id))];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: participantRoles.length > 0,
  });

  const submitConfirmationMutation = useMutation({
    mutationFn: async (data) => {
      const confirmation = await base44.entities.CollaborationConfirmation.create(data);
      
      // Log activity
      await base44.entities.CollaborationActivityLog.create({
        collaboration_id: collaborationId,
        actor_user_id: currentUser.email,
        actor_role: userRole,
        action_type: 'confirmation_submitted',
        description: `${currentUser.full_name} submitted post-collaboration confirmation`,
        metadata_json: { 
          scene_completed: data.scene_completed_as_agreed,
          has_issues: !!data.issues_encountered
        }
      });
      
      return confirmation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['collaborationActivity'] });
      toast.success('Confirmation submitted');
      setShowConfirmModal(false);
      resetForm();
    },
    onError: () => {
      toast.error('Failed to submit confirmation');
    }
  });

  const resetForm = () => {
    setSceneCompleted(true);
    setIssues('');
    setConsentAck(false);
  };

  const handleSubmit = () => {
    if (!consentAck) {
      toast.error('Please acknowledge consent');
      return;
    }

    submitConfirmationMutation.mutate({
      collaboration_id: collaborationId,
      user_id: currentUser.email,
      scene_completed_as_agreed: sceneCompleted,
      issues_encountered: issues,
      consent_acknowledged: consentAck,
      confirmation_date: new Date().toISOString()
    });
  };

  const userConfirmation = confirmations.find(c => c.user_id === currentUser.email);
  const membersAndAdmins = participantRoles.filter(r => r.role === 'Admin' || r.role === 'Member');
  const requiredConfirmations = membersAndAdmins.length;
  const receivedConfirmations = confirmations.length;
  const allConfirmed = receivedConfirmations >= requiredConfirmations && requiredConfirmations > 0;

  const canSubmit = (userRole === 'Admin' || userRole === 'Member') && 
                    collaborationStatus === 'completed' && 
                    !userConfirmation;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Post-Collaboration Confirmations</h3>
          <p className="text-xs text-[#6B7A94]">
            {receivedConfirmations} of {requiredConfirmations} confirmations received
          </p>
        </div>
        {allConfirmed && (
          <CCBadge variant="success" icon={CheckCircle}>
            Fully Confirmed
          </CCBadge>
        )}
      </div>

      {/* Status Card */}
      <CCCard padding="lg">
        {canSubmit ? (
          <div className="text-center py-4">
            <AlertCircle className="w-12 h-12 text-[#F59E0B] mx-auto mb-3" />
            <p className="text-[#E8EEF9] font-medium mb-2">
              Confirmation Required
            </p>
            <p className="text-sm text-[#6B7A94] mb-4">
              Please submit your post-collaboration confirmation
            </p>
            <CCButton
              variant="primary"
              onClick={() => setShowConfirmModal(true)}
            >
              Submit Confirmation
            </CCButton>
          </div>
        ) : userConfirmation ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-[#22C55E]" />
              <p className="text-[#E8EEF9] font-medium">Your Confirmation Submitted</p>
            </div>
            <div className="bg-[#0B0F14] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#6B7A94]">Scene completed as agreed:</span>
                <CCBadge variant={userConfirmation.scene_completed_as_agreed ? 'success' : 'danger'}>
                  {userConfirmation.scene_completed_as_agreed ? 'Yes' : 'No'}
                </CCBadge>
              </div>
              {userConfirmation.issues_encountered && (
                <div>
                  <p className="text-xs text-[#6B7A94] mb-1">Issues noted:</p>
                  <p className="text-sm text-[#E8EEF9]">{userConfirmation.issues_encountered}</p>
                </div>
              )}
            </div>
          </div>
        ) : collaborationStatus !== 'completed' ? (
          <p className="text-sm text-[#6B7A94] text-center py-4">
            Confirmations are required after collaboration completion
          </p>
        ) : (
          <p className="text-sm text-[#6B7A94] text-center py-4">
            Viewers cannot submit confirmations
          </p>
        )}
      </CCCard>

      {/* All Confirmations List */}
      {confirmations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[#E8EEF9]">Submitted Confirmations</h4>
          {confirmations.map(conf => {
            const profile = profiles.find(p => p.user_id === conf.user_id);
            return (
              <CCCard key={conf.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {profile?.avatar_url && (
                      <img 
                        src={profile.avatar_url} 
                        alt="" 
                        className="w-8 h-8 rounded-full object-cover" 
                      />
                    )}
                    <span className="text-sm text-[#E8EEF9]">
                      {profile?.display_name || 'User'}
                    </span>
                  </div>
                  <CCBadge variant={conf.scene_completed_as_agreed ? 'success' : 'warning'}>
                    {conf.scene_completed_as_agreed ? 'Confirmed' : 'Issues Noted'}
                  </CCBadge>
                </div>
              </CCCard>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <CCModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Submit Confirmation"
        description="Confirm the collaboration outcome and acknowledge consent"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#E8EEF9] mb-2">
              Was the scene completed as agreed?
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setSceneCompleted(true)}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  sceneCompleted
                    ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]'
                    : 'bg-[#151D2B] border-[#263248] text-[#9AA6BC]'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setSceneCompleted(false)}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  !sceneCompleted
                    ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                    : 'bg-[#151D2B] border-[#263248] text-[#9AA6BC]'
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#E8EEF9] mb-2">
              Issues encountered (optional)
            </label>
            <textarea
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="Describe any issues..."
              rows={3}
              className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>

          <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAck}
                onChange={(e) => setConsentAck(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-[#E8EEF9]">
                I acknowledge that all activities were consensual and conducted in accordance with agreed terms
              </span>
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary" 
              onClick={handleSubmit}
              loading={submitConfirmationMutation.isPending}
              disabled={!consentAck}
            >
              Submit Confirmation
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}