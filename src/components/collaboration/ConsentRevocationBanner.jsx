import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Shield, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import CCBadge from '@/components/ui-custom/CCBadge';

export default function ConsentRevocationBanner({ collaborationId }) {
  const { data: revocations = [] } = useQuery({
    queryKey: ['consentRevocations', collaborationId],
    queryFn: () => base44.entities.ConsentRevocation.filter({ 
      collaboration_id: collaborationId,
      status: 'active'
    }),
    enabled: !!collaborationId,
  });

  const activeRevocation = revocations[0];

  if (!activeRevocation) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-4 mb-6"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-[#EF4444]/20">
          <Lock className="w-5 h-5 text-[#EF4444]" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-[#E8EEF9]">Consent Revoked - Collaboration Paused</h4>
                <CCBadge variant="danger" size="sm">Active</CCBadge>
              </div>
              <p className="text-sm text-[#9AA6BC] mb-2">
                A participant has revoked consent. This collaboration is now paused and under admin review.
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-[#9AA6BC]">
                <div>
                  Revoked: <span className="text-[#E8EEF9]">{format(new Date(activeRevocation.revoked_at), 'PPp')}</span>
                </div>
                <div>
                  Scope: <span className="text-[#E8EEF9] capitalize">{activeRevocation.scope.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
            <Shield className="w-5 h-5 text-[#EF4444]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}