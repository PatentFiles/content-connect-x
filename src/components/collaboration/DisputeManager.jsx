import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DisputeManager({ collaborationId, currentUser, userRole }) {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [reason, setReason] = useState('');
  const [evidenceLinks, setEvidenceLinks] = useState('');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: disputes = [] } = useQuery({
    queryKey: ['disputes', collaborationId],
    queryFn: () => base44.entities.CollaborationDispute.filter({
      collaboration_id: collaborationId
    }),
    enabled: !!collaborationId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['disputeProfiles', disputes],
    queryFn: async () => {
      const userIds = [...new Set(disputes.map(d => d.opened_by_user_id))];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: disputes.length > 0,
  });

  const openDisputeMutation = useMutation({
    mutationFn: async (data) => {
      const dispute = await base44.entities.CollaborationDispute.create(data);
      
      // Update collaboration status
      await base44.entities.Collaboration.update(collaborationId, { status: 'disputed' });
      
      // Log activity
      await base44.entities.CollaborationActivity.create({
        collaboration_id: collaborationId,
        user_id: currentUser.email,
        activity_type: 'dispute_opened',
        description: `${currentUser.full_name} opened a dispute`,
        metadata: { dispute_id: dispute.id, reason: data.reason }
      });
      
      return dispute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['collaborationActivity'] });
      queryClient.invalidateQueries({ queryKey: ['dealRoom'] });
      toast.success('Dispute opened successfully');
      setShowOpenModal(false);
      setReason('');
      setEvidenceLinks('');
    },
    onError: () => {
      toast.error('Failed to open dispute');
    }
  });

  const updateDisputeMutation = useMutation({
    mutationFn: async ({ disputeId, status, notes }) => {
      await base44.entities.CollaborationDispute.update(disputeId, {
        status,
        resolution_notes: notes
      });
      
      // Log activity
      await base44.entities.CollaborationActivity.create({
        collaboration_id: collaborationId,
        user_id: currentUser.email,
        activity_type: 'dispute_updated',
        description: `${currentUser.full_name} updated dispute status to ${status}`,
        metadata: { dispute_id: disputeId, new_status: status }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['collaborationActivity'] });
      toast.success('Dispute updated');
      setSelectedDispute(null);
      setResolutionNotes('');
    },
    onError: () => {
      toast.error('Failed to update dispute');
    }
  });

  const handleOpenDispute = () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    const links = evidenceLinks.split('\n').filter(l => l.trim());

    openDisputeMutation.mutate({
      collaboration_id: collaborationId,
      opened_by_user_id: currentUser.email,
      reason: reason,
      evidence_links: links,
      status: 'Open'
    });
  };

  const handleResolve = (disputeId, newStatus) => {
    updateDisputeMutation.mutate({
      disputeId,
      status: newStatus,
      notes: resolutionNotes
    });
  };

  const statusConfig = {
    'Open': { variant: 'danger', icon: AlertTriangle },
    'Under Review': { variant: 'warning', icon: MessageSquare },
    'Resolved': { variant: 'success', icon: CheckCircle },
    'Escalated': { variant: 'accent', icon: AlertTriangle },
    'Voided': { variant: 'default', icon: XCircle }
  };

  const canOpenDispute = userRole === 'Admin' || userRole === 'Member';
  const canResolveDispute = userRole === 'Admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Disputes</h3>
          <p className="text-xs text-[#6B7A94]">Escalation and resolution workflow</p>
        </div>
        {canOpenDispute && (
          <CCButton
            variant="danger"
            icon={AlertTriangle}
            size="sm"
            onClick={() => setShowOpenModal(true)}
          >
            Open Dispute
          </CCButton>
        )}
      </div>

      {/* Disputes List */}
      {disputes.length === 0 ? (
        <CCCard padding="lg">
          <p className="text-sm text-[#6B7A94] text-center">No disputes</p>
        </CCCard>
      ) : (
        <div className="space-y-3">
          {disputes.map(dispute => {
            const profile = profiles.find(p => p.user_id === dispute.opened_by_user_id);
            const status = statusConfig[dispute.status] || statusConfig['Open'];
            
            return (
              <CCCard key={dispute.id} padding="lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CCBadge variant={status.variant} icon={status.icon}>
                        {dispute.status}
                      </CCBadge>
                      <span className="text-xs text-[#6B7A94]">
                        by {profile?.display_name || 'User'}
                      </span>
                    </div>
                    <p className="text-sm text-[#E8EEF9] mb-2">{dispute.reason}</p>
                    {dispute.evidence_links?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-[#6B7A94]">Evidence:</p>
                        {dispute.evidence_links.map((link, i) => (
                          <a 
                            key={i}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#4F8CFF] underline block"
                          >
                            {link}
                          </a>
                        ))}
                      </div>
                    )}
                    {dispute.resolution_notes && (
                      <div className="mt-3 p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                        <p className="text-xs text-[#6B7A94] mb-1">Resolution Notes:</p>
                        <p className="text-sm text-[#E8EEF9]">{dispute.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                  {canResolveDispute && dispute.status !== 'Resolved' && dispute.status !== 'Voided' && (
                    <CCButton
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDispute(dispute)}
                    >
                      Update
                    </CCButton>
                  )}
                </div>
                <span className="text-xs text-[#6B7A94]">
                  Opened {format(new Date(dispute.created_date), 'MMM d, yyyy')}
                </span>
              </CCCard>
            );
          })}
        </div>
      )}

      {/* Open Dispute Modal */}
      <CCModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Open Dispute"
        description="Provide details about the issue to initiate dispute escalation"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#E8EEF9] mb-2">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
              className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
          <div>
            <label className="block text-sm text-[#E8EEF9] mb-2">Evidence Links (one per line)</label>
            <textarea
              value={evidenceLinks}
              onChange={(e) => setEvidenceLinks(e.target.value)}
              placeholder="Message IDs, document URLs..."
              rows={3}
              className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setShowOpenModal(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="danger" 
              onClick={handleOpenDispute}
              loading={openDisputeMutation.isPending}
            >
              Open Dispute
            </CCButton>
          </div>
        </div>
      </CCModal>

      {/* Update Dispute Modal */}
      {selectedDispute && (
        <CCModal
          isOpen={!!selectedDispute}
          onClose={() => setSelectedDispute(null)}
          title="Update Dispute"
          description="Change dispute status and add resolution notes"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[#E8EEF9] mb-2">Resolution Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add notes about resolution..."
                rows={3}
                className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <CCButton
                variant="warning"
                size="sm"
                onClick={() => handleResolve(selectedDispute.id, 'Under Review')}
                loading={updateDisputeMutation.isPending}
              >
                Under Review
              </CCButton>
              <CCButton
                variant="success"
                size="sm"
                onClick={() => handleResolve(selectedDispute.id, 'Resolved')}
                loading={updateDisputeMutation.isPending}
              >
                Resolve
              </CCButton>
              <CCButton
                variant="accent"
                size="sm"
                onClick={() => handleResolve(selectedDispute.id, 'Escalated')}
                loading={updateDisputeMutation.isPending}
              >
                Escalate
              </CCButton>
              <CCButton
                variant="outline"
                size="sm"
                onClick={() => handleResolve(selectedDispute.id, 'Voided')}
                loading={updateDisputeMutation.isPending}
              >
                Void
              </CCButton>
            </div>
          </div>
        </CCModal>
      )}
    </div>
  );
}