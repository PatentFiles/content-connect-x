/**
 * ProHostSubscriptionPanel — Shown in HostDashboard when pro_host_enabled=true.
 * Displays Pro Host benefits, current subscription status, and subscribe CTA.
 * Status stored on UserProfile.pro_host (boolean) and pro_host_since (date).
 * Admin can manually grant/revoke Pro status from the HostingPricingPanel.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Zap, TrendingUp, Shield, DollarSign } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { useFeatureFlags, useFeatureFlag } from '@/lib/featureFlags';
import { resolvePricingConfig } from '@/lib/hostingPricing';
import { toast } from 'sonner';

const BENEFITS = [
  { icon: DollarSign, label: 'Reduced booking fee', detail: 'Pro hosts pay a lower platform take rate' },
  { icon: Zap,        label: 'Faster payouts',       detail: 'Reduced payout delay after session completion' },
  { icon: Shield,     label: 'Lower reserve %',       detail: 'Smaller portion of payout held in reserve' },
  { icon: TrendingUp, label: 'Ranking boost',         detail: 'Higher weighting in search and discovery' },
  { icon: Star,       label: 'Verified Pro badge',    detail: 'Displayed on your listing and profile' },
];

export default function ProHostSubscriptionPanel({ user }) {
  const proHostEnabled = useFeatureFlag('pro_host_enabled');
  const flags = useFeatureFlags();
  const pricingConfig = resolvePricingConfig(flags);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const profile = profiles[0];
  const isProHost = !!profile?.pro_host;

  if (!proHostEnabled) return null;

  const handleSubscribe = async () => {
    // In a real payment flow this would open a Stripe checkout.
    // For now we persist the Pro status flag directly (admin can also set this).
    if (!profile?.id) return;
    setLoading(true);
    try {
      await base44.entities.UserProfile.update(profile.id, {
        pro_host: true,
        pro_host_since: new Date().toISOString(),
      });
      queryClient.invalidateQueries(['myProfile']);
      toast.success('Pro Host activated!');
    } catch {
      toast.error('Could not activate Pro Host. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await base44.entities.UserProfile.update(profile.id, { pro_host: false });
      queryClient.invalidateQueries(['myProfile']);
      toast.success('Pro Host subscription cancelled.');
    } catch {
      toast.error('Could not cancel. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CCCard padding="lg" className="border-[#F59E0B]/30 bg-[#F59E0B]/5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
            <Star className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#E8EEF9] flex items-center gap-2">
              Pro Host
              {isProHost && <CCBadge variant="warning" size="sm">Active</CCBadge>}
            </h3>
            <p className="text-xs text-[#9AA6BC]">
              ${pricingConfig.proHostSubPrice}/month · Cancel anytime
            </p>
          </div>
        </div>
        {isProHost ? (
          <CCButton variant="outline" size="sm" onClick={handleCancel} loading={loading}>
            Cancel
          </CCButton>
        ) : (
          <CCButton variant="warning" size="sm" onClick={handleSubscribe} loading={loading}>
            Subscribe
          </CCButton>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {BENEFITS.map((b, i) => {
          const Icon = b.icon;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isProHost ? 'bg-[#F59E0B]/20' : 'bg-[#263248]'
              }`}>
                <Icon className={`w-3.5 h-3.5 ${isProHost ? 'text-[#F59E0B]' : 'text-[#6B7A94]'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${isProHost ? 'text-[#E8EEF9]' : 'text-[#9AA6BC]'}`}>
                  {b.label}
                </p>
                <p className="text-xs text-[#6B7A94]">{b.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rate comparison */}
      <div className="mt-4 pt-4 border-t border-[#263248]/50 grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[#0B0F14] rounded-lg p-3">
          <p className="text-xs text-[#6B7A94] mb-1">Standard booking fee</p>
          <p className="text-lg font-bold text-[#9AA6BC]">{flags.hosting_booking_fee_pct ?? 20}%</p>
        </div>
        <div className="bg-[#F59E0B]/10 rounded-lg p-3 border border-[#F59E0B]/20">
          <p className="text-xs text-[#F59E0B] mb-1">Pro Host booking fee</p>
          <p className="text-lg font-bold text-[#F59E0B]">{pricingConfig.proHostBookingFeePct}%</p>
        </div>
      </div>
    </CCCard>
  );
}