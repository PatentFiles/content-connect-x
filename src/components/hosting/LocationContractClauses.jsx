/**
 * LocationContractClauses
 * Generates and displays the location-specific contract clauses derived from
 * a Property record. Used in SoloSessionBookingModal and PropertyDetail
 * to surface the legal/contractual context before agreement acceptance.
 * Does NOT create a new contract engine — feeds into existing ContractTemplate token system.
 */
import React, { useMemo } from 'react';
import { Shield, AlertTriangle, Camera, MapPin, Trash2, Wrench, DollarSign, Navigation } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

function ClauseSection({ icon: IconComp, title, children, color = 'text-[#9AA6BC]' }) {
  const Icon = IconComp;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E8EEF9]">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        {title}
      </div>
      <div className="text-xs text-[#9AA6BC] pl-5 space-y-0.5">{children}</div>
    </div>
  );
}

export function buildLocationClauses(property, cancellationPolicy) {
  const rules = property?.rules || {};
  const access = property?.access_settings || {};
  const deposit = property?.damage_deposit || {};
  const clauses = [];

  // Property rules snapshot
  const ruleLines = [];
  if (rules.no_smoking) ruleLines.push('No smoking on premises');
  if (rules.no_alcohol) ruleLines.push('No alcohol on premises');
  if (!rules.music_allowed) ruleLines.push('No music / sound restrictions apply');
  if (rules.no_overnight) ruleLines.push('No overnight use');
  if (!rules.furniture_movement_allowed) ruleLines.push('Do not move furniture');
  if (rules.cleanup_required) ruleLines.push('Space must be left in original condition');
  if (rules.no_outside_filming_equipment) ruleLines.push('No outside filming equipment — use house equipment only');
  if (rules.no_window_visibility) ruleLines.push('No filming near windows — public visibility prohibited');
  if (rules.security_cameras_present) ruleLines.push(`Security cameras present${rules.security_camera_notes ? ': ' + rules.security_camera_notes : ''}`);
  if (rules.max_people) ruleLines.push(`Maximum ${rules.max_people} people on site at any time`);
  if (rules.custom_rules) ruleLines.push(rules.custom_rules);
  if (ruleLines.length) clauses.push({ type: 'property_rules', lines: ruleLines });

  // Access rules
  const accessLines = [];
  if (access.gps_checkin_required) accessLines.push('GPS check-in is required at booking start');
  if (access.checkout_evidence_required) accessLines.push('Photo/video checkout evidence must be submitted');
  if (access.smart_lock_enabled) accessLines.push('Property uses an automated smart lock — access code is time-limited');
  if (accessLines.length) clauses.push({ type: 'access_rules', lines: accessLines });

  // Damage deposit
  if (deposit.enabled && deposit.amount) {
    clauses.push({
      type: 'damage_deposit',
      lines: [
        `A damage deposit of $${deposit.amount} is required.`,
        `Deposit will be refunded within ${deposit.refund_window_days || 7} days of checkout if no damage is reported.`,
        deposit.policy_notes || '',
      ].filter(Boolean),
    });
  }

  // Cancellation policy
  if (cancellationPolicy) {
    const gc = cancellationPolicy.guest_cancellation || {};
    const lines = [`Policy: ${cancellationPolicy.preset} — ${cancellationPolicy.label || ''}`];
    if (gc.full_refund_hours_before) lines.push(`Full refund if cancelled ${gc.full_refund_hours_before}+ hours before start`);
    if (gc.partial_refund_pct) lines.push(`${gc.partial_refund_pct}% refund if cancelled ${gc.no_refund_hours_before}–${gc.full_refund_hours_before} hours before`);
    lines.push(`No refund within ${gc.no_refund_hours_before || 0} hours of start`);
    if (gc.cleaning_fee_refundable === false) lines.push('Cleaning fee is non-refundable');
    clauses.push({ type: 'cancellation', lines });
  }

  // Liability
  clauses.push({
    type: 'liability',
    lines: [
      'Guest assumes all risk of injury, property damage, or loss during the booking period.',
      'Guest indemnifies and holds the host harmless from all claims arising from guest\'s use of the property.',
      'Guest is responsible for the conduct of all persons admitted under their booking.',
    ],
  });

  return clauses;
}

const CLAUSE_META = {
  property_rules: { icon: Shield, title: 'Property Rules', color: 'text-[#4F8CFF]' },
  access_rules: { icon: Navigation, title: 'Access & Entry Rules', color: 'text-[#22C55E]' },
  damage_deposit: { icon: DollarSign, title: 'Damage Deposit Terms', color: 'text-[#F59E0B]' },
  cancellation: { icon: AlertTriangle, title: 'Cancellation Policy', color: 'text-[#EF4444]' },
  liability: { icon: AlertTriangle, title: 'Liability & Assumption of Risk', color: 'text-[#FF2DAA]' },
};

export default function LocationContractClauses({ property, cancellationPolicy, compact = false }) {
  const clauses = useMemo(() => buildLocationClauses(property, cancellationPolicy), [property, cancellationPolicy]);

  if (!clauses.length) return null;

  return (
    <div className="bg-[#0B0F14] rounded-lg p-4 border border-[#263248] space-y-3">
      <p className="text-xs font-semibold text-[#E8EEF9]">Location Agreement Clauses</p>
      {clauses.map((clause, i) => {
        const meta = CLAUSE_META[clause.type] || { icon: Shield, title: clause.type, color: 'text-[#9AA6BC]' };
        return (
          <ClauseSection key={i} icon={meta.icon} title={meta.title} color={meta.color}>
            {clause.lines.map((line, j) => line && <p key={j}>• {line}</p>)}
          </ClauseSection>
        );
      })}
    </div>
  );
}