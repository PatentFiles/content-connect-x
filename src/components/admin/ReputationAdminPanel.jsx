/**
 * ReputationAdminPanel
 *
 * Admin view for trust scores:
 * - View all user scores
 * - Trigger recalculation
 * - Inspect score factors per user
 * - See safety check-in escalations
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Award, RefreshCw, ChevronDown, ChevronUp, Shield, AlertTriangle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { ReputationScoreBar } from '@/components/trust/ReputationBadge';
import { toast } from 'sonner';

export default function ReputationAdminPanel() {
  const [expandedId, setExpandedId] = useState(null);
  const [recalcUserId, setRecalcUserId] = useState('');
  const queryClient = useQueryClient();

  const { data: allScores = [], isLoading } = useQuery({
    queryKey: ['adminReputationScores'],
    queryFn: () => base44.entities.ReputationScore.list('-score', 100),
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['adminRepProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const { data: missedCheckIns = [] } = useQuery({
    queryKey: ['adminMissedCheckIns'],
    queryFn: () => base44.functions.invoke('safetyCheckIn', {}, { queryParams: { action: 'list_missed' } }).then(r => r.data?.data || []),
  });

  const profileMap = React.useMemo(
    () => Object.fromEntries(allProfiles.map(p => [p.user_id, p])),
    [allProfiles]
  );

  const recalcMutation = useMutation({
    mutationFn: (userId) => base44.functions.invoke('calculateReputationScore', {
      user_id: userId || undefined,
      recalculate_all: !userId || undefined,
    }),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['adminReputationScores'] });
      toast.success(userId ? 'Score recalculated' : 'All scores recalculated');
    },
    onError: (e) => toast.error(e.message || 'Recalculation failed'),
  });

  const escalateMutation = useMutation({
    mutationFn: ({ check_in_id, reason }) => base44.functions.invoke('safetyCheckIn', { check_in_id, reason }, { queryParams: { action: 'escalate' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMissedCheckIns'] });
      toast.success('Escalated');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#E8EEF9] mb-1">Reputation Scores</h2>
        <p className="text-sm text-[#6B7A94]">System-derived trust scores. No user ratings — calculated from behavior only.</p>
      </div>

      {/* Recalculate */}
      <CCCard padding="md">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="user_id (email) to recalculate — or leave blank for all"
            value={recalcUserId}
            onChange={e => setRecalcUserId(e.target.value)}
            className="flex-1 min-w-0 bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none"
          />
          <CCButton
            variant="primary"
            size="sm"
            icon={RefreshCw}
            onClick={() => recalcMutation.mutate(recalcUserId || null)}
            loading={recalcMutation.isPending}
          >
            Recalculate {recalcUserId ? 'User' : 'All'}
          </CCButton>
        </div>
      </CCCard>

      {/* Safety Check-In Escalations */}
      {missedCheckIns.length > 0 && (
        <CCCard padding="md" className="border-[#EF4444]/30 bg-[#EF4444]/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <h3 className="text-sm font-semibold text-[#EF4444]">Missed Safety Check-Ins ({missedCheckIns.length})</h3>
          </div>
          <div className="space-y-2">
            {missedCheckIns.map(ci => (
              <div key={ci.id} className="flex items-center justify-between p-2 bg-[#121824] rounded-lg">
                <div>
                  <p className="text-sm text-[#E8EEF9]">{ci.user_id}</p>
                  <p className="text-xs text-[#6B7A94]">
                    Expected end: {ci.expected_end_time ? new Date(ci.expected_end_time).toLocaleString() : 'Unknown'}
                  </p>
                </div>
                <CCButton
                  variant="danger"
                  size="sm"
                  onClick={() => escalateMutation.mutate({ check_in_id: ci.id, reason: 'Admin escalated missed check-out' })}
                  loading={escalateMutation.isPending}
                >
                  Escalate
                </CCButton>
              </div>
            ))}
          </div>
        </CCCard>
      )}

      {/* Score List */}
      {isLoading ? (
        <p className="text-center text-[#6B7A94] py-8">Loading scores...</p>
      ) : allScores.length === 0 ? (
        <CCCard padding="xl">
          <div className="text-center py-8">
            <Award className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No scores calculated yet</p>
            <p className="text-xs text-[#6B7A94] mt-1">Click "Recalculate All" to generate scores</p>
          </div>
        </CCCard>
      ) : (
        <div className="space-y-2">
          {allScores.map(score => {
            const profile = profileMap[score.user_id];
            const isExpanded = expandedId === score.id;
            return (
              <CCCard key={score.id} padding="md" hover>
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : score.id)}
                >
                  <CCAvatar src={profile?.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E8EEF9] truncate">
                      {profile?.display_name || score.user_id}
                    </p>
                    <p className="text-xs text-[#6B7A94] truncate">{score.user_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReputationScoreBar score={score} />
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
                  </div>
                </div>

                {isExpanded && score.factors && (
                  <div className="mt-3 pt-3 border-t border-[#263248] grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(score.factors).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-[#6B7A94]">{key.replace(/_/g, ' ')}</span>
                        <span className={`font-medium ${
                          key === 'positive_points' ? 'text-[#22C55E]' :
                          key === 'negative_points' ? 'text-[#EF4444]' :
                          'text-[#E8EEF9]'
                        }`}>{String(val)}</span>
                      </div>
                    ))}
                    <div className="col-span-2 flex justify-end mt-1">
                      <CCButton
                        variant="ghost"
                        size="sm"
                        icon={RefreshCw}
                        onClick={(e) => { e.stopPropagation(); recalcMutation.mutate(score.user_id); }}
                        loading={recalcMutation.isPending}
                      >
                        Recalc
                      </CCButton>
                    </div>
                  </div>
                )}
              </CCCard>
            );
          })}
        </div>
      )}
    </div>
  );
}