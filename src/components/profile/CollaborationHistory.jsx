/**
 * CollaborationHistory
 *
 * Shows a privacy-respecting summary of past collaborations.
 * Uses existing Collaboration + Contract entities — no duplication.
 *
 * Visibility is controlled by UserSettings and profile owner's choice.
 * Sensitive details (scenes, acts, compensation amounts) are never shown.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Briefcase, CheckCircle, XCircle, AlertTriangle, Users, TrendingUp, Clock
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';

const ROLE_LABELS = {
  creator: 'Creator',
  photographer: 'Photographer',
  videographer: 'Videographer',
  agent: 'Agent',
  studio: 'Studio',
};

function StatBox({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center p-3 bg-[#121824] rounded-lg">
      <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-[#6B7A94]">{label}</p>
    </div>
  );
}

export default function CollaborationHistory({ targetUserId, isOwner = false, visibilitySetting = 'summary' }) {
  // visibilitySetting: 'hidden' | 'summary' | 'verified_members' | 'collaborators_only'

  const { data: collabs = [], isLoading } = useQuery({
    queryKey: ['collabHistory', targetUserId],
    queryFn: () => base44.entities.Collaboration.filter({ participant_ids: { $in: [targetUserId] } }),
    enabled: !!targetUserId && visibilitySetting !== 'hidden',
    staleTime: 5 * 60 * 1000,
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['collabHistoryDisputes', targetUserId],
    queryFn: () => base44.entities.CollaborationDispute.filter({ filed_by: targetUserId }),
    enabled: !!targetUserId && visibilitySetting !== 'hidden',
    staleTime: 10 * 60 * 1000,
  });

  if (visibilitySetting === 'hidden' && !isOwner) return null;

  if (isLoading) {
    return (
      <CCCard padding="md">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-[#263248] rounded w-1/3" />
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-[#263248] rounded" />)}
          </div>
        </div>
      </CCCard>
    );
  }

  // Aggregate safe stats from existing data
  const completed = collabs.filter(c => c.status === 'completed').length;
  const cancelled = collabs.filter(c => c.status === 'cancelled').length;
  const disputed = collabs.filter(c => c.status === 'disputed').length;
  const total = collabs.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : null;

  // Role frequency (what roles did they participate as)
  const roleFrequency = {};
  collabs.forEach(c => {
    const roleType = c.created_by_role || 'creator';
    if (c.created_by_user_id === targetUserId) {
      roleFrequency[roleType] = (roleFrequency[roleType] || 0) + 1;
    }
  });

  // Repeat collaborators (users they've worked with multiple times)
  const partnerCount = {};
  collabs.forEach(c => {
    (c.participant_ids || []).forEach(pid => {
      if (pid !== targetUserId) {
        partnerCount[pid] = (partnerCount[pid] || 0) + 1;
      }
    });
  });
  const repeatPartners = Object.values(partnerCount).filter(count => count > 1).length;

  const openDisputes = disputes.filter(d => !['resolved', 'dismissed'].includes(d.status)).length;

  if (total === 0 && !isOwner) {
    return null; // No history to show non-owners
  }

  return (
    <CCCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[#4F8CFF]" />
          Collaboration History
        </h3>
        {visibilitySetting === 'hidden' && isOwner && (
          <CCBadge variant="outline" size="sm">Hidden from others</CCBadge>
        )}
      </div>

      {total === 0 ? (
        <p className="text-xs text-[#6B7A94] text-center py-4">No collaboration history yet</p>
      ) : (
        <div className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox icon={CheckCircle} value={completed} label="Completed" color="text-[#22C55E]" />
            <StatBox icon={TrendingUp} value={completionRate !== null ? `${completionRate}%` : '—'} label="Completion Rate" color="text-[#4F8CFF]" />
            <StatBox icon={Users} value={repeatPartners} label="Repeat Partners" color="text-[#FF2DAA]" />
          </div>

          {/* Secondary stats */}
          <div className="flex flex-wrap gap-2">
            {cancelled > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#6B7A94]">
                <XCircle className="w-3 h-3 text-[#EF4444]" />
                {cancelled} cancelled
              </div>
            )}
            {disputed > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#6B7A94]">
                <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
                {disputed} disputed
              </div>
            )}
            {Object.keys(roleFrequency).length > 0 && (
              <div className="flex items-center gap-1.5">
                {Object.entries(roleFrequency).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([role]) => (
                  <CCBadge key={role} variant="outline" size="sm">{ROLE_LABELS[role] || role}</CCBadge>
                ))}
              </div>
            )}
          </div>

          {/* Notice for non-owners */}
          {!isOwner && (
            <p className="text-xs text-[#6B7A94] border-t border-[#1A2438] pt-2">
              Collaboration counts are system-verified. Private details are never shown.
            </p>
          )}
        </div>
      )}
    </CCCard>
  );
}