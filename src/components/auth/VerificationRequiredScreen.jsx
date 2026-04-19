import React from 'react';
import { Shield, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { initiateVerification } from '@/lib/verificationProvider';

export default function VerificationRequiredScreen() {
  const [loading, setLoading] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const handleVerifyNow = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      await initiateVerification(user.email, user.email);
    } catch (error) {
      console.error('Verification initiation failed:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <CCCard padding="xl" className="text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-[#4F8CFF]" />
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-3">Age Verification Required</h1>
          <p className="text-[#9AA6BC] mb-8">
            To protect our community, all members must verify they are 18+ before using this platform.
          </p>

          {/* Information Box */}
          <div className="bg-[#121824] rounded-xl p-4 mb-8 text-left">
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-[#E8EEF9]">
                <div className="w-5 h-5 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#4F8CFF]" />
                </div>
                <span>Verify your age with a government-issued ID</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#E8EEF9]">
                <div className="w-5 h-5 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#4F8CFF]" />
                </div>
                <span>Takes less than 5 minutes</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#E8EEF9]">
                <div className="w-5 h-5 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#4F8CFF]" />
                </div>
                <span>Your data is secure and never shared</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <CCButton
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onClick={handleVerifyNow}
            className="mb-3"
          >
            Verify Now
          </CCButton>

          {/* Logout */}
          <CCButton
            variant="outline"
            size="lg"
            fullWidth
            onClick={handleLogout}
            icon={LogOut}
          >
            Logout
          </CCButton>

          {/* Help text */}
          <p className="mt-6 text-xs text-[#6B7A94]">
            Questions? Contact support@platform.com
          </p>
        </CCCard>
      </motion.div>
    </div>
  );
}