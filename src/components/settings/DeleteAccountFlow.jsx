import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';

/**
 * Multi-step account deletion flow with full backend data cleanup:
 * Step 1 — Warning + confirmation checkbox
 * Step 2 — Type "DELETE" to confirm
 * Calls deleteUserAccount backend function which removes ALL user data
 */
export default function DeleteAccountFlow({ isOpen, onClose, userEmail }) {
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
    if (isDeleting) return;
    reset();
    onClose();
  };

  const handleFinalDelete = async () => {
    setIsDeleting(true);
    await base44.functions.invoke('deleteUserAccount', {});
    toast.success('Account deleted. Logging out...');
    setTimeout(() => {
      base44.auth.logout();
    }, 1500);
  };

  return (
    <CCModal isOpen={isOpen} onClose={handleClose} title="Delete Account">
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#EF4444] mb-1">This action is permanent and irreversible.</p>
              <p className="text-sm text-[#9AA6BC]">Deleting your account will permanently remove:</p>
              <ul className="text-sm text-[#9AA6BC] list-disc list-inside mt-2 space-y-1">
                <li>Your profile, bio, and all settings</li>
                <li>All messages and conversations</li>
                <li>All contracts and collaborations</li>
                <li>All gallery photos and videos</li>
                <li>All testing credentials and documents</li>
                <li>Your subscription (no refund)</li>
                <li>All notifications and activity history</li>
              </ul>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#EF4444] w-5 h-5"
            />
            <span className="text-sm text-[#E8EEF9]">
              I understand this is permanent and cannot be undone.
            </span>
          </label>

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={handleClose}>Cancel</CCButton>
            <CCButton variant="danger" disabled={!agreed} onClick={() => setStep(2)}>
              Continue
            </CCButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {isDeleting ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 border-4 border-[#EF4444]/30 border-t-[#EF4444] rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#9AA6BC]">Deleting your account data...</p>
              <p className="text-xs text-[#6B7A94]">This may take a moment. Do not close this window.</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-[#9AA6BC] mb-1">
                  To confirm, type <span className="font-mono font-bold text-[#EF4444]">DELETE</span> below:
                </p>
                <p className="text-xs text-[#6B7A94]">Deleting account for: {userEmail}</p>
              </div>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-3 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/50 font-mono text-center text-lg"
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
                  Permanently Delete Account
                </CCButton>
              </div>
            </>
          )}
        </div>
      )}
    </CCModal>
  );
}