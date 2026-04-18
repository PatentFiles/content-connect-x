/**
 * HostPricingSettings — Shown in HostDashboard.
 * Displays the host's current reserve %, payout delay, and Pro Host status.
 * Read-only for hosts — admins can override per-property via PropertyRiskPanel.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, Shield, Star, DollarSign } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { useFeatureFlags, useFeatureFlag } from '@/lib/featureFlags';
import { resolvePricingConfig } from '@/lib/hostingPricing';

export default function HostPricingSettings({ user }) {
  const pricingEnabled = useFeatureFlag('hosting_pricing_enabled');
  const proHostEnabled = useFeatureFlag('pro_host_enabled');
  const reserveEnabled = useFeatureFlag('reserve_system_enabled');
  const payoutEnabled  = useFeatureFlag('dynamic_payout_enabled');
  const flags = useFeatureFlags();
  const pricingConfig = resolvePricingConfig(flags);

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const profile = profiles[0];
  const isProHost = proHostEnabled && !!profile?.pro_host;

  if (!pricingEnabled) return null;

  const effectiveFeePct    = isProHost ? pricingConfig.proHostBookingFeePct : pricingConfig.bookingFeePct;
  const effectiveReservePct = isProHost ? pricingConfig.reservePctProHost : pricingConfig.reservePctDefault;
  const effectivePayoutHrs  = isProHost ? pricingConfig.payoutDelayProHost : pricingConfig.payoutDelayDefault;

  return (
    <CCCard padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-[#4F8CFF]" />
        <h3 className="text-sm font-semibold text-[#E8EEF9]">Your Payout Settings</h3>
        {isProHost && <CCBadge variant="warning" size="sm" icon={Star}>Pro Host</CCBadge>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-[#0B0F14] rounded-lg p-3">
          <p className="text-xs text-[#6B7A94] mb-1">Booking fee</p>
          <p className="text-xl font-bold text-[#E8EEF9]">{effectiveFeePct}%</p>
          <p className="text-xs text-[#6B7A94]">platform take</p>
        </div>
        {reserveEnabled && (
          <div className="bg-[#0B0F14] rounded-lg p-3">
            <Shield className="w-4 h-4 text-[#9AA6BC] mx-auto mb-1" />
            <p className="text-xl font-bold text-[#E8EEF9]">{effectiveReservePct}%</p>
            <p className="text-xs text-[#6B7A94]">reserve held</p>
          </div>
        )}
        {payoutEnabled && (
          <div className="bg-[#0B0F14] rounded-lg p-3">
            <Clock className="w-4 h-4 text-[#9AA6BC] mx-auto mb-1" />
            <p className="text-xl font-bold text-[#E8EEF9]">{effectivePayoutHrs}h</p>
            <p className="text-xs text-[#6B7A94]">payout delay</p>
          </div>
        )}
      </div>
      <p className="text-xs text-[#6B7A94] mt-3">
        Fee rates are set by the platform and may vary. Contact support for questions.
      </p>
    </CCCard>
  );
}