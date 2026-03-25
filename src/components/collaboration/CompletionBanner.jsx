import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';

export default function CompletionBanner({ collaboration, userEmail }) {
  // Show banner when signed/active but not yet completed
  const showBanner = ['signed', 'active', 'agreed'].includes(collaboration?.status);

  if (!showBanner || !collaboration?.participant_ids?.includes(userEmail)) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <CCCard padding="md" className="bg-gradient-to-r from-[#22C55E]/10 to-[#22C55E]/5 border border-[#22C55E]/30">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#22C55E] text-sm">Contract Signed</h3>
            <p className="text-xs text-[#9AA6BC] mt-1">
              Great! Your contract is signed. When you're ready, mark this collaboration as complete to finalize terms and trigger earnings generation for all participants.
            </p>
            <p className="text-xs text-[#6B7A94] mt-2 italic">
              Earnings will be automatically calculated and distributed when completion is confirmed.
            </p>
          </div>
        </div>
      </CCCard>
    </motion.div>
  );
}