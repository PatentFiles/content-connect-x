import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCModal from '@/components/ui-custom/CCModal';
import CCBadge from '@/components/ui-custom/CCBadge';

export default function CompletionManager({ collaboration, currentUser, userRole }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const queryClient = useQueryClient();

  // Only show for participants (not observers)
  const isParticipant = collaboration?.participant_ids?.includes(currentUser?.email);
  const canComplete = isParticipant && ['signed', 'active', 'agreed'].includes(collaboration?.status);

  const completionMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('completeCollaboration', {
        collaboration_id: collaboration.id,
        reason_text: reasonText,
      });
      if (res.data?.error) {
        throw new Error(res.data.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaboration', collaboration.id] });
      queryClient.invalidateQueries({ queryKey: ['myCollaborations'] });
      toast.success('Collaboration completed! Earnings will be generated shortly.');
      setShowConfirmModal(false);
      setReasonText('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to complete collaboration');
    },
  });

  if (!canComplete) {
    return null;
  }

  // Check if signed contract exists
  const hasSignedContract = collaboration?.contract_ids?.length > 0;

  return (
    <>
      <CCCard padding="lg" className="border-l-4 border-l-[#22C55E]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
              <h3 className="font-semibold text-[#E8EEF9]">Ready to Complete?</h3>
            </div>
            <p className="text-sm text-[#9AA6BC] mb-3">
              Once you mark this collaboration as complete:
            </p>
            <ul className="text-xs text-[#6B7A94] space-y-1 ml-7 list-disc">
              <li>All participants will be notified</li>
              <li>Earnings will be automatically calculated and recorded</li>
              <li>Commission splits will be distributed</li>
              <li>Studio fees (if applicable) will be deducted</li>
            </ul>
          </div>
          <CCButton
            variant="success"
            onClick={() => setShowConfirmModal(true)}
            loading={completionMutation.isPending}
          >
            Mark Complete
          </CCButton>
        </div>
      </CCCard>

      {/* Confirmation Modal */}
      <CCModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Complete Collaboration"
        description="This action will finalize the collaboration and trigger earnings generation"
      >
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-[#0B0F14] border border-[#263248] rounded-lg p-4">
            <h4 className="font-medium text-[#E8EEF9] mb-2">Collaboration Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[#9AA6BC]">
                <span>Participants:</span>
                <span className="text-[#E8EEF9]">{collaboration?.participant_ids?.length || 0}</span>
              </div>
              {collaboration?.compensation_details?.amount && (
                <div className="flex justify-between text-[#9AA6BC]">
                  <span>Total Compensation:</span>
                  <span className="text-[#E8EEF9]">
                    ${collaboration.compensation_details.amount} {collaboration.compensation_details.currency}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#9AA6BC]">
                <span>Status:</span>
                <CCBadge variant="success" size="sm">Ready for Completion</CCBadge>
              </div>
            </div>
          </div>

          {/* Optional Reason */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
              Optional Notes
            </label>
            <textarea
              placeholder="e.g., 'All scenes filmed successfully', 'Minor adjustments made', etc."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-3 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/50 resize-none"
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#9AA6BC]">
              Make sure all participants have signed contracts and all terms are agreed upon before completing.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <CCButton
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              disabled={completionMutation.isPending}
            >
              Cancel
            </CCButton>
            <CCButton
              variant="success"
              onClick={() => completionMutation.mutate()}
              loading={completionMutation.isPending}
            >
              Confirm Completion
            </CCButton>
          </div>
        </div>
      </CCModal>
    </>
  );
}