import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, Clock, MapPin, Users, Video, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import CCInput from '../ui-custom/CCInput';
import CCSelect from '../ui-custom/CCSelect';
import CCBadge from '../ui-custom/CCBadge';
import CCModal from '../ui-custom/CCModal';
import { toast } from 'sonner';

const eventIcons = {
  meeting: Users,
  shoot: Video,
  call: Phone,
  deadline: Clock,
  other: Calendar,
};

export default function CollaborationCalendar({ collaborationId, participants }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    event_type: 'meeting',
    attendees: [],
  });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['collaborationEvents', collaborationId],
    queryFn: () => base44.entities.CollaborationEvent.filter({ collaboration_id: collaborationId }, 'start_date'),
    enabled: !!collaborationId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['participantProfiles', participants],
    queryFn: async () => {
      if (!participants?.length) return [];
      return await Promise.all(
        participants.map(id => base44.entities.UserProfile.filter({ user_id: id }).then(p => p[0]))
      );
    },
    enabled: !!participants?.length,
  });

  const createEventMutation = useMutation({
    mutationFn: (data) => base44.entities.CollaborationEvent.create({
      ...data,
      collaboration_id: collaborationId,
      created_by: user?.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationEvents']);
      setShowAddModal(false);
      setNewEvent({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        location: '',
        event_type: 'meeting',
        attendees: [],
      });
      toast.success('Event scheduled');
    },
  });

  const upcomingEvents = events.filter(e => new Date(e.start_date) >= new Date());
  const pastEvents = events.filter(e => new Date(e.start_date) < new Date());

  const eventTypeColors = {
    meeting: 'primary',
    shoot: 'accent',
    call: 'success',
    deadline: 'danger',
    other: 'default',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8EEF9]">Calendar</h3>
        <div className="flex gap-2">
          <CCButton
            variant={viewMode === 'list' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </CCButton>
          <CCButton variant="primary" size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Event
          </CCButton>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="space-y-3 mb-6">
        <h4 className="text-sm font-medium text-[#9AA6BC]">Upcoming ({upcomingEvents.length})</h4>
        {upcomingEvents.length === 0 ? (
          <CCCard padding="md" className="text-center">
            <Calendar className="w-8 h-8 text-[#6B7A94] mx-auto mb-2" />
            <p className="text-sm text-[#9AA6BC]">No upcoming events</p>
          </CCCard>
        ) : (
          upcomingEvents.map(event => {
            const Icon = eventIcons[event.event_type] || Calendar;
            return (
              <motion.div key={event.id} layout>
                <CCCard padding="md" hover>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-[#4F8CFF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-[#E8EEF9]">{event.title}</h4>
                        <CCBadge variant={eventTypeColors[event.event_type]} size="sm">
                          {event.event_type}
                        </CCBadge>
                      </div>
                      {event.description && (
                        <p className="text-xs text-[#9AA6BC] mb-2">{event.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7A94]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {format(new Date(event.start_date), 'MMM d, h:mm a')}
                            {event.end_date && ` - ${format(new Date(event.end_date), 'h:mm a')}`}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        {event.attendees?.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{event.attendees.length} attendees</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CCCard>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-[#9AA6BC]">Past ({pastEvents.length})</h4>
          {pastEvents.slice(0, 3).map(event => {
            const Icon = eventIcons[event.event_type] || Calendar;
            return (
              <motion.div key={event.id} layout>
                <CCCard padding="md" className="opacity-60">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#263248] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#6B7A94]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-[#E8EEF9]">{event.title}</h4>
                      <p className="text-xs text-[#6B7A94] mt-1">
                        {format(new Date(event.start_date), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                </CCCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Event Modal */}
      <CCModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Schedule Event"
        size="md"
      >
        <div className="space-y-4">
          <CCInput
            label="Event Title"
            placeholder="What's the event?"
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Description</label>
            <textarea
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px]"
              placeholder="Event description..."
            />
          </div>

          <CCSelect
            label="Event Type"
            value={newEvent.event_type}
            onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
          >
            <option value="meeting">Meeting</option>
            <option value="shoot">Shoot</option>
            <option value="call">Call</option>
            <option value="deadline">Deadline</option>
            <option value="other">Other</option>
          </CCSelect>

          <div className="grid grid-cols-2 gap-3">
            <CCInput
              label="Start Date/Time"
              type="datetime-local"
              value={newEvent.start_date}
              onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
              required
            />
            <CCInput
              label="End Date/Time"
              type="datetime-local"
              value={newEvent.end_date}
              onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
            />
          </div>

          <CCInput
            label="Location (Optional)"
            placeholder="Enter location or meeting link"
            value={newEvent.location}
            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={() => createEventMutation.mutate(newEvent)}
              loading={createEventMutation.isPending}
              disabled={!newEvent.title || !newEvent.start_date}
            >
              Schedule Event
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}