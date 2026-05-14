import React from 'react';
import { Eye, Shield, User, Briefcase, Building2, Camera, Video, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeatureFlag } from '@/lib/featureFlags';
import CCBadge from '../ui-custom/CCBadge';

const roleOptions = [
  { value: 'admin', label: 'Admin', icon: Shield, color: 'bg-[#EF4444]/20 text-[#EF4444]' },
  { value: 'creator', label: 'Creator', icon: User, color: 'bg-[#4F8CFF]/20 text-[#4F8CFF]' },
  { value: 'agent', label: 'Agent', icon: Briefcase, color: 'bg-[#FF2DAA]/20 text-[#FF2DAA]' },
  { value: 'studio', label: 'Studio', icon: Building2, color: 'bg-[#22C55E]/20 text-[#22C55E]' },
  { value: 'photographer', label: 'Photographer', icon: Camera, color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
  { value: 'videographer', label: 'Videographer', icon: Video, color: 'bg-[#A855F7]/20 text-[#A855F7]' },
  { value: 'video_editor', label: 'Video Editor', icon: Video, color: 'bg-[#EC4899]/20 text-[#EC4899]' },
  { value: 'host', label: 'Host', icon: Home, color: 'bg-[#06B6D4]/20 text-[#06B6D4]' },
];

export default function AdminRoleViewSwitcher({ currentView, onViewChange }) {
  const hostingEnabled = useFeatureFlag('hosting_marketplace');
  const visibleRoles = hostingEnabled ? roleOptions : roleOptions.filter(r => r.value !== 'host');
  return (
    <div className="p-4 border-b" style={{ borderColor: 'var(--cc-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4" style={{ color: 'var(--cc-text-muted)' }} />
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--cc-text-muted)' }}>View As</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {visibleRoles.map((role) => {
          const isActive = currentView === role.value;
          const Icon = role.icon;
          
          return (
            <button
              key={role.value}
              onClick={() => onViewChange(role.value)}
              className={cn(
                'flex items-center justify-center px-3 py-2 rounded-lg transition-all duration-200',
                'border text-center',
              )}
              style={{
                backgroundColor: isActive ? 'rgba(79,140,255,0.12)' : 'var(--cc-surface)',
                borderColor: isActive ? 'var(--cc-blue)' : 'var(--cc-border)',
                color: isActive ? 'var(--cc-blue)' : 'var(--cc-text-secondary)',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'; e.currentTarget.style.borderColor = 'var(--cc-border-hover)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--cc-surface)'; e.currentTarget.style.borderColor = 'var(--cc-border)'; } }}
            >
              <span className="text-xs font-medium">{role.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}