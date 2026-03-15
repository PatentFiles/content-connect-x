import React from 'react';
import { Check } from 'lucide-react';

export const PROFILE_THEMES = {
  default:  { bg: 'linear-gradient(135deg, #4F8CFF, #7B5FA9, #FF2DAA)', label: 'Default' },
  midnight: { bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', label: 'Midnight' },
  sunset:   { bg: 'linear-gradient(135deg, #f97316, #ef4444, #ec4899)', label: 'Sunset' },
  ocean:    { bg: 'linear-gradient(135deg, #06b6d4, #0284c7, #4f46e5)', label: 'Ocean' },
  forest:   { bg: 'linear-gradient(135deg, #134e4a, #166534, #4ade80)', label: 'Forest' },
  neon:     { bg: 'linear-gradient(135deg, #a855f7, #ec4899, #f43f5e)', label: 'Neon' },
  gold:     { bg: 'linear-gradient(135deg, #78350f, #d97706, #fbbf24)', label: 'Gold' },
  arctic:   { bg: 'linear-gradient(135deg, #1e3a5f, #7dd3fc, #e0f2fe)', label: 'Arctic' },
};

export default function ProfileThemeSelector({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#E8EEF9] mb-3">Banner Theme</label>
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(PROFILE_THEMES).map(([key, theme]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="relative rounded-lg overflow-hidden border-2 transition-all"
            style={{
              aspectRatio: '16/7',
              borderColor: value === key ? '#4F8CFF' : 'transparent',
              background: theme.bg,
            }}
          >
            {value === key && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Check className="w-4 h-4 text-white drop-shadow" />
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 text-xs text-white text-center py-0.5 bg-black/40 leading-tight">
              {theme.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}