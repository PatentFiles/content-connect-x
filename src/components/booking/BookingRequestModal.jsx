import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO, isAfter, startOfToday } from 'date-fns';
import { Calendar, Clock, MessageSquare, CalendarCheck } from 'lucide-react';
import CCModal from '@/components/ui-custom/CCModal';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

export default function BookingRequestModal({ isOpen, onClose, recipientUserId, recipientName, requesterUserId }) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [requestedTime, setRequestedTime] = useState('');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const today = startOfToday();

  // Fetch recipient's availability entries
  const { data: availabilityEntries = [], isLoading } = useQuery({
    queryKey: ['bookingAvailability', recipientUserId],
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

  // Fetch travel entries too (they are also available windows)
  const { data: travelEntries = [] } = useQuery({
    queryKey: ['bookingTravel', recipientUserId],
    queryFn: async () => {
      const entries = await base44.entities.ScheduleEntry.filter({
        user_id: recipientUserId,
        entry_type: 'TRAVEL',
      });
      return entries.filter(e => isAfter(parseISO(e.end_date), today));
    },
    enabled: isOpen && !!recipientUserId,
  });

  const allEntries = [...availabilityEntries, ...travelEntries];

  const submitMutation = useMutation({
    mutationFn: async () => {
      const request = await base44.entities.BookingRequest.create({
        requester_user_id: requesterUserId,
        recipient_user_id: recipientUserId,
        schedule_entry_id: selectedEntry?.id || null,
        requested_date: selectedEntry?.start_date,
        requested_time: requestedTime || selectedEntry?.start_time || null,
        message: message.trim(),
        status: 'pending',
      });

      // Notify recipient
      await base44.entities.Notification.create({
        user_id: recipientUserId,
        type: 'collaboration_invites',
        actor_user_id: requesterUserId,
        title: 'New Booking Request',
        body: `You have a new booking request for ${format(parseISO(selectedEntry.start_date), 'MMM d, yyyy')}`,
        related_entity_type: 'BookingRequest',
        related_entity_id: request.id,
        action_url: 'Dashboard',
      });

      return request;
    },
    onSuccess: () => {
      toast.success('Booking request sent!');
      setSelectedEntry(null);
      setRequestedTime('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['myBookingRequests'] });
      onClose();
    },
  });

  const handleClose = () => {
    setSelectedEntry(null);
    setRequestedTime('');
    setMessage('');
    onClose();
  };

  return (
    <CCModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Request a Booking"
      description={`Send a booking request to ${recipientName}`}
      size="md"
    >
      {isLoading ? (
        <p className="text-[#9AA6BC] text-sm text-center py-4">Loading availability...</p>
      ) : allEntries.length === 0 ? (
        <div className="text-center py-6">
          <Calendar className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-[#9AA6BC] text-sm">No available dates posted by this user.</p>
          <p className="text-[#6B7A94] text-xs mt-1">You can still message them directly.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Step 1: Select a date */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#4F8CFF]" />
              Select an Available Date <span className="text-[#FF2DAA]">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
              {allEntries.map(entry => {
                const isSelected = selectedEntry?.id === entry.id;
                const isTravel = entry.entry_type === 'TRAVEL';
                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntry(entry);
                      if (entry.start_time) setRequestedTime(entry.start_time);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-[#4F8CFF] bg-[#4F8CFF]/10'
                        : 'border-[#263248] bg-[#0B0F14] hover:border-[#3A4A6B]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#E8EEF9]">
                          {format(parseISO(entry.start_date), 'EEEE, MMM d, yyyy')}
                          {entry.end_date !== entry.start_date && (
                            <span className="text-[#9AA6BC]"> → {format(parseISO(entry.end_date), 'MMM d')}</span>
                          )}
                        </div>
                        {(entry.location_city || entry.title) && (
                          <div className="text-xs text-[#9AA6BC] mt-0.5">
                            {entry.location_city || entry.title}
                            {entry.location_region && `, ${entry.location_region}`}
                          </div>
                        )}
                        {entry.start_time && (
                          <div className="text-xs text-[#6B7A94] mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {entry.start_time}{entry.end_time && ` – ${entry.end_time}`}
                          </div>
                        )}
                      </div>
                      <CCBadge variant={isTravel ? 'warning' : 'success'} size="sm">
                        {isTravel ? 'Travel' : 'Available'}
                      </CCBadge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Preferred time (optional) */}
          {selectedEntry && (
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#4F8CFF]" />
                Preferred Time <span className="text-[#6B7A94] font-normal text-xs">(optional)</span>
              </label>
              <input
                type="time"
                value={requestedTime}
                onChange={e => setRequestedTime(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF]"
              />
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
              placeholder="Introduce yourself and describe what you're looking to create..."
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] resize-none"
            />
          </div>

          {/* Submit */}
          <CCButton
            variant="primary"
            fullWidth
            icon={CalendarCheck}
            disabled={!selectedEntry}
            loading={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            Send Booking Request
          </CCButton>
        </div>
      )}
    </CCModal>
  );
}