import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Flag } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';

const reportReasons = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'fake_profile', label: 'Fake profile or impersonation' },
  { value: 'underage', label: 'Suspected underage user' },
  { value: 'non_consensual', label: 'Non-consensual content' },
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Other' },
];

export default function ReportModal({
  isOpen,
  onClose,
  targetUserId,
  targetContentType = 'profile',
  targetContentId = null,
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const queryClient = useQueryClient();

  const reportMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Report.create({
        reporter_id: user.email,
        target_user_id: targetUserId,
        target_content_type: targetContentType,
        target_content_id: targetContentId,
        reason: selectedReason,
        details: details.trim(),
        status: 'pending',
      });
    },
    onSuccess: () => {
      toast.success('Report submitted. Our team will review it shortly.');
      onClose();
      setSelectedReason('');
      setDetails('');
    },
    onError: () => {
      toast.error('Failed to submit report. Please try again.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <CCCard padding="none" className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#151D2B] border-b border-[#263248] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#EF4444]" />
            <h2 className="text-lg font-semibold text-[#E8EEF9]">Report User</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[#6B7A94] hover:text-[#E8EEF9]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[#9AA6BC]">
            Please select the reason for reporting this user. Our moderation team will review your report.
          </p>

          {/* Reason Selection */}
          <div className="space-y-2">
            {reportReasons.map((reason) => (
              <label
                key={reason.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedReason === reason.value
                    ? 'border-[#4F8CFF] bg-[#4F8CFF]/10'
                    : 'border-[#263248] hover:border-[#3A4A6B]'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={reason.value}
                  checked={selectedReason === reason.value}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="text-[#4F8CFF]"
                />
                <span className="text-sm text-[#E8EEF9]">{reason.label}</span>
              </label>
            ))}
          </div>

          {/* Details Textarea (always shown, but especially for "other") */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
              Additional details {selectedReason === 'other' && <span className="text-[#EF4444]">*</span>}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={selectedReason === 'other' ? 'Please describe the issue...' : 'Optional: Provide more context...'}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-3 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <CCButton
              variant="outline"
              fullWidth
              onClick={onClose}
            >
              Cancel
            </CCButton>
            <CCButton
              variant="danger"
              fullWidth
              onClick={() => reportMutation.mutate()}
              loading={reportMutation.isPending}
              disabled={!selectedReason || (selectedReason === 'other' && !details.trim())}
            >
              Submit Report
            </CCButton>
          </div>
        </div>
      </CCCard>
    </div>
  );
}