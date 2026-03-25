import React, { useState } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CCModal from '../ui-custom/CCModal';
import CCButton from '../ui-custom/CCButton';
import CCInput from '../ui-custom/CCInput';
import CCEmpty from '../ui-custom/CCEmpty';
import { Mail, Loader2 } from 'lucide-react';

export default function AgentRepresentationRequestModal({ isOpen, onClose, agentUserId, creatorUserId, onSuccess }) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: agentProfile } = useQuery({
    queryKey: ['agentProfile', agentUserId],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: agentUserId }).then(p => p[0]),
    enabled: isOpen && !!agentUserId,
  });

  const requestRepMutation = useMutation({
    mutationFn: async () => {
      // Create a pending INVITED AgentRepresentation
      const rep = await base44.entities.AgentRepresentation.create({
        agent_user_id: agentUserId,
        creator_user_id: creatorUserId,
        status: 'INVITED',
        agreement_notes: message,
      });

      // Notify agent
      await base44.entities.Notification.create({
        user_id: agentUserId,
        type: 'messages',
        actor_user_id: creatorUserId,
        title: 'Representation Request',
        body: `A creator has requested representation with you.`,
      }).catch(() => {});

      // Log
      await base44.entities.AdminActionLog.create({
        action_type: 'representation_request_sent',
        target_user_id: agentUserId,
        performed_by: creatorUserId,
        details: `Creator requested representation from agent. Rep ID: ${rep.id}`,
      }).catch(() => {});

      return rep;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCreatorReps'] });
      toast.success('Representation request sent!');
      setMessage('');
      onClose();
      onSuccess?.();
    },
    onError: (e) => {
      const errMsg = e.message || 'Failed to send request';
      if (errMsg.includes('duplicate')) {
        toast.error('You already have a pending or active relationship with this agent.');
      } else {
        toast.error(errMsg);
      }
    },
  });

  return (
    <CCModal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Representation"
      size="md"
      showClose
    >
      {!agentProfile ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#4F8CFF] animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Agent Info */}
          <div className="p-4 bg-[#0B0F14] rounded-lg border border-[#263248]">
            <p className="text-sm text-[#6B7A94] mb-1">Requesting representation from</p>
            <p className="font-semibold text-[#E8EEF9]">{agentProfile.display_name}</p>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell them why you'd like to work with them..."
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px] text-sm"
            />
          </div>

          {/* Info */}
          <div className="p-3 bg-[#0B0F14] rounded-lg border border-[#263248] text-xs text-[#9AA6BC]">
            <p>The agent will receive your request and can accept or decline. You'll be notified of their response.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <CCButton variant="outline" fullWidth onClick={onClose}>Cancel</CCButton>
            <CCButton
              variant="primary"
              fullWidth
              onClick={() => requestRepMutation.mutate()}
              loading={requestRepMutation.isPending}
            >
              Send Request
            </CCButton>
          </div>
        </div>
      )}
    </CCModal>
  );
}