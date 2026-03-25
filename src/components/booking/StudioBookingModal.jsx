/**
 * StudioBookingModal
 *
 * Studio-aware booking modal. Reads the studio's ScheduleEntry records
 * (AVAILABILITY windows) and shows studio-specific context:
 * - room/set label
 * - equipment/features
 * - booking notes/conditions
 * - location name & address
 *
 * On submit creates a BookingRequest with booking_type='studio' plus
 * studio_location_name and studio_notes fields.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO, isAfter, startOfToday } from 'date-fns';
import {
  Building2, Calendar, Clock, MessageSquare, CalendarCheck,
  MapPin, Zap, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import CCModal from '@/components/ui-custom/CCModal';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

function FeatureTag({ label }) {
  return (
    <span className="px-2 py-0.5 bg-[#1A2438] border border-[#263248] text-[#9AA6BC] text-xs rounded-full">
      {label}
    </span>
  );
}

function AvailabilityCard({ entry, isSelected, onSelect }) {
  const [showDetails, setShowDetails] = useState(false);
  const hasExtras = entry.room_label || entry.equipment_features?.length || entry.booking_notes || entry.location_address;

  return (
    <div
      className={`rounded-lg border transition-all ${
        isSelected ? 'border-[#4F8CFF] bg-[#4F8CFF]/10' : 'border-[#263248] bg-[#0B0F14] hover:border-[#3A4A6B]'
      }`}
    >
      <button className="w-full text-left p-3" onClick={() => onSelect(entry)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#E8EEF9]">
              {format(parseISO(entry.start_date), 'EEEE, MMM d, yyyy')}
              {entry.end_date !== entry.start_date && (
                <span className="text-[#9AA6BC]"> → {format(parseISO(entry.end_date), 'MMM d')}</span>
              )}
            </div>
            {(entry.start_time || entry.end_time) && (
              <div className="text-xs text-[#6B7A94] mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {entry.start_time}{entry.end_time && ` – ${entry.end_time}`}
              </div>
            )}
            {entry.room_label && (
              <div className="text-xs text-[#4F8CFF] mt-0.5 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {entry.room_label}
              </div>
            )}
            {(entry.location_name || entry.location_city) && (
              <div className="text-xs text-[#9AA6BC] mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {entry.location_name || entry.location_city}
                {entry.location_region && `, ${entry.location_region}`}
              </div>
            )}
          </div>
          <CCBadge variant="success" size="sm">Available</CCBadge>
        </div>

        {entry.equipment_features?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {entry.equipment_features.slice(0, 3).map((f, i) => (
              <FeatureTag key={i} label={f} />
            ))}
            {entry.equipment_features.length > 3 && (
              <FeatureTag label={`+${entry.equipment_features.length - 3} more`} />
            )}
          </div>
        )}
      </button>

      {hasExtras && (
        <button
          className="w-full px-3 pb-2 flex items-center gap-1 text-xs text-[#6B7A94] hover:text-[#9AA6BC]"
          onClick={(e) => { e.stopPropagation(); setShowDetails(v => !v); }}
        >
          <Info className="w-3 h-3" />
          {showDetails ? 'Hide details' : 'View details'}
          {showDetails ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>
      )}

      {showDetails && hasExtras && (
        <div className="px-3 pb-3 space-y-2 border-t border-[#1A2438] pt-2">
          {entry.location_address && (
            <div className="text-xs text-[#9AA6BC] flex gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
              {entry.location_address}
            </div>
          )}
          {entry.equipment_features?.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7A94] mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Equipment & Features
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.equipment_features.map((f, i) => <FeatureTag key={i} label={f} />)}
              </div>
            </div>
          )}
          {entry.booking_notes && (
            <div className="p-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded text-xs text-[#F59E0B]">
              <p className="font-medium mb-0.5">Booking Conditions</p>
              <p>{entry.booking_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudioBookingModal({
  isOpen,
  onClose,
  recipientUserId,   // studio user ID
  recipientName,     // studio display name
  requesterUserId,
  studioDetails,     // StudioDetails record (optional, for location fallback)
}) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [requestedTime, setRequestedTime] = useState('');
  const [requestedEndTime, setRequestedEndTime] = useState('');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const today = startOfToday();

  const { data: availabilityEntries = [], isLoading } = useQuery({
    queryKey: ['studioBookingAvailability', recipientUserId],
    queryFn: async () => {
      const entries = await base44.entities.ScheduleEntry.filter({
        user_id: recipientUserId,
        entry_type: 'AVAILABILITY',
        status: 'AVAILABLE',
      });
      return entries.filter(e => isAfter(parseISO(e.end_date), today));
    },
    enabled: isOpen && !!recipientUserId,
  });

  const handleSelect = (entry) => {
    setSelectedEntry(entry);
    if (entry.start_time) setRequestedTime(entry.start_time);
    if (entry.end_time) setRequestedEndTime(entry.end_time);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntry) throw new Error('Please select an available date');

      // Determine studio location name
      const studioLocationName =
        selectedEntry.room_label ||
        selectedEntry.location_name ||
        (studioDetails?.locations?.[0]?.name) ||
        recipientName ||
        'Studio';

      const request = await base44.entities.BookingRequest.create({
        requester_user_id: requesterUserId,
        recipient_user_id: recipientUserId,
        schedule_entry_id: selectedEntry.id,
        requested_date: selectedEntry.start_date,
        requested_time: requestedTime || selectedEntry.start_time || null,
        requested_end_time: requestedEndTime || selectedEntry.end_time || null,
        message: message.trim() || null,
        status: 'pending',
        booking_type: 'studio',
        studio_location_name: studioLocationName,
        studio_notes: selectedEntry.booking_notes || null,
        created_from_booking: true,
      });

      // Notify studio
      await base44.entities.Notification.create({
        user_id: recipientUserId,
        type: 'collaboration_invites',
        actor_user_id: requesterUserId,
        title: 'New Studio Booking Request',
        body: `You have a new studio booking request for ${format(parseISO(selectedEntry.start_date), 'MMM d, yyyy')}${selectedEntry.room_label ? ` (${selectedEntry.room_label})` : ''}.`,
        related_entity_type: 'BookingRequest',
        related_entity_id: request.id,
        action_url: 'Dashboard',
      });

      return request;
    },
    onSuccess: () => {
      toast.success('Studio booking request sent!');
      setSelectedEntry(null);
      setRequestedTime('');
      setRequestedEndTime('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['myBookingRequests'] });
      queryClient.invalidateQueries({ queryKey: ['bookingRequestsOutgoing'] });
      onClose();
    },
    onError: (e) => toast.error(e.message || 'Failed to send booking request'),
  });

  const handleClose = () => {
    setSelectedEntry(null);
    setRequestedTime('');
    setRequestedEndTime('');
    setMessage('');
    onClose();
  };

  return (
    <CCModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Book Studio Time"
      description={`Request a booking at ${recipientName}`}
      size="md"
    >
      {isLoading ? (
        <p className="text-[#9AA6BC] text-sm text-center py-6">Loading studio availability…</p>
      ) : availabilityEntries.length === 0 ? (
        <div className="text-center py-8">
          <Building2 className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-[#9AA6BC] text-sm">No available studio windows posted.</p>
          <p className="text-[#6B7A94] text-xs mt-1">Message them directly to arrange a booking.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Step 1: Select available window */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#4F8CFF]" />
              Select Studio Availability Window <span className="text-[#FF2DAA]">*</span>
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {availabilityEntries.map(entry => (
                <AvailabilityCard
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedEntry?.id === entry.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>

          {/* Step 2: Time refinement */}
          {selectedEntry && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#E8EEF9] mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#4F8CFF]" />
                  Start Time
                </label>
                <input
                  type="time"
                  value={requestedTime}
                  onChange={e => setRequestedTime(e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#E8EEF9] mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#9AA6BC]" />
                  End Time
                </label>
                <input
                  type="time"
                  value={requestedEndTime}
                  onChange={e => setRequestedEndTime(e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
              </div>
            </div>
          )}

          {/* Step 3: Message */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-1 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#4F8CFF]" />
              Message <span className="text-[#6B7A94] font-normal text-xs">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Describe your shoot, content type, number of performers…"
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 resize-none"
            />
          </div>

          <CCButton
            variant="primary"
            fullWidth
            icon={CalendarCheck}
            disabled={!selectedEntry}
            loading={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            Send Studio Booking Request
          </CCButton>
        </div>
      )}
    </CCModal>
  );
}