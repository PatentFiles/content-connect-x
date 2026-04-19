import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, ArrowRight, Lock } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { Link } from 'react-router-dom';

// Onboarding steps required before host account activates
const ACCOUNT_STEPS = [
  {
    key: 'terms',
    label: 'Accept host terms',
    hint: 'Acknowledge platform policies and fees',
    check: (profile) => !!profile?.host_terms_accepted_at,
  },
  {
    key: 'active',
    label: 'Activate host account',
    hint: 'Complete the activation step',
    check: (profile) => profile?.host_account_active === true,
  },
];

// Property-level checklist steps (shown from first property if present)
const PROPERTY_STEPS = [
  { key: 'photos_uploaded', label: 'Upload property photos' },
  { key: 'pricing_set', label: 'Set your pricing' },
  { key: 'rules_set', label: 'Define house rules' },
  { key: 'address_verified', label: 'Add exact address' },
  { key: 'agreement_accepted', label: 'Accept host agreement' },
];

export default function HostOnboardingGateModal({ profile, onClose, onCompleted }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activating, setActivating] = useState(false);

  const hostActive = profile?.host_account_active === true;
  const termsAcceptedOnProfile = !!profile?.host_terms_accepted_at;
  const isFullyActivated = hostActive && termsAcceptedOnProfile;

  // Account-level steps completion
  const accountStepsDone = ACCOUNT_STEPS.filter(s => s.check(profile)).length;
  const allAccountStepsDone = accountStepsDone === ACCOUNT_STEPS.length;

  const handleActivateHost = async () => {
    if (!termsAccepted) {
      toast.error('You must accept the host terms to continue');
      return;
    }
    setActivating(true);
    try {
      const res = await base44.functions.invoke('activateHostAccount', { terms_accepted: true });
      if (res?.data?.error) throw new Error(res.data.error);
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
        <CCCard padding="lg" className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#E8EEF9]">Complete Host Setup First</h2>
                <p className="text-xs text-[#9AA6BC] mt-0.5">
                  You must complete your host setup before adding a property.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-[#6B7A94] hover:text-[#E8EEF9] ml-2 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Account activation steps */}
          <div>
            <p className="text-xs font-medium text-[#6B7A94] uppercase tracking-wider mb-3">Required Steps</p>
            <div className="space-y-2">
              {ACCOUNT_STEPS.map((step) => {
                const done = step.check(profile);
                return (
                  <div key={step.key} className="flex items-start gap-3 p-3 rounded-lg bg-[#0B0F14] border border-[#263248]">
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${done ? 'line-through text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>
                        {step.label}
                      </p>
                      {!done && <p className="text-xs text-[#9AA6BC] mt-0.5">{step.hint}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host terms — only show if not yet activated */}
          {!isFullyActivated && (
            <>
              <div className="bg-[#0B0F14] rounded-lg p-4 border border-[#263248]">
                <p className="text-xs text-[#9AA6BC] leading-relaxed font-medium mb-2">Host Terms Summary</p>
                <ul className="text-xs text-[#6B7A94] list-disc ml-4 space-y-1">
                  <li>Accept the platform booking fee (20% standard, 12% Pro Host)</li>
                  <li>Comply with property and guest policies</li>
                  <li>Maintain accurate property information</li>
                  <li>Process bookings and guest communications promptly</li>
                  <li>Honor cancellation and refund policies</li>
                </ul>
              </div>

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
            </>
          )}

          {/* Success state — fully activated */}
          {isFullyActivated && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30">
              <CheckCircle className="w-5 h-5 text-[#22C55E] flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#22C55E]">Host setup complete!</p>
                <p className="text-xs text-[#9AA6BC] mt-0.5">You can now add and manage properties.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-[#263248]">
            <CCButton variant="outline" onClick={onClose} fullWidth>
              Cancel
            </CCButton>
            {isFullyActivated ? (
              <CCButton variant="success" onClick={onClose} fullWidth>
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </CCButton>
            ) : (
              <CCButton
                variant="primary"
                onClick={handleActivateHost}
                loading={activating}
                disabled={!termsAccepted}
                fullWidth
              >
                Activate Host Account
              </CCButton>
            )}
          </div>
        </CCCard>
      </motion.div>
    </div>
  );
}