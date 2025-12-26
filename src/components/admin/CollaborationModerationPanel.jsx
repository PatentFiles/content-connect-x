import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pause, Play, AlertTriangle, Shield, FileText } from 'lucide-react';
import { createPageUrl } from '@/utils';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import { toast } from 'sonner';

export default function CollaborationModerationPanel({ currentAdmin }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedCollab, setSelectedCollab] = useState(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionReason, setActionReason] = useState('');
  const queryClient = useQueryClient();

  const { data: collaborations = [] } = useQuery({
    queryKey: ['allCollaborations'],
    queryFn: () => base44.entities.Collaboration.list('-created_date'),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['allRiskScores'],
    queryFn: () => base44.entities.CollaborationRiskScore.list(),
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['allDisputes'],
    queryFn: () => base44.entities.CollaborationDispute.list(),
  });

  const adminActionMutation = useMutation({
    mutationFn: async ({ action, collabId, reason }) => {
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'Collaboration',
        target_id: collabId,
        action,
        reason,
        metadata_json: { timestamp: new Date().toISOString() }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCollaborations'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('Action logged successfully');
      setActionModalOpen(false);
      setSelectedCollab(null);
      setActionReason('');
    },
    onError: () => {
      toast.error('Failed to log action');
    }
  });

  const escalateToArbitrationMutation = useMutation({
    mutationFn: async ({ collabId, disputeId }) => {
      await base44.entities.ArbitrationCase.create({
        collaboration_id: collabId,
        dispute_id: disputeId,
        opened_by_admin_id: currentAdmin.email,
        status: 'Open'
      });
      
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'Collaboration',
        target_id: collabId,
        action: 'escalate_to_arbitration',
        reason: 'Dispute escalated to arbitration',
        metadata_json: { dispute_id: disputeId }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Escalated to arbitration');
      setActionModalOpen(false);
      setSelectedCollab(null);
    },
    onError: () => {
      toast.error('Failed to escalate');
    }
  });

  const handleAction = (action, collab) => {
    setActionType(action);
    setSelectedCollab(collab);
    setActionModalOpen(true);
  };

  const confirmAction = () => {
    if (actionType === 'escalate_to_arbitration') {
      const dispute = disputes.find(d => d.collaboration_id === selectedCollab.id);
      if (!dispute) {
        toast.error('No dispute found for this collaboration');
        return;
      }
      escalateToArbitrationMutation.mutate({
        collabId: selectedCollab.id,
        disputeId: dispute.id
      });
    } else {
      if (!actionReason.trim()) {
        toast.error('Reason is required');
        return;
      }
      adminActionMutation.mutate({
        action: actionType,
        collabId: selectedCollab.id,
        reason: actionReason
      });
    }
  };

  const filteredCollaborations = collaborations.filter(collab => {
    const matchesSearch = searchTerm === '' || 
      collab.collaboration_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collab.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || collab.status === statusFilter;
    
    const collabRisk = riskScores.find(r => r.collaboration_id === collab.id);
    const matchesRisk = riskFilter === 'all' || collabRisk?.risk_tier === riskFilter;
    
    return matchesSearch && matchesStatus && matchesRisk;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Collaboration Moderation</h2>
        <p className="text-sm text-[#6B7A94]">Review and moderate ongoing collaborations</p>
      </div>

      {/* Filters */}
      <CCCard padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
            <input
              type="text"
              placeholder="Search collaborations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="disputed">Disputed</option>
            <option value="signed">Signed</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          >
            <option value="all">All Risk Tiers</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
          </select>
        </div>
      </CCCard>

      {/* Collaborations List */}
      <div className="space-y-3">
        {filteredCollaborations.map(collab => {
          const collabRisk = riskScores.find(r => r.collaboration_id === collab.id);
          const collabDispute = disputes.find(d => d.collaboration_id === collab.id);
          
          return (
            <CCCard key={collab.id} padding="lg" hover>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium text-[#E8EEF9]">
                      {collab.collaboration_name || collab.id}
                    </p>
                    <CCBadge variant="outline" size="sm">{collab.status}</CCBadge>
                    {collab.created_by_role === 'agent' && (
                      <CCBadge variant="accent" size="sm">Agent-Created</CCBadge>
                    )}
                    {collabRisk && (
                      <CCBadge 
                        variant={collabRisk.risk_tier === 'High' ? 'danger' : collabRisk.risk_tier === 'Medium' ? 'warning' : 'success'} 
                        size="sm"
                      >
                        {collabRisk.risk_tier} Risk ({collabRisk.score})
                      </CCBadge>
                    )}
                    {collabDispute && (
                      <CCBadge variant="danger" size="sm">Dispute: {collabDispute.status}</CCBadge>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7A94]">
                    {collab.participant_ids?.length || 0} participants • Created {new Date(collab.created_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <CCButton 
                    variant="ghost" 
                    size="sm" 
                    icon={FileText}
                    onClick={() => window.location.href = createPageUrl(`CollaborationDetail?id=${collab.id}`)}
                  >
                    View
                  </CCButton>
                  <CCButton
                    variant="ghost"
                    size="sm"
                    icon={Pause}
                    onClick={() => handleAction('pause_collaboration', collab)}
                  >
                    Pause
                  </CCButton>
                  {collabDispute && (
                    <CCButton
                      variant="accent"
                      size="sm"
                      icon={Shield}
                      onClick={() => handleAction('escalate_to_arbitration', collab)}
                    >
                      Escalate
                    </CCButton>
                  )}
                </div>
              </div>
            </CCCard>
          );
        })}
      </div>

      {/* Action Modal */}
      <CCModal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={`${actionType.replace(/_/g, ' ')} - ${selectedCollab?.collaboration_name || selectedCollab?.id}`}
        description="Provide a reason for this administrative action"
      >
        <div className="space-y-4">
          {actionType !== 'escalate_to_arbitration' && (
            <CCInput
              label="Reason *"
              placeholder="Why is this action being taken?"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              required
            />
          )}
          {actionType === 'escalate_to_arbitration' && (
            <p className="text-sm text-[#9AA6BC]">
              This collaboration will be escalated to an arbitrator for review. The arbitration case will be created and require assignment to an arbitrator.
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setActionModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="danger" 
              onClick={confirmAction}
              loading={adminActionMutation.isPending || escalateToArbitrationMutation.isPending}
            >
              Confirm Action
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}