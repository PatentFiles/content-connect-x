import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import { format } from 'date-fns';

export default function AgentRunsList() {
  const [selectedRun, setSelectedRun] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: runs = [] } = useQuery({
    queryKey: ['agentRuns'],
    queryFn: () => base44.entities.AgentRun.list('-created_date', 100),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agentProfiles'],
    queryFn: () => base44.entities.AgentProfile.list(),
  });

  const filteredRuns = runs?.filter(run => 
    statusFilter === 'all' || run.run_status === statusFilter
  ) || [];

  const getAgentName = (agentId) => {
    const agent = agents?.find(a => a.id === agentId);
    return agent?.name || agentId;
  };

  const statusConfig = {
    QUEUED: { variant: 'outline', icon: Clock },
    RUNNING: { variant: 'primary', icon: Clock },
    COMPLETED: { variant: 'success', icon: CheckCircle },
    FAILED: { variant: 'danger', icon: XCircle },
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <CCCard padding="lg">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-64 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
        >
          <option value="all">All Statuses</option>
          <option value="QUEUED">Queued</option>
          <option value="RUNNING">Running</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </CCCard>

      {/* Runs List */}
      <div className="space-y-3">
        {(filteredRuns || []).map((run) => {
          const config = statusConfig[run.run_status];
          const Icon = config.icon;
          
          return (
            <CCCard key={run.id} padding="lg" hover>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm font-medium text-[#E8EEF9]">
                      {getAgentName(run.agent_id)}
                    </p>
                    <CCBadge variant={config.variant} icon={Icon}>
                      {run.run_status}
                    </CCBadge>
                    <CCBadge variant="outline" size="sm">{run.triggered_by}</CCBadge>
                  </div>
                  <p className="text-xs text-[#6B7A94] mb-1">{run.input_summary}</p>
                  <div className="flex items-center gap-4 text-xs text-[#6B7A94]">
                    <span>Started: {format(new Date(run.started_at || run.created_date), 'MMM d, h:mm a')}</span>
                    {run.completed_at && (
                      <>
                        <span>•</span>
                        <span>Completed: {format(new Date(run.completed_at), 'MMM d, h:mm a')}</span>
                      </>
                    )}
                  </div>
                </div>
                <CCButton
                  variant="ghost"
                  size="sm"
                  icon={Eye}
                  onClick={() => {
                    setSelectedRun(run);
                    setDetailsModalOpen(true);
                  }}
                >
                  View
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
        title="Run Details"
        description={`${getAgentName(selectedRun?.agent_id)} - ${selectedRun?.run_status}`}
      >
        {selectedRun && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Input Summary</label>
              <p className="text-sm text-[#E8EEF9] mt-1">{selectedRun.input_summary}</p>
            </div>
            {selectedRun.output_summary && (
              <div>
                <label className="text-xs font-medium text-[#6B7A94]">Output Summary</label>
                <p className="text-sm text-[#E8EEF9] mt-1">{selectedRun.output_summary}</p>
              </div>
            )}
            {selectedRun.metadata_json && (
              <div>
                <label className="text-xs font-medium text-[#6B7A94]">Metadata</label>
                <pre className="text-xs text-[#E8EEF9] mt-1 bg-[#0B0F14] p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedRun.metadata_json, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CCModal>
    </div>
  );
}