import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { CalendarCheck, Clock, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCEmpty from '@/components/ui-custom/CCEmpty';

const statusVariant = { pending: 'warning', accepted: 'success', declined: 'danger', cancelled: 'outline' };

export default function BookingRequestsInbox({ userId }) {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();

  const { data: incoming = [], isLoading: loadingIn } = useQuery({
    queryKey: ['bookingRequestsIncoming', userId],
    queryFn: () => base44.entities.BookingRequest.filter({ recipient_user_id: userId }),
    enabled: !!userId,
  });

  const { data: outgoing = [], isLoading: loadingOut } = useQuery({
    queryKey: ['bookingRequestsOutgoing', userId],
    queryFn: () => base44.entities.BookingRequest.filter({ requester_user_id: userId }),
    enabled: !!userId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['bookingProfiles', [...incoming.map(r => r.requester_user_id), ...outgoing.map(r => r.recipient_user_id)]],
    queryFn: async () => {
      const ids = [...new Set([...incoming.map(r => r.requester_user_id), ...outgoing.map(r => r.recipient_user_id)])];
      if (!ids.length) return [];
      const profiles = await base44.entities.UserProfile.list();
      return profiles.filter(p => ids.includes(p.user_id));
    },
    enabled: incoming.length > 0 || outgoing.length > 0,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status, requester_user_id }) => {
      await base44.entities.BookingRequest.update(id, {
        status,
        responded_at: new Date().toISOString(),
      });
      await base44.entities.Notification.create({
        user_id: requester_user_id,
        type: 'collaboration_invites',
        actor_user_id: userId,
        title: `Booking Request ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
        body: `Your booking request was ${status}.`,
        related_entity_type: 'BookingRequest',
        related_entity_id: id,
        action_url: 'Dashboard',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingRequestsIncoming', userId] });
      queryClient.invalidateQueries({ queryKey: ['bookingRequestsOutgoing', userId] });
      toast.success('Response sent');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => base44.entities.BookingRequest.update(id, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingRequestsOutgoing', userId] });
      toast.success('Request cancelled');
    },
  });

  const getProfile = (uid) => allProfiles.find(p => p.user_id === uid);
  const pendingCount = incoming.filter(r => r.status === 'pending').length;

  if (loadingIn || loadingOut) return null;
  if (!incoming.length && !outgoing.length) return null;

  return (
    <CCCard padding="lg" className="mb-6">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-[#4F8CFF]" />
          <h2 className="text-lg font-semibold text-[#E8EEF9]">Booking Requests</h2>
          {pendingCount > 0 && <CCBadge variant="accent">{pendingCount} pending</CCBadge>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-6">
          {/* Incoming */}
          {incoming.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7A94] uppercase tracking-wider mb-3">Received</p>
              <div className="space-y-3">
                {incoming.map(req => {
                  const from = getProfile(req.requester_user_id);
                  return (
                    <div key={req.id} className="p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-medium text-[#E8EEF9]">
                            {from?.display_name || req.requester_user_id}
                          </p>
                          <p className="text-xs text-[#9AA6BC] flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {req.requested_date && format(parseISO(req.requested_date), 'MMM d, yyyy')}
                            {req.requested_time && ` at ${req.requested_time}`}
                          </p>
                        </div>
                        <CCBadge variant={statusVariant[req.status]} size="sm">
                          {req.status}
                        </CCBadge>
                      </div>
                      {req.message && (
                        <p className="text-xs text-[#9AA6BC] italic mb-2">"{req.message}"</p>
                      )}
                      {req.status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <CCButton
                            variant="success"
                            size="sm"
                            icon={Check}
                            loading={respondMutation.isPending}
                            onClick={() => respondMutation.mutate({ id: req.id, status: 'accepted', requester_user_id: req.requester_user_id })}
                          >
                            Accept
                          </CCButton>
                          <CCButton
                            variant="danger"
                            size="sm"
                            icon={X}
                            loading={respondMutation.isPending}
                            onClick={() => respondMutation.mutate({ id: req.id, status: 'declined', requester_user_id: req.requester_user_id })}
                          >
                            Decline
                          </CCButton>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outgoing */}
          {outgoing.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7A94] uppercase tracking-wider mb-3">Sent</p>
              <div className="space-y-3">
                {outgoing.map(req => {
                  const to = getProfile(req.recipient_user_id);
                  return (
                    <div key={req.id} className="p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-medium text-[#E8EEF9]">
                            To: {to?.display_name || req.recipient_user_id}
                          </p>
                          <p className="text-xs text-[#9AA6BC] flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {req.requested_date && format(parseISO(req.requested_date), 'MMM d, yyyy')}
                            {req.requested_time && ` at ${req.requested_time}`}
                          </p>
                        </div>
                        <CCBadge variant={statusVariant[req.status]} size="sm">
                          {req.status}
                        </CCBadge>
                      </div>
                      {req.status === 'pending' && (
                        <CCButton
                          variant="ghost"
                          size="sm"
                          icon={X}
                          loading={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(req.id)}
                        >
                          Cancel
                        </CCButton>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </CCCard>
  );
}