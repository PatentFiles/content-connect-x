import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';

/**
 * Multi-step account deletion flow:
 * Step 1 — Warning + confirmation checkbox
 * Step 2 — Type "DELETE" to confirm
 * Step 3 — Final irreversible action (calls onConfirm)
 */
export default function DeleteAccountFlow({ isOpen, onClose, userEmail, onConfirm }) {
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const reset = () => {
    setStep(1);
    setAgreed(false);
    setConfirmText('');
    setIsDeleting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFinalDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm?.();
      toast.success('Account deletion request submitted. You will be logged out shortly.');
      handleClose();
    } catch {
      toast.error('Failed to process deletion request. Please contact support.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <CCModal isOpen={isOpen} onClose={handleClose} title="Delete Account">
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#EF4444] mb-1">This action is permanent and irreversible.</p>
              <p className="text-sm text-[#9AA6BC]">
                Deleting your account will permanently remove:
              </p>
              <ul className="text-sm text-[#9AA6BC] list-disc list-inside mt-2 space-y-1">
                <li>Your profile and all settings</li>
                <li>All messages and conversations</li>
                <li>All contracts and collaborations</li>
                <li>All gallery photos and videos</li>
                <li>Your subscription (no refund)</li>
              </ul>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#EF4444]"
            />
            <span className="text-sm text-[#E8EEF9]">
              I understand this is permanent and cannot be undone.
            </span>
          </label>

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={handleClose}>Cancel</CCButton>
            <CCButton
              variant="danger"
              disabled={!agreed}
              onClick={() => setStep(2)}
            >
              Continue
            </CCButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-[#9AA6BC]">
            To confirm, type <span className="font-mono font-bold text-[#EF4444]">DELETE</span> in the box below:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/50 font-mono"
          />
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setStep(1)}>Back</CCButton>
            <CCButton
              variant="danger"
              icon={Trash2}
              disabled={confirmText !== 'DELETE'}
              loading={isDeleting}
              onClick={handleFinalDelete}
            >
              Permanently Delete My Account
            </CCButton>
          </div>
        </div>
      )}
    </CCModal>
  );
}