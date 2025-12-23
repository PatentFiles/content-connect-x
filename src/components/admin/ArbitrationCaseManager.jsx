import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ArbitrationCaseManager({ currentUser }) {
  const [selectedCase, setSelectedCase] = useState(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const queryClient = useQueryClient();

  const isArbitrator = currentUser?.role === 'admin'; // In production, would check for specific arbitrator role

  const { data: cases = [] } = useQuery({
    queryKey: ['arbitrationCases'],
    queryFn: () => base44.entities.ArbitrationCase.list('-created_date'),
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['arbitrationCollaborations'],
    queryFn: async () => {
      const collabIds = [...new Set(cases.map(c => c.collaboration_id))];
      if (!collabIds.length) return [];
      const allCollabs = await base44.entities.Collaboration.list();
      return allCollabs.filter(c => collabIds.includes(c.id));
    },
    enabled: cases.length > 0,
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['caseDisputes'],
    queryFn: async () => {
      const disputeIds = [...new Set(cases.map(c => c.dispute_id).filter(Boolean))];
      if (!disputeIds.length) return [];
      const allDisputes = await base44.entities.CollaborationDispute.list();
      return allDisputes.filter(d => disputeIds.includes(d.id));
    },
    enabled: cases.length > 0,
  });

  const resolveCase = useMutation({
    mutationFn: async ({ caseId, resolution, notes }) => {
      await base44.entities.ArbitrationCase.update(caseId, {
        status: 'Resolved',
        resolution,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
        immutable: true
      });

      await base44.entities.AdminActionLog.create({
        admin_user_id: currentUser.email,
        target_type: 'ArbitrationCase',
        target_id: caseId,
        action: 'resolve_arbitration',
        reason: `Arbitration resolved: ${resolution}`,
        notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Arbitration case resolved');
      setResolveModalOpen(false);
      setSelectedCase(null);
      setResolution('');
      setResolutionNotes('');
    },
    onError: () => {
      toast.error('Failed to resolve case');
    }
  });

  const handleResolve = (caseItem) => {
    setSelectedCase(caseItem);
    setResolveModalOpen(true);
  };

  const confirmResolution = () => {
    if (!resolution) {
      toast.error('Please select a resolution');
      return;
    }
    if (!resolutionNotes.trim()) {
      toast.error('Resolution notes are required');
      return;
    }
    resolveCase.mutate({
      caseId: selectedCase.id,
      resolution,
      notes: resolutionNotes
    });
  };

  const statusColors = {
    'Open': 'danger',
    'Under Review': 'warning',
    'Resolved': 'success'
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Arbitration Cases</h2>
        <p className="text-sm text-[#6B7A94]">Review and resolve escalated disputes</p>
      </div>

      {cases.length === 0 ? (
        <CCCard padding="lg" className="text-center">
          <Shield className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-sm text-[#9AA6BC]">No arbitration cases</p>
        </CCCard>
      ) : (
        <div className="space-y-3">
          {cases.map(caseItem => {
            const collaboration = collaborations.find(c => c.id === caseItem.collaboration_id);
            const dispute = disputes.find(d => d.id === caseItem.dispute_id);
            
            return (
              <CCCard key={caseItem.id} padding="lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-medium text-[#E8EEF9]">
                        {collaboration?.collaboration_name || caseItem.collaboration_id}
                      </h3>
                      <CCBadge variant={statusColors[caseItem.status]}>
                        {caseItem.status}
                      </CCBadge>
                      {caseItem.immutable && (
                        <CCBadge variant="outline" size="sm">Finalized</CCBadge>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A94] mb-2">
                      Opened by {caseItem.opened_by_admin_id} • {format(new Date(caseItem.created_date), 'MMM d, yyyy')}
                    </p>
                    {dispute && (
                      <div className="bg-[#151D2B] rounded-lg p-3 mb-2">
                        <p className="text-xs text-[#6B7A94] mb-1">Original Dispute:</p>
                        <p className="text-sm text-[#E8EEF9]">{dispute.reason}</p>
                      </div>
                    )}
                    {caseItem.resolution && (
                      <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg p-3 mt-2">
                        <p className="text-xs text-[#6B7A94] mb-1">Resolution:</p>
                        <p className="text-sm font-medium text-[#22C55E] mb-1">{caseItem.resolution}</p>
                        <p className="text-sm text-[#E8EEF9]">{caseItem.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to={createPageUrl(`CollaborationDetail?id=${caseItem.collaboration_id}`)}>
                      <CCButton variant="ghost" size="sm">
                        View Collaboration
                      </CCButton>
                    </Link>
                    {caseItem.status !== 'Resolved' && isArbitrator && (
                      <CCButton 
                        variant="primary" 
                        size="sm"
                        icon={CheckCircle}
                        onClick={() => handleResolve(caseItem)}
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
      )}

      {/* Resolve Modal */}
      <CCModal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Resolve Arbitration Case"
        description="Select a resolution and provide detailed notes"
      >
        <div className="space-y-4">
          <CCSelect
            label="Resolution *"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            required
          >
            <option value="">Select resolution</option>
            <option value="Uphold Contract">Uphold Contract</option>
            <option value="Void Contract">Void Contract</option>
            <option value="Partial Breach">Partial Breach</option>
            <option value="No Fault Found">No Fault Found</option>
          </CCSelect>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Resolution Notes *</label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Detailed explanation of the arbitration decision..."
              rows={5}
              className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>

          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3">
            <p className="text-xs text-[#F59E0B] font-medium">⚠️ This action is permanent</p>
            <p className="text-xs text-[#9AA6BC] mt-1">
              Once finalized, this arbitration decision cannot be modified and becomes part of the permanent legal record.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setResolveModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="success" 
              onClick={confirmResolution}
              loading={resolveCase.isPending}
            >
              Finalize Resolution
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}