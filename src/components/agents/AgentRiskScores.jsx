import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Eye, TrendingUp, AlertTriangle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import { format } from 'date-fns';

export default function AgentRiskScores() {
  const [searchId, setSearchId] = useState('');
  const [selectedScore, setSelectedScore] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const { data: riskScores = [] } = useQuery({
    queryKey: ['collaborationRiskScores'],
    queryFn: () => base44.entities.CollaborationRiskScore.list('-calculated_at', 100),
  });

  const filteredScores = riskScores?.filter(score =>
    !searchId || score.collaboration_id?.includes(searchId)
  ) || [];

  const getBandConfig = (score) => {
    if (score >= 70) return { variant: 'danger', label: 'HIGH RISK', color: 'text-[#EF4444]' };
    if (score >= 30) return { variant: 'warning', label: 'REVIEW', color: 'text-[#F59E0B]' };
    return { variant: 'success', label: 'SAFE', color: 'text-[#22C55E]' };
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <CCCard padding="lg">
        <CCInput
          placeholder="Search by collaboration ID..."
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
        />
      </CCCard>

      {/* Scores List */}
      <div className="space-y-3">
        {filteredScores.map((score) => {
          const config = getBandConfig(score.score);
          
          return (
            <CCCard key={score.id} padding="lg" hover>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className={`w-4 h-4 ${config.color}`} />
                    <p className="text-sm font-medium text-[#E8EEF9]">
                      Collaboration: {score.collaboration_id}
                    </p>
                    <CCBadge variant={config.variant}>{config.label}</CCBadge>
                    <CCBadge variant="outline" size="sm">Score: {score.score}</CCBadge>
                  </div>
                  <p className="text-xs text-[#9AA6BC] mb-2">{score.explanation}</p>
                  <div className="text-xs text-[#6B7A94]">
                    Calculated: {format(new Date(score.calculated_at || score.created_date), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                <CCButton
                  variant="ghost"
                  size="sm"
                  icon={Eye}
                  onClick={() => {
                    setSelectedScore(score);
                    setDetailsModalOpen(true);
                  }}
                >
                  View Breakdown
                </CCButton>
              </div>
            </CCCard>
          );
        })}
      </div>

      {/* Details Modal */}
      <CCModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Risk Score Breakdown"
        description={`Collaboration: ${selectedScore?.collaboration_id}`}
      >
        {selectedScore && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#9AA6BC]">Total Score</span>
              <CCBadge variant={getBandConfig(selectedScore.score).variant} size="lg">
                {selectedScore.score}/100
              </CCBadge>
            </div>
            
            {selectedScore.score_breakdown_json && (
              <div>
                <label className="text-xs font-medium text-[#6B7A94]">Score Breakdown</label>
                <div className="mt-2 space-y-2">
                  {(Object.entries(selectedScore.score_breakdown_json || {}) || []).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-[#263248]">
                      <span className="text-sm text-[#E8EEF9]">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-medium text-[#4F8CFF]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Explanation</label>
              <p className="text-sm text-[#E8EEF9] mt-1">{selectedScore.explanation}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Band</label>
              <p className="text-sm text-[#E8EEF9] mt-1">{selectedScore.band || getBandConfig(selectedScore.score).label}</p>
            </div>
          </div>
        )}
      </CCModal>
    </div>
  );
}