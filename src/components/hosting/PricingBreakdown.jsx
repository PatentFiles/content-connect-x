/**
 * PricingBreakdown — Guest-facing pricing summary for a property booking.
 * Shows line items, platform fee disclosure, and final total.
 * Reads pricing config from feature flags so all values are admin-controlled.
 */
import React from 'react';
import { DollarSign, Info, Star } from 'lucide-react';
import CCBadge from '@/components/ui-custom/CCBadge';
import { useFeatureFlags } from '@/lib/featureFlags';
import { resolvePricingConfig } from '@/lib/hostingPricing';

export default function PricingBreakdown({ snapshot, isProHost = false, compact = false }) {
  const flags = useFeatureFlags();
  const pricingConfig = resolvePricingConfig(flags);

  if (!snapshot) return null;

  const {
    base_property_cost,
    equipment_total,
    bundle_modifier,
    cleaning_fee,
    subtotal,
    platform_fee_pct,
    platform_fee_amount,
    host_payout,
    reserve_pct,
    payout_delay_hours,
    grand_total,
    currency = 'USD',
  } = snapshot;

  const fmt = (n) => `$${(n || 0).toFixed(2)}`;
  const symbol = currency === 'USD' ? '$' : currency;

  if (compact) {
    return (
      <div className="bg-[#0B0F14] rounded-lg p-3 border border-[#263248] text-xs text-[#9AA6BC] space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="text-[#E8EEF9] font-medium">{fmt(subtotal)}</span>
        </div>
        {platform_fee_pct > 0 && (
          <div className="flex justify-between text-[#6B7A94]">
            <span className="flex items-center gap-1">
              Platform fee ({platform_fee_pct}%)
              {isProHost && <CCBadge variant="warning" size="sm" className="ml-1">Pro</CCBadge>}
            </span>
            <span>-{fmt(platform_fee_amount)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-[#E8EEF9] pt-1 border-t border-[#263248]">
          <span>Host receives</span>
          <span>{fmt(host_payout)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B0F14] rounded-xl border border-[#263248] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#263248]">
        <DollarSign className="w-4 h-4 text-[#4F8CFF]" />
        <span className="text-sm font-semibold text-[#E8EEF9]">Pricing Breakdown</span>
        {isProHost && (
          <CCBadge variant="warning" size="sm" icon={Star}>Pro Host Rate</CCBadge>
        )}
      </div>
      <div className="p-4 space-y-2 text-sm">
        {base_property_cost > 0 && (
          <Row label="Space rental" value={fmt(base_property_cost)} />
        )}
        {equipment_total > 0 && (
          <Row label="Equipment add-ons" value={fmt(equipment_total)} />
        )}
        {bundle_modifier !== 0 && (
          <Row label="Bundle modifier" value={bundle_modifier > 0 ? `+${fmt(bundle_modifier)}` : fmt(bundle_modifier)} />
        )}
        {cleaning_fee > 0 && (
          <Row label="Cleaning fee" value={fmt(cleaning_fee)} />
        )}

        <div className="border-t border-[#263248] pt-2 mt-2">
          <Row label="Subtotal" value={fmt(subtotal)} bold />
        </div>

        {platform_fee_pct > 0 && (
          <div className="flex items-center justify-between text-[#6B7A94]">
            <span className="flex items-center gap-1">
              Platform fee ({platform_fee_pct}%)
              <span className="text-[#6B7A94]" title="The platform fee is deducted from the host's payout, not added to the guest price.">
                <Info className="w-3 h-3" />
              </span>
            </span>
            <span className="text-[#EF4444]">-{fmt(platform_fee_amount)}</span>
          </div>
        )}

        <div className="border-t border-[#263248] pt-2">
          <Row label={`Guest pays`} value={fmt(grand_total)} bold accent />
        </div>

        {reserve_pct > 0 && (
          <p className="text-xs text-[#6B7A94] pt-1">
            {reserve_pct}% reserve held · Payout after {payout_delay_hours}h
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className={accent ? 'text-[#E8EEF9]' : bold ? 'text-[#E8EEF9]' : 'text-[#9AA6BC]'}>{label}</span>
      <span className={accent ? 'text-[#4F8CFF] text-base' : bold ? 'text-[#E8EEF9]' : 'text-[#9AA6BC]'}>{value}</span>
    </div>
  );
}