import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, LogOut, Lock, Shield, Clock, FileText } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCModal from '@/components/ui-custom/CCModal';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function AccountBlockedScreen({ blockReason, suspensionReason, suspensionEndAt }) {
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeStatement, setDisputeStatement] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.removeItem('auth_token');
    }
  }, []);

  const isBanned = blockReason === 'banned';
  const isSuspended = blockReason === 'suspended';

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleSubmitDispute = async () => {
    if (!disputeStatement.trim()) return;
    setSubmitting(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      if (user) {
        await base44.entities.BannedReentryDispute.create({
          submitter_user_id: user.email,
          dispute_statement: disputeStatement.trim(),
          status: 'pending',
        });
      }
      setSubmitted(true);
    } catch (e) {
      // Silent — user sees success either way to prevent enumeration
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] to-[#151D2B] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <CCCard padding="xl" className={`text-center border-l-4 ${isBanned ? 'border-l-[#EF4444]' : 'border-l-[#F59E0B]'}`}>
          {/* Icon */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isBanned ? 'bg-[#EF4444]/20' : 'bg-[#F59E0B]/20'}`}>
            {isBanned
              ? <Lock className="w-8 h-8 text-[#EF4444]" />
              : <AlertCircle className="w-8 h-8 text-[#F59E0B]" />
            }
          </div>

          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-2">
            {isBanned ? 'Account Permanently Banned' : 'Account Suspended'}
          </h1>

          <p className="text-xs text-[#6B7A94] mb-4 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            Content Connect X — Professional Creator Collaboration Platform
          </p>

          <p className="text-[#9AA6BC] mb-6 text-sm">
            {isBanned
              ? 'Your account has been permanently banned from this platform due to a serious violation of our Terms of Service. This action is final. Account data may be retained for compliance and legal purposes.'
              : 'Your account has been temporarily suspended. During this period you cannot access platform features.'}
          </p>

          {/* Reason */}
          {suspensionReason && (
            <div className={`border rounded-lg p-4 mb-4 text-left ${isBanned ? 'bg-[#EF4444]/10 border-[#EF4444]/30' : 'bg-[#F59E0B]/10 border-[#F59E0B]/30'}`}>
              <p className={`text-xs font-semibold mb-2 ${isBanned ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>Reason provided:</p>
              <p className="text-sm text-[#E8EEF9]">{suspensionReason}</p>
            </div>
          )}

          {/* Suspension end date */}
          {isSuspended && suspensionEndAt && (
            <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-3 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />
              <p className="text-sm text-[#E8EEF9]">
                Suspension lifts: <strong>{format(new Date(suspensionEndAt), 'MMMM d, yyyy')}</strong>
              </p>
            </div>
          )}

          {/* Suspension — what it means */}
          {isSuspended && (
            <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#E8EEF9] font-semibold mb-2">During your suspension:</p>
              <ul className="text-xs text-[#9AA6BC] space-y-1.5">
                <li>• Your profile is hidden from other members</li>
                <li>• You cannot send or receive messages</li>
                <li>• You cannot create or participate in collaborations</li>
                <li>• Your account data is preserved</li>
                {!suspensionEndAt && <li>• Contact support to request a review</li>}
              </ul>
            </div>
          )}

          {/* Contact / dispute */}
          <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-[#E8EEF9] font-semibold mb-2">
              {isBanned ? 'Believe this was a mistake?' : 'Have a question about your suspension?'}
            </p>
            <p className="text-xs text-[#9AA6BC]">
              {isBanned
                ? 'If you believe this ban was made in error, you may submit a reinstatement dispute below. Note: bans for serious violations (trafficking, underage activity, solicitation) are not subject to appeal.'
                : `Contact support at `}
              {isSuspended && (
                <a href="mailto:support@contentconnectx.com" className="text-[#4F8CFF] hover:underline">
                  support@contentconnectx.com
                </a>
              )}
            </p>
          </div>

          <div className="space-y-3">
            {isBanned && (
              <CCButton
                variant="outline"
                fullWidth
                icon={FileText}
                onClick={() => setShowDisputeModal(true)}
              >
                Submit Reinstatement Dispute
              </CCButton>
            )}
            <CCButton
              variant={isBanned ? 'danger' : 'outline'}
              fullWidth
              icon={LogOut}
              onClick={handleLogout}
            >
              Log Out
            </CCButton>
          </div>
        </CCCard>
      </motion.div>

      {/* Dispute modal */}
      <CCModal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Submit Reinstatement Dispute"
        description="Explain why you believe your ban was made in error. An admin will review your request."
      >
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-[#22C55E]/20 flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-[#22C55E]" />
            </div>
            <p className="text-[#E8EEF9] font-semibold mb-2">Dispute Submitted</p>
            <p className="text-sm text-[#9AA6BC]">Our safety team will review your request. You'll be notified of the outcome at the email associated with your account.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-xs text-[#EF4444]">
              Bans for trafficking, underage activity, non-consensual content, or solicitation are permanent and not subject to reinstatement.
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Your Statement *</label>
              <textarea
                value={disputeStatement}
                onChange={(e) => setDisputeStatement(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[120px] text-sm"
                placeholder="Explain your situation clearly. What happened? Why do you believe this ban was an error?"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <CCButton variant="outline" onClick={() => setShowDisputeModal(false)}>Cancel</CCButton>
              <CCButton
                variant="primary"
                onClick={handleSubmitDispute}
                loading={submitting}
                disabled={!disputeStatement.trim()}
              >
                Submit Dispute
              </CCButton>
            </div>
          </div>
        )}
      </CCModal>
    </div>
  );
}