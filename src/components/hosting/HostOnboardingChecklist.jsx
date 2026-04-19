import React from 'react';
import { CheckCircle, Circle, Building2, Unlock } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import { canCreateProperty } from '@/lib/hostReadiness';

const STEPS = [
  { key: 'photos_uploaded', label: 'Upload property photos', hint: 'At least 3 photos recommended' },
  { key: 'pricing_set', label: 'Set your pricing', hint: 'Hourly or day rates' },
  { key: 'rules_set', label: 'Define house rules', hint: 'Smoking, guests, vendors' },
  { key: 'address_verified', label: 'Add exact address', hint: 'Private — shown after booking' },
  { key: 'agreement_accepted', label: 'Accept host agreement', hint: 'Platform hosting terms' },
];

export default function HostOnboardingChecklist({ properties, profile, onAddProperty }) {
  // Aggregate checklist from first property (or show fresh state)
  const checklist = properties?.[0]?.onboarding_checklist || {};
  const completed = STEPS.filter(s => checklist[s.key]).length;
  const pct = Math.round((completed / STEPS.length) * 100);
  const allDone = completed === STEPS.length;
  const hostReady = canCreateProperty(profile);

  return (
    <CCCard padding="lg" className={allDone && hostReady ? 'border-[#22C55E]/40' : ''}>
      <div className="flex items-center gap-3 mb-4">
        {allDone && hostReady ? (
          <Unlock className="w-5 h-5 text-[#22C55E]" />
        ) : (
          <Building2 className="w-5 h-5 text-[#4F8CFF]" />
        )}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#E8EEF9]">Host Setup Checklist</h3>
          <p className="text-xs text-[#9AA6BC]">{completed} of {STEPS.length} complete</p>
        </div>
        <span className={`text-lg font-bold ${allDone ? 'text-[#22C55E]' : 'text-[#4F8CFF]'}`}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#263248] rounded-full h-1.5 mb-4">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${allDone ? 'bg-[#22C55E]' : 'bg-[#4F8CFF]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-3">
        {STEPS.map(step => {
          const done = !!checklist[step.key];
          return (
            <div key={step.key} className="flex items-start gap-3">
              {done
                ? <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                : <Circle className="w-4 h-4 text-[#263248] flex-shrink-0 mt-0.5" />
              }
              <div>
                <p className={`text-sm ${done ? 'line-through text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>{step.label}</p>
                {!done && <p className="text-xs text-[#6B7A94]">{step.hint}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unlock CTA — shown when setup is complete */}
      {allDone && hostReady && onAddProperty && (
        <div className="mt-4 pt-4 border-t border-[#22C55E]/20">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30">
            <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#22C55E]">Setup complete — you're ready to list!</p>
              <p className="text-xs text-[#9AA6BC] mt-0.5">Property creation is now unlocked.</p>
            </div>
            <button
              onClick={onAddProperty}
              className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#1EA550] text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Add Property
            </button>
          </div>
        </div>
      )}
    </CCCard>
  );
}