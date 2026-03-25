/**
 * StudioBookingManager
 *
 * Full studio-facing booking management surface.
 * Shows: pending requests, accepted bookings, decline history, linked collaborations.
 * All accept/decline actions go through the existing acceptBookingRequest backend function.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  CalendarCheck, Clock, Check, X, ExternalLink, MessageSquare,
  Building2, MapPin, User, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCEmpty from '@/components/ui-custom/CCEmpty';

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

function BookingCard({ booking, requesterProfile, collab, onAction, actionPending }) {
  const [showDecline, setShowDecline] = useState(false);
  const [declineMsg, setDeclineMsg] = useState('');
  const [expanded, setExpanded] = useState(false);

  const isStudio = booking.booking_type === 'studio';

  return (
    <CCCard padding="md" hover>
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {requesterProfile?.avatar_url ? (
            <img
              src={requesterProfile.avatar_url}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5"
              alt=""
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#263248] flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="w-4 h-4 text-[#9AA6BC]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-sm font-medium text-[#E8EEF9]">
                {requesterProfile?.display_name || booking.requester_user_id}
              </p>
              {isStudio && <CCBadge variant="primary" size="sm"><Building2 className="w-2.5 h-2.5 inline mr-0.5" />Studio</CCBadge>}
              <CCBadge variant={STATUS_VARIANT[booking.status]} size="sm">
                {STATUS_LABEL[booking.status] || booking.status}
              </CCBadge>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-[#6B7A94]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {booking.requested_date && format(parseISO(booking.requested_date), 'MMM d, yyyy')}
                {booking.requested_time && ` at ${booking.requested_time}`}
                {booking.requested_end_time && ` – ${booking.requested_end_time}`}
              </span>
              {booking.studio_location_name && (
                <span className="flex items-center gap-1 text-[#4F8CFF]">
                  <MapPin className="w-3 h-3" />
                  {booking.studio_location_name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#263248] space-y-3">
          {booking.message && (
            <div className="flex gap-2 text-sm text-[#9AA6BC] italic">
              <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#6B7A94]" />
              <p>"{booking.message}"</p>
            </div>
          )}

          {booking.studio_notes && (
            <div className="p-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded text-xs text-[#F59E0B]">
              <p className="font-medium mb-0.5">Booking Conditions</p>
              <p>{booking.studio_notes}</p>
            </div>
          )}

          {booking.response_message && booking.status !== 'pending' && (
            <p className="text-xs text-[#6B7A94] flex gap-1">
              <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
              Your response: {booking.response_message}
            </p>
          )}

          {/* Accepted → link to collaboration */}
          {booking.status === 'accepted' && booking.collaboration_id && (
            <Link to={createPageUrl(`CollaborationDetail?id=${booking.collaboration_id}`)}>
              <CCButton variant="primary" size="sm" icon={ExternalLink}>
                View Collaboration
              </CCButton>
            </Link>
          )}

          {/* Pending → accept / decline */}
          {booking.status === 'pending' && (
            <div className="space-y-2">
              {showDecline ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Optional reason (visible to requester)"
                    value={declineMsg}
                    onChange={e => setDeclineMsg(e.target.value)}
                    className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-xs text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex gap-2">
                    <CCButton
                      variant="danger"
                      size="sm"
                      icon={X}
                      loading={actionPending}
                      onClick={e => { e.stopPropagation(); onAction({ action: 'decline', booking_id: booking.id, response_message: declineMsg }); }}
                    >
                      Confirm Decline
                    </CCButton>
                    <CCButton variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setShowDecline(false); }}>
                      Back
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
                    onClick={e => { e.stopPropagation(); onAction({ action: 'accept', booking_id: booking.id }); }}
                  >
                    Accept Booking
                  </CCButton>
                  <CCButton
                    variant="outline"
                    size="sm"
                    icon={X}
                    onClick={e => { e.stopPropagation(); setShowDecline(true); }}
                  >
                    Decline
                  </CCButton>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </CCCard>
  );
}

export default function StudioBookingManager({ studioUserId }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['studioIncomingBookings', studioUserId],
    queryFn: () => base44.entities.BookingRequest.filter({ recipient_user_id: studioUserId }),
    enabled: !!studioUserId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['studioBookingRequesterProfiles', studioUserId],
    queryFn: async () => {
      const ids = [...new Set(bookings.map(b => b.requester_user_id))];
      if (!ids.length) return [];
      const profiles = await base44.entities.UserProfile.list();
      return profiles.filter(p => ids.includes(p.user_id));
    },
    enabled: bookings.length > 0,
  });

  const { data: linkedCollabs = [] } = useQuery({
    queryKey: ['studioBookingCollabs', studioUserId],
    queryFn: async () => {
      const ids = bookings.filter(b => b.collaboration_id).map(b => b.collaboration_id);
      if (!ids.length) return [];
      return base44.entities.Collaboration.filter({ participant_ids: { $in: [studioUserId] } });
    },
    enabled: bookings.some(b => b.collaboration_id),
  });

  const actionMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('acceptBookingRequest', payload),
    onSuccess: (res, payload) => {
      queryClient.invalidateQueries({ queryKey: ['studioIncomingBookings', studioUserId] });
      queryClient.invalidateQueries({ queryKey: ['studioBookingCollabs', studioUserId] });
      if (payload.action === 'accept') {
        const collabId = res.data?.collaboration_id;
        toast.success(collabId ? 'Booking accepted — collaboration created!' : 'Booking accepted');
      } else if (payload.action === 'decline') {
        toast.success('Booking declined');
      }
    },
    onError: (e) => toast.error(e.message || 'Action failed'),
  });

  const getProfile = (uid) => allProfiles.find(p => p.user_id === uid);

  const filtered = filterStatus === 'all'
    ? bookings
    : bookings.filter(b => b.status === filterStatus);

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const acceptedCount = bookings.filter(b => b.status === 'accepted').length;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-[#0D1520] rounded-lg text-center">
          <p className="text-xl font-bold text-[#F59E0B]">{pendingCount}</p>
          <p className="text-xs text-[#6B7A94]">Pending</p>
        </div>
        <div className="p-3 bg-[#0D1520] rounded-lg text-center">
          <p className="text-xl font-bold text-[#22C55E]">{acceptedCount}</p>
          <p className="text-xs text-[#6B7A94]">Accepted</p>
        </div>
        <div className="p-3 bg-[#0D1520] rounded-lg text-center">
          <p className="text-xl font-bold text-[#4F8CFF]">{bookings.length}</p>
          <p className="text-xs text-[#6B7A94]">Total</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'accepted', 'declined', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              filterStatus === s ? 'bg-[#4F8CFF] text-white' : 'bg-[#151D2B] text-[#6B7A94] hover:text-[#9AA6BC]'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_LABEL[s]}
            <span className="ml-1 opacity-60">
              ({s === 'all' ? bookings.length : bookings.filter(b => b.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-[#6B7A94] text-sm py-6">Loading bookings…</p>
      ) : filtered.length === 0 ? (
        <CCEmpty
          icon={CalendarCheck}
          title={filterStatus === 'pending' ? 'No pending booking requests' : 'No bookings found'}
          description="Booking requests will appear here when members book your studio."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(booking => (
            <BookingCard
              key={booking.id}
              booking={booking}
              requesterProfile={getProfile(booking.requester_user_id)}
              collab={linkedCollabs.find(c => c.id === booking.collaboration_id)}
              onAction={(payload) => actionMutation.mutate(payload)}
              actionPending={actionMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}