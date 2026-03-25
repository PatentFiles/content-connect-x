import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, LogOut, Lock, Shield } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { base44 } from '@/api/base44Client';

export default function AccountBlockedScreen({ blockReason, suspensionReason }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.removeItem('auth_token');
    }
  }, []);

  const isBanned = blockReason === 'banned';

  const handleLogout = async () => {
    await base44.auth.logout();
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

          {/* Title */}
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-2">
            {isBanned ? 'Account Permanently Banned' : 'Account Under Review'}
          </h1>

          {/* Platform statement */}
          <p className="text-xs text-[#6B7A94] mb-4 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            Content Connect — Professional Creator Collaboration Platform
          </p>

          <p className="text-[#9AA6BC] mb-6 text-sm">
            {isBanned
              ? 'Your account has been permanently banned from this platform due to a serious violation of our Terms of Service. This action is final. Account data may be retained for compliance and legal purposes.'
              : 'Your account has been temporarily suspended pending a safety or compliance review. During this period you cannot access platform features.'}
          </p>

          {/* Reason */}
          {suspensionReason && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#EF4444] font-semibold mb-2">Reason provided:</p>
              <p className="text-sm text-[#E8EEF9]">{suspensionReason}</p>
            </div>
          )}

          {/* What happens next */}
          {!isBanned && (
            <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#E8EEF9] font-semibold mb-2">What this means:</p>
              <ul className="text-xs text-[#9AA6BC] space-y-1.5">
                <li>• Your profile is hidden from other members</li>
                <li>• You cannot send or receive messages</li>
                <li>• You cannot create or participate in collaborations</li>
                <li>• Your account data is preserved during review</li>
                <li>• Our safety team is reviewing your account</li>
              </ul>
            </div>
          )}

          {/* Contact */}
          <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-[#E8EEF9] font-semibold mb-2">
              {isBanned ? 'Believe this was an error?' : 'Have a question about this review?'}
            </p>
            <p className="text-xs text-[#9AA6BC]">
              Contact our support team at{' '}
              <a href="mailto:support@contentconnect.com" className="text-[#4F8CFF] hover:underline">
                support@contentconnect.com
              </a>
              {'. '}
              {isBanned
                ? 'Please include your account email. Note that bans for serious policy violations (trafficking, underage activity, solicitation) are not subject to appeal.'
                : 'Please include your account email and any relevant context. We aim to complete reviews within 48 hours.'}
            </p>
          </div>

          <CCButton
            variant={isBanned ? 'danger' : 'outline'}
            fullWidth
            icon={LogOut}
            onClick={handleLogout}
          >
            Log Out
          </CCButton>
        </CCCard>
      </motion.div>
    </div>
  );
}