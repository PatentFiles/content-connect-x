import React, { useState } from 'react';
import { AlertTriangle, Trash2, Shield, Clock, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';

/**
 * Account deletion flow — staged, evidence-preserving lifecycle:
 * Step 1 — Warning with accurate disclosure of what is/isn't deleted
 * Step 2 — Type "DELETE" to confirm
 * Step 3 — Processing / result (blocked or deactivated)
 */
export default function DeleteAccountFlow({ isOpen, onClose, userEmail }) {
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'blocked' | 'success', message }

  const reset = () => {
    setStep(1);
    setAgreed(false);
    setConfirmText('');
    setIsDeleting(false);
    setResult(null);
  };

  const handleClose = () => {
    if (isDeleting) return;
    reset();
    onClose();
  };

  const handleFinalDelete = async () => {
    setIsDeleting(true);
    setStep(3);
    try {
      const res = await base44.functions.invoke('deleteUserAccount', {});
      const data = res?.data;

      if (data?.error === 'LEGAL_HOLD') {
        setResult({ type: 'blocked', message: data.message });
        setIsDeleting(false);
        return;
      }

      if (data?.success) {
        setResult({ type: 'success', message: data.message });
        setIsDeleting(false);
        setTimeout(() => {
          base44.auth.logout();
        }, 3000);
        return;
      }

      // Unexpected response
      setResult({ type: 'blocked', message: 'An unexpected error occurred. Please contact support.' });
      setIsDeleting(false);
    } catch (err) {
      setResult({ type: 'blocked', message: 'An error occurred while processing your request. Please contact support.' });
      setIsDeleting(false);
    }
  };

  return (
    <CCModal isOpen={isOpen} onClose={handleClose} title="Delete Account">
      {/* Step 1: Warning */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#EF4444] mb-2">This action is permanent and cannot be undone.</p>
              <p className="text-sm text-[#9AA6BC] mb-2">When you delete your account:</p>
              <ul className="text-sm text-[#9AA6BC] list-disc list-inside space-y-1 mb-3">
                <li>Your profile, bio, and personal info will be anonymized</li>
                <li>Your gallery media will be hidden and removed from public view</li>
                <li>Your favorites, blocks, and personal settings will be deleted</li>
                <li>Your subscription will be cancelled (no refund)</li>
              </ul>
              <div className="border-t border-[#EF4444]/20 pt-3 mt-2">
                <p className="text-xs font-semibold text-[#F59E0B] mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Preserved for safety &amp; compliance:
                </p>
                <ul className="text-xs text-[#9AA6BC] list-disc list-inside space-y-0.5">
                  <li>Message and conversation history (anonymized sender)</li>
                  <li>Reports, moderation, and investigation records</li>
                  <li>Identity verification and testing records</li>
                  <li>Contract signatures and collaboration history</li>
                  <li>Dispute and arbitration records</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
            <p className="text-xs text-[#F59E0B] flex items-start gap-2">
              <Shield className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Deletion may be blocked</strong> if your account has open safety reports, disputes, arbitration cases, or is under an administrative review. You will be notified if this applies.
              </span>
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#EF4444] w-5 h-5"
            />
            <span className="text-sm text-[#E8EEF9]">
              I understand that this is irreversible and that certain safety and legal records will be retained as required.
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

      {/* Step 2: Type DELETE */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-[#9AA6BC] mb-1">
              To confirm, type <span className="font-mono font-bold text-[#EF4444]">DELETE</span> below:
            </p>
            <p className="text-xs text-[#6B7A94]">Deactivating account for: {userEmail}</p>
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
              onClick={handleFinalDelete}
            >
              Delete &amp; Deactivate Account
            </CCButton>
          </div>
        </div>
      )}

      {/* Step 3: Processing / Result */}
      {step === 3 && (
        <div className="py-6 space-y-4 text-center">
          {isDeleting && (
            <>
              <div className="w-12 h-12 border-4 border-[#EF4444]/30 border-t-[#EF4444] rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#9AA6BC]">Processing your deletion request...</p>
              <p className="text-xs text-[#6B7A94]">Running compliance checks. Do not close this window.</p>
            </>
          )}

          {!isDeleting && result?.type === 'blocked' && (
            <>
              <div className="w-14 h-14 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mx-auto">
                <Shield className="w-7 h-7 text-[#F59E0B]" />
              </div>
              <h3 className="text-lg font-semibold text-[#E8EEF9]">Deletion Blocked</h3>
              <p className="text-sm text-[#9AA6BC] max-w-xs mx-auto">{result.message}</p>
              <p className="text-xs text-[#6B7A94]">Your account remains active. Contact <span className="text-[#4F8CFF]">support</span> for assistance.</p>
              <CCButton variant="outline" onClick={handleClose} className="mx-auto">Close</CCButton>
            </>
          )}

          {!isDeleting && result?.type === 'success' && (
            <>
              <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-[#22C55E]" />
              </div>
              <h3 className="text-lg font-semibold text-[#E8EEF9]">Account Deactivated</h3>
              <p className="text-sm text-[#9AA6BC] max-w-xs mx-auto">{result.message}</p>
              <div className="flex items-center justify-center gap-2 text-xs text-[#6B7A94]">
                <Clock className="w-3 h-3" />
                <span>Logging you out in a moment...</span>
              </div>
            </>
          )}
        </div>
      )}
    </CCModal>
  );
}