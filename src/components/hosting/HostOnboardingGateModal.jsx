import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';

const REQUIREMENTS = [
  { key: 'verified', label: 'Identity verified', hint: 'Complete verification flow' },
  { key: 'terms', label: 'Accept host terms', hint: 'Acknowledge platform policies and fees' },
  { key: 'pricing', label: 'Understand pricing model', hint: 'Review booking fees and payouts' },
];

export default function HostOnboardingGateModal({ profile, onClose, onCompleted }) {
  const [step, setStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleActivateHost = async () => {
    if (!termsAccepted) {
      toast.error('You must accept the host terms to continue');
      return;
    }
    setActivating(true);
    try {
      await base44.entities.UserProfile.update(profile.id, {
        host_account_active: true,
        host_terms_accepted_at: new Date().toISOString(),
      });
      toast.success('Your host account is now active!');
      onCompleted();
    } catch (err) {
      toast.error(err.message || 'Failed to activate host account');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg"
      >
        <CCCard padding="lg" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#E8EEF9]">Become a Host</h2>
            <button onClick={onClose} className="text-[#6B7A94] hover:text-[#E8EEF9]">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Requirements checklist */}
          <div className="space-y-3">
            {REQUIREMENTS.map((req, i) => {
              const isVerified = req.key === 'verified' && profile?.is_admin; // Quick check
              return (
                <div key={req.key} className="flex items-start gap-3">
                  {isVerified ? (
                    <CheckCircle className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-[#E8EEF9]">{req.label}</p>
                    <p className="text-xs text-[#9AA6BC]">{req.hint}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Host terms acceptance */}
          <div className="bg-[#0B0F14] rounded-lg p-4 border border-[#263248]">
            <p className="text-xs text-[#6B7A94] leading-relaxed mb-4">
              <strong>Host Terms Summary:</strong> By becoming a host, you agree to:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Accept the platform booking fee (20% standard, 12% Pro Host)</li>
                <li>Comply with property and guest policies</li>
                <li>Maintain accurate property information</li>
                <li>Process bookings and guest communications promptly</li>
                <li>Honor cancellation and refund policies</li>
              </ul>
            </p>
          </div>

          {/* Terms checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-[#9AA6BC]">
              I have read and accept the host terms, fee structure, and platform policies
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-[#263248]">
            <CCButton variant="outline" onClick={onClose} fullWidth>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={handleActivateHost}
              loading={activating}
              disabled={!termsAccepted}
              fullWidth
            >
              Activate Host Account
            </CCButton>
          </div>
        </CCCard>
      </motion.div>
    </div>
  );
}