import React from 'react';
import { CheckCircle, Circle, Building2 } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';

const STEPS = [
  { key: 'photos_uploaded', label: 'Upload property photos', hint: 'At least 3 photos recommended' },
  { key: 'pricing_set', label: 'Set your pricing', hint: 'Hourly or day rates' },
  { key: 'rules_set', label: 'Define house rules', hint: 'Smoking, guests, vendors' },
  { key: 'address_verified', label: 'Add exact address', hint: 'Private — shown after booking' },
  { key: 'agreement_accepted', label: 'Accept host agreement', hint: 'Platform hosting terms' },
];

export default function HostOnboardingChecklist({ properties }) {
  // Aggregate checklist from first property (or show fresh state)
  const checklist = properties?.[0]?.onboarding_checklist || {};
  const completed = STEPS.filter(s => checklist[s.key]).length;
  const pct = Math.round((completed / STEPS.length) * 100);

  return (
    <CCCard padding="lg">
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="w-5 h-5 text-[#4F8CFF]" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#E8EEF9]">Host Setup Checklist</h3>
          <p className="text-xs text-[#9AA6BC]">{completed} of {STEPS.length} complete</p>
        </div>
        <span className="text-lg font-bold text-[#4F8CFF]">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#263248] rounded-full h-1.5 mb-4">
        <div
          className="bg-[#4F8CFF] h-1.5 rounded-full transition-all duration-500"
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
    </CCCard>
  );
}