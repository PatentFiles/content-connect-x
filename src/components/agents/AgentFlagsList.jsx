import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, CheckCircle, X, AlertTriangle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AgentFlagsList({ currentAdmin }) {
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const queryClient = useQueryClient();

  const { data: flags = [] } = useQuery({
    queryKey: ['agentFlags'],
    queryFn: () => base44.entities.AgentFlag.list('-created_date', 200),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agentProfiles'],
    queryFn: () => base44.entities.AgentProfile.list(),
  });

  const reviewFlagMutation = useMutation({
    mutationFn: async ({ flagId, status, notes }) => {
      await base44.entities.AgentFlag.update(flagId, {
        status,
        reviewed_by_admin_user_id: currentAdmin.email,
        reviewed_at: new Date().toISOString(),
        review_notes: notes,
      });
      
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'AgentFlag',
        target_id: flagId,
        action: `flag_${status.toLowerCase()}`,
        reason: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentFlags'] });
      toast.success('Flag updated');
      setActionModalOpen(false);
      setReviewNotes('');
    },
  });

  const filteredFlags = flags?.filter(flag => {
    const matchesSeverity = severityFilter === 'all' || flag.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || flag.status === statusFilter;
    return matchesSeverity && matchesStatus;
  }) || [];

  const getAgentName = (agentId) => {
    const agent = agents?.find(a => a.id === agentId);
    return agent?.name || agentId;
  };

  const handleAction = (action, flag) => {
    setActionType(action);
    setSelectedFlag(flag);
    setActionModalOpen(true);
  };

  const confirmAction = () => {
    if ((actionType === 'DISMISSED' || actionType === 'RESOLVED') && !reviewNotes.trim()) {
      toast.error('Notes required for this action');
      return;
    }
    reviewFlagMutation.mutate({
      flagId: selectedFlag.id,
      status: actionType,
      notes: reviewNotes,
    });
  };

  const severityConfig = {
    LOW: { variant: 'outline', color: 'text-[#9AA6BC]' },
    MEDIUM: { variant: 'warning', color: 'text-[#F59E0B]' },
    HIGH: { variant: 'danger', color: 'text-[#EF4444]' },
    CRITICAL: { variant: 'danger', color: 'text-[#EF4444]' },
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <CCCard padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          >
            <option value="all">All Severities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          >
            <option value="all">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </CCCard>

      {/* Flags List */}
      <div className="space-y-3">
        {filteredFlags.map((flag) => {
          const config = severityConfig[flag.severity];
          
          return (
            <CCCard key={flag.id} padding="lg" hover>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-4 h-4 ${config.color}`} />
                    <p className="text-sm font-medium text-[#E8EEF9]">{flag.title}</p>
                    <CCBadge variant={config.variant}>{flag.severity}</CCBadge>
                    <CCBadge variant="outline" size="sm">{flag.status}</CCBadge>
                  </div>
                  <p className="text-xs text-[#9AA6BC] mb-2">{flag.description}</p>
                  <div className="flex items-center gap-4 text-xs text-[#6B7A94]">
                    <span>Agent: {getAgentName(flag.agent_id)}</span>
                    <span>•</span>
                    <span>Category: {flag.category}</span>
                    <span>•</span>
                    <span>{format(new Date(flag.created_date), 'MMM d, yyyy')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CCButton
                    variant="ghost"
                    size="sm"
                    icon={Eye}
                    onClick={() => {
                      setSelectedFlag(flag);
                      setDetailsModalOpen(true);
                    }}
                  >
                    View
                  </CCButton>
                  {flag.status === 'OPEN' && (
                    <>
                      <CCButton
                        variant="success"
                        size="sm"
                        icon={CheckCircle}
                        onClick={() => handleAction('ACKNOWLEDGED', flag)}
                      >
                        Acknowledge
                      </CCButton>
                      <CCButton
                        variant="outline"
                        size="sm"
                        icon={X}
                        onClick={() => handleAction('DISMISSED', flag)}
                      >
                        Dismiss
                      </CCButton>
                    </>
                  )}
                  {flag.status === 'ACKNOWLEDGED' && (
                    <CCButton
                      variant="success"
                      size="sm"
                      onClick={() => handleAction('RESOLVED', flag)}
                    >
                      Resolve
                    </CCButton>
                  )}
                </div>
              </div>
            </CCCard>
          );
        })}
      </div>

      {/* Details Modal */}
      <CCModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedFlag?.title}
        description={`${selectedFlag?.severity} - ${selectedFlag?.category}`}
      >
        {selectedFlag && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Description</label>
              <p className="text-sm text-[#E8EEF9] mt-1">{selectedFlag.description}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7A94]">Target</label>
              <p className="text-sm text-[#E8EEF9] mt-1">
                {selectedFlag.target_type}: {selectedFlag.target_id}
              </p>
            </div>
            {selectedFlag.reason_codes_json && (
              <div>
                <label className="text-xs font-medium text-[#6B7A94]">Reason Codes</label>
                <pre className="text-xs text-[#E8EEF9] mt-1 bg-[#0B0F14] p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedFlag.reason_codes_json, null, 2)}
                </pre>
              </div>
            )}
            {selectedFlag.suggested_actions_json && (
              <div>
                <label className="text-xs font-medium text-[#6B7A94]">Suggested Actions</label>
                <pre className="text-xs text-[#E8EEF9] mt-1 bg-[#0B0F14] p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(selectedFlag.suggested_actions_json, null, 2)}
                </pre>
              </div>
            )}
            {selectedFlag.review_notes && (
              <div>
                <label className="text-xs font-medium text-[#6B7A94]">Review Notes</label>
                <p className="text-sm text-[#E8EEF9] mt-1">{selectedFlag.review_notes}</p>
              </div>
            )}
          </div>
        )}
      </CCModal>

      {/* Action Modal */}
      <CCModal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={`${actionType} Flag`}
        description={selectedFlag?.title}
      >
        <div className="space-y-4">
          <CCInput
            label="Review Notes"
            placeholder="Add notes about this action..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            required={(actionType === 'DISMISSED' || actionType === 'RESOLVED')}
          />
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setActionModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={confirmAction}
              loading={reviewFlagMutation.isPending}
            >
              Confirm
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}