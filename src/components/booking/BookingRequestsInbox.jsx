/**
 * BookingRequestsInbox
 *
 * Full booking lifecycle UI:
 * - View incoming requests (accept / decline)
 * - View outgoing requests (cancel)
 * - On accept → Collaboration is created server-side and linked
 * - All mutations go through acceptBookingRequest backend function
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  CalendarCheck, Clock, Check, X, ChevronDown, ChevronUp,
  ExternalLink, MessageSquare, Users
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

const STATUS_VARIANT = {
  pending: 'warning',
  accepted: 'success',
  declined: 'danger',
  cancelled: 'outline',
  expired: 'outline',
};

const STATUS_LABEL = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

function RequestCard({ req, mode, getProfile, userId, onAction, actionPending }) {
  const otherUserId = mode === 'incoming' ? req.requester_user_id : req.recipient_user_id;
  const other = getProfile(otherUserId);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineMsg, setDeclineMsg] = useState('');

  return (
    <div className="p-3 bg-[#0B0F14] rounded-lg border border-[#263248] space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {other?.avatar_url ? (
            <img src={other.avatar_url} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#263248] flex items-center justify-center flex-shrink-0 text-xs text-[#9AA6BC]">
              {(other?.display_name || otherUserId).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#E8EEF9] truncate">
              {mode === 'incoming' ? '' : 'To: '}{other?.display_name || otherUserId}
            </p>
            <p className="text-xs text-[#9AA6BC] flex items-center gap-1">
              <Clock className="w-3 h-3 flex-shrink-0" />
              {req.requested_date && format(parseISO(req.requested_date), 'MMM d, yyyy')}
              {req.requested_time && ` at ${req.requested_time}`}
            </p>
          </div>
        </div>
        <CCBadge variant={STATUS_VARIANT[req.status]} size="sm">
          {STATUS_LABEL[req.status] || req.status}
        </CCBadge>
      </div>

      {/* Message */}
      {req.message && (
        <p className="text-xs text-[#9AA6BC] italic pl-9">"{req.message}"</p>
      )}

      {/* Response message */}
      {req.response_message && req.status !== 'pending' && (
        <p className="text-xs text-[#6B7A94] pl-9 flex items-start gap-1">
          <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
          {req.response_message}
        </p>
      )}

      {/* Accepted → link to collaboration */}
      {req.status === 'accepted' && req.collaboration_id && (
        <div className="pl-9">
          <Link to={createPageUrl(`CollaborationDetail?id=${req.collaboration_id}`)}>
            <CCButton variant="primary" size="sm" icon={ExternalLink}>
              View Collaboration
            </CCButton>
          </Link>
        </div>
      )}

      {/* Incoming pending — accept / decline */}
      {mode === 'incoming' && req.status === 'pending' && (
        <div className="pl-9 space-y-2">
          {showDeclineInput ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Optional reason (visible to requester)"
                value={declineMsg}
                onChange={e => setDeclineMsg(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-xs text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none"
              />
              <div className="flex gap-2">
                <CCButton
                  variant="danger"
                  size="sm"
                  icon={X}
                  loading={actionPending}
                  onClick={() => onAction({ action: 'decline', booking_id: req.id, response_message: declineMsg })}
                >
                  Confirm Decline
                </CCButton>
                <CCButton variant="ghost" size="sm" onClick={() => setShowDeclineInput(false)}>
                  Cancel
                </CCButton>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <CCButton
                variant="success"
                size="sm"
                icon={Check}
                loading={actionPending}
                onClick={() => onAction({ action: 'accept', booking_id: req.id })}
              >
                Accept
              </CCButton>
              <CCButton
                variant="outline"
                size="sm"
                icon={X}
                onClick={() => setShowDeclineInput(true)}
              >
                Decline
              </CCButton>
            </div>
          )}
        </div>
      )}

      {/* Outgoing pending — cancel */}
      {mode === 'outgoing' && req.status === 'pending' && (
        <div className="pl-9">
          <CCButton
            variant="ghost"
            size="sm"
            icon={X}
            loading={actionPending}
            onClick={() => onAction({ action: 'cancel', booking_id: req.id })}
          >
            Cancel Request
          </CCButton>
        </div>
      )}
    </div>
  );
}

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

  const allIds = [...new Set([
    ...incoming.map(r => r.requester_user_id),
    ...outgoing.map(r => r.recipient_user_id),
  ])];

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['bookingProfiles', allIds],
    queryFn: async () => {
      if (!allIds.length) return [];
      const profiles = await base44.entities.UserProfile.list();
      return profiles.filter(p => allIds.includes(p.user_id));
    },
    enabled: allIds.length > 0,
  });

  const actionMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('acceptBookingRequest', payload),
    onSuccess: (res, payload) => {
      queryClient.invalidateQueries({ queryKey: ['bookingRequestsIncoming', userId] });
      queryClient.invalidateQueries({ queryKey: ['bookingRequestsOutgoing', userId] });
      queryClient.invalidateQueries({ queryKey: ['myBookingRequests'] });
      const action = payload.action;
      if (action === 'accept') {
        const collabId = res.data?.collaboration_id;
        toast.success(
          collabId
            ? 'Booking accepted — collaboration created!'
            : 'Booking accepted'
        );
      } else if (action === 'decline') {
        toast.success('Booking declined');
      } else if (action === 'cancel') {
        toast.success('Booking cancelled');
      }
    },
    onError: (e) => toast.error(e.message || 'Action failed'),
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
          {pendingCount > 0 && (
            <CCBadge variant="accent">{pendingCount} pending</CCBadge>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" />
          : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-6">
          {/* Incoming */}
          {incoming.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7A94] uppercase tracking-wider mb-3">Received</p>
              <div className="space-y-3">
                {incoming.map(req => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    mode="incoming"
                    getProfile={getProfile}
                    userId={userId}
                    onAction={(payload) => actionMutation.mutate(payload)}
                    actionPending={actionMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Outgoing */}
          {outgoing.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7A94] uppercase tracking-wider mb-3">Sent</p>
              <div className="space-y-3">
                {outgoing.map(req => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    mode="outgoing"
                    getProfile={getProfile}
                    userId={userId}
                    onAction={(payload) => actionMutation.mutate(payload)}
                    actionPending={actionMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CCCard>
  );
}