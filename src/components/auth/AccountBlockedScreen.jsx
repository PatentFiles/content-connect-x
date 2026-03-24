import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, LogOut, Lock } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { base44 } from '@/api/base44Client';

export default function AccountBlockedScreen({ blockReason, suspensionReason }) {
  useEffect(() => {
    // Clear any stored tokens to prevent re-authentication attempts
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] to-[#151D2B] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <CCCard padding="xl" className="text-center border-l-4 border-l-[#EF4444]">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-[#EF4444]/20 flex items-center justify-center mx-auto mb-6">
            {isBanned ? (
              <Lock className="w-8 h-8 text-[#EF4444]" />
            ) : (
              <AlertCircle className="w-8 h-8 text-[#F59E0B]" />
            )}
          </div>

          {/* Title & Message */}
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-2">
            {isBanned ? 'Account Permanently Blocked' : 'Account Suspended'}
          </h1>

          <p className="text-[#9AA6BC] mb-6 text-sm">
            {isBanned
              ? 'Your account has been permanently banned from this platform. This decision is final.'
              : 'Your account has been temporarily suspended.'}
          </p>

          {/* Reason */}
          {suspensionReason && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#EF4444] font-semibold mb-2">Reason:</p>
              <p className="text-sm text-[#E8EEF9]">{suspensionReason}</p>
            </div>
          )}

          {/* Info */}
          {!isBanned && (
            <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#6B7A94] mb-2">
                <strong>What happens next?</strong>
              </p>
              <ul className="text-xs text-[#9AA6BC] space-y-1">
                <li>• Your profile is hidden from other users</li>
                <li>• You cannot send or receive messages</li>
                <li>• You cannot create or join collaborations</li>
                <li>• Contact support if you believe this is a mistake</li>
              </ul>
            </div>
          )}

          {isBanned && (
            <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4 mb-6 text-left">
              <p className="text-xs text-[#6B7A94] mb-2">
                <strong>Need help?</strong>
              </p>
              <p className="text-xs text-[#9AA6BC]">
                If you believe this action was taken in error, contact our support team at{' '}
                <a href="mailto:support@contentconnect.com" className="text-[#4F8CFF] hover:underline">
                  support@contentconnect.com
                </a>
              </p>
            </div>
          )}

          {/* Logout Button */}
          <CCButton
            variant="danger"
            fullWidth
            icon={LogOut}
            onClick={handleLogout}
            className="mt-6"
          >
            Log Out
          </CCButton>
        </CCCard>
      </motion.div>
    </div>
  );
}