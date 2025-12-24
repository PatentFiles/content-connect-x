import React from 'react';
import { Eye, Shield, User, Briefcase, Building2, Camera, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import CCBadge from '../ui-custom/CCBadge';

const roleOptions = [
  { value: 'admin', label: 'Admin', icon: Shield, color: 'bg-[#EF4444]/20 text-[#EF4444]' },
  { value: 'creator', label: 'Creator', icon: User, color: 'bg-[#4F8CFF]/20 text-[#4F8CFF]' },
  { value: 'agent', label: 'Agent', icon: Briefcase, color: 'bg-[#FF2DAA]/20 text-[#FF2DAA]' },
  { value: 'studio', label: 'Studio', icon: Building2, color: 'bg-[#22C55E]/20 text-[#22C55E]' },
  { value: 'photographer', label: 'Photographer', icon: Camera, color: 'bg-[#F59E0B]/20 text-[#F59E0B]' },
  { value: 'videographer', label: 'Videographer', icon: Video, color: 'bg-[#A855F7]/20 text-[#A855F7]' },
];

export default function AdminRoleViewSwitcher({ currentView, onViewChange }) {
  return (
    <div className="p-4 border-b border-[#263248]">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-[#6B7A94]" />
        <p className="text-xs font-medium text-[#6B7A94] uppercase tracking-wider">View As</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {roleOptions.map((role) => {
          const isActive = currentView === role.value;
          const Icon = role.icon;
          
          return (
            <button
              key={role.value}
              onClick={() => onViewChange(role.value)}
              className={cn(
                'flex items-center justify-center px-3 py-2 rounded-lg transition-all duration-200',
                'border text-center',
                isActive
                  ? 'bg-[#4F8CFF]/10 border-[#4F8CFF] text-[#4F8CFF]'
                  : 'bg-[#151D2B] border-[#263248] text-[#9AA6BC] hover:bg-[#1A2438] hover:border-[#3A4A6B]'
              )}
            >
              <span className="text-xs font-medium">{role.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}