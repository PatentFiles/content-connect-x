import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Eye, AlertCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AgentsList({ currentAdmin }) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery({
    queryKey: ['agentProfiles'],
    queryFn: () => base44.entities.AgentProfile.list('-created_date'),
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['agentRuns'],
    queryFn: () => base44.entities.AgentRun.list('-created_date', 100),
  });

  const { data: flags = [] } = useQuery({
    queryKey: ['agentFlags'],
    queryFn: () => base44.entities.AgentFlag.list(),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async ({ agentId, isEnabled }) => {
      await base44.entities.AgentProfile.update(agentId, { is_enabled: !isEnabled });
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'AgentProfile',
        target_id: agentId,
        action: isEnabled ? 'disable_agent' : 'enable_agent',
        reason: 'Manual toggle by admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentProfiles'] });
      toast.success('Agent status updated');
    },
  });

  const runAgentMutation = useMutation({
    mutationFn: async (agentId) => {
      const run = await base44.entities.AgentRun.create({
        agent_id: agentId,
        triggered_by: 'MANUAL',
        triggered_by_user_id: currentAdmin.email,
        run_status: 'QUEUED',
        input_summary: 'Manual scan triggered by admin',
        started_at: new Date().toISOString(),
      });
      
      // Call backend function to execute the scan
      await base44.functions.invoke('executeAgentScan', { 
        agentId, 
        runId: run.id 
      });
      
      return run;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentRuns'] });
      toast.success('Agent scan started');
    },
    onError: () => {
      toast.error('Failed to start agent scan');
    },
  });

  const getAgentStats = (agentId) => {
    const agentRuns = runs.filter(r => r.agent_id === agentId);
    const lastRun = agentRuns[0];
    const openFlags = flags.filter(f => f.agent_id === agentId && f.status === 'OPEN');
    return { lastRun, openFlagsCount: openFlags.length };
  };

  return (
    <div className="space-y-4">
      {agents.length === 0 && (
        <CCCard padding="xl" className="text-center">
          <AlertCircle className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-[#9AA6BC]">No agents configured yet</p>
        </CCCard>
      )}

      {agents?.map((agent) => {
        const { lastRun, openFlagsCount } = getAgentStats(agent.id);
        
        return (
          <CCCard key={agent.id} padding="lg" hover>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-base font-semibold text-[#E8EEF9]">{agent.name}</h3>
                  <CCBadge variant={agent.is_enabled ? 'success' : 'outline'}>
                    {agent.is_enabled ? 'Enabled' : 'Disabled'}
                  </CCBadge>
                  <CCBadge variant="primary">{agent.agent_type}</CCBadge>
                  {openFlagsCount > 0 && (
                    <CCBadge variant="warning">{openFlagsCount} Open Flags</CCBadge>
                  )}
                </div>
                <p className="text-sm text-[#9AA6BC] mb-2">{agent.description}</p>
                <div className="flex items-center gap-4 text-xs text-[#6B7A94]">
                  <span>
                    Last run: {lastRun ? format(new Date(lastRun.created_date), 'MMM d, h:mm a') : 'Never'}
                  </span>
                  <span>•</span>
                  <span>
                    Status: {lastRun?.run_status || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <CCButton
                  variant="ghost"
                  size="sm"
                  icon={Eye}
                  onClick={() => {
                    setSelectedAgent(agent);
                    setDetailsModalOpen(true);
                  }}
                >
                  View
                </CCButton>
                <CCButton
                  variant="primary"
                  size="sm"
                  icon={Play}
                  onClick={() => runAgentMutation.mutate(agent.id)}
                  loading={runAgentMutation.isPending}
                  disabled={!agent.is_enabled}
                >
                  Run Now
                </CCButton>
                <CCButton
                  variant={agent.is_enabled ? 'outline' : 'success'}
                  size="sm"
                  icon={agent.is_enabled ? Pause : Play}
                  onClick={() => toggleEnabledMutation.mutate({ 
                    agentId: agent.id, 
                    isEnabled: agent.is_enabled 
                  })}
                  loading={toggleEnabledMutation.isPending}
                >
                  {agent.is_enabled ? 'Disable' : 'Enable'}
                </CCButton>
              </div>
            </div>
          </CCCard>
        );
      })}

      {/* Details Modal */}
      <CCModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedAgent?.name}
        description="Agent Details"
      >
        {selectedAgent && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Description</label>
              <p className="text-sm text-[#E8EEF9] mt-1">{selectedAgent.description}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Type</label>
              <p className="text-sm text-[#E8EEF9] mt-1">{selectedAgent.agent_type}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Status</label>
              <p className="text-sm text-[#E8EEF9] mt-1">
                {selectedAgent.is_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Created By</label>
              <p className="text-sm text-[#E8EEF9] mt-1">{selectedAgent.created_by_admin_user_id}</p>
            </div>
          </div>
        )}
      </CCModal>
    </div>
  );
}