import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, XCircle } from 'lucide-react';
import { violationTypeLabel } from '@/lib/commFilter';

/**
 * CommFilterWarning — reusable inline warning shown inside the message input area.
 *
 * Props:
 *   violation  — { type } object returned by detectCommViolation, or null
 *   level      — 'warn' | 'restrict' | 'flag_admin'
 *   onDismiss  — called when user edits their message (clear the warning)
 */
export default function CommFilterWarning({ violation, level, onDismiss }) {
  if (!violation) return null;

  const isRestrict = level === 'restrict';
  const isFlagAdmin = level === 'flag_admin';

  const bgColor = isFlagAdmin
    ? 'bg-[#EF4444]/10 border-[#EF4444]/40'
    : isRestrict
    ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40'
    : 'bg-[#F59E0B]/10 border-[#F59E0B]/30';

  const textColor = isFlagAdmin ? 'text-[#EF4444]' : 'text-[#F59E0B]';
  const Icon = isFlagAdmin ? XCircle : isRestrict ? ShieldAlert : AlertTriangle;

  const label = violationTypeLabel(violation.type);

  const headline = isFlagAdmin
    ? 'Repeated violations detected'
    : isRestrict
    ? 'Off-platform sharing not allowed'
    : 'Off-platform sharing not allowed';

  const detail = isFlagAdmin
    ? `Multiple attempts to share ${label} have been detected and flagged for admin review. Further attempts may result in communication restrictions.`
    : isRestrict
    ? `Sharing ${label} in messages is not permitted on this platform. Your account has been noted. Continued attempts will be escalated.`
    : `Sharing ${label} in messages is not permitted. All collaboration communication must happen within this platform.`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 mb-2 ${bgColor}`}
      >
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${textColor}`} />
        <div>
          <p className={`text-xs font-semibold ${textColor}`}>{headline}</p>
          <p className="text-xs text-[#9AA6BC] mt-0.5 leading-relaxed">{detail}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}