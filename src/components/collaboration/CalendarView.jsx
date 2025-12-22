import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Plus, Video, MapPin, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import CCModal from '@/components/ui-custom/CCModal';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';

const eventTypeConfig = {
  meeting: { label: 'Meeting', icon: Video, variant: 'primary' },
  deadline: { label: 'Deadline', icon: Clock, variant: 'danger' },
  milestone: { label: 'Milestone', icon: CalendarIcon, variant: 'success' },
  reminder: { label: 'Reminder', icon: Clock, variant: 'warning' },
};

export default function CalendarView({ dealRoomId, participants, userRole }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'meeting',
    start_date: '',
    end_date: '',
    location: '',
    meeting_link: '',
    attendees: [],
  });
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['events', dealRoomId],
    queryFn: () => base44.entities.CollaborationEvent.filter({ deal_room_id: dealRoomId }, '-start_date'),
    enabled: !!dealRoomId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const canManageCalendar = userRole?.permissions?.manage_calendar || userRole?.role === 'admin';

  const createEventMutation = useMutation({
    mutationFn: (data) => base44.entities.CollaborationEvent.create({
      ...data,
      deal_room_id: dealRoomId,
      created_by: user?.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', dealRoomId] });
      toast.success('Event created');
      setCreateModalOpen(false);
      setEventForm({
        title: '',
        description: '',
        event_type: 'meeting',
        start_date: '',
        end_date: '',
        location: '',
        meeting_link: '',
        attendees: [],
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id) => base44.entities.CollaborationEvent.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', dealRoomId] });
      toast.success('Event deleted');
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day) => {
    return events.filter(e => isSameDay(new Date(e.start_date), day));
  };

  const handleCreateEvent = () => {
    if (!eventForm.title || !eventForm.start_date) {
      toast.error('Please fill in required fields');
      return;
    }
    createEventMutation.mutate(eventForm);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <CCButton
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
          >
            Previous
          </CCButton>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <CCButton
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
          >
            Next
          </CCButton>
        </div>
        {canManageCalendar && (
          <CCButton
            variant="primary"
            icon={Plus}
            onClick={() => setCreateModalOpen(true)}
          >
            Add Event
          </CCButton>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-[#6B7A94] py-2">
            {day}
          </div>
        ))}
        {daysInMonth.map(day => {
          const dayEvents = getEventsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div
              key={day.toString()}
              className={`min-h-24 p-2 border border-[#263248] rounded-lg ${
                isToday ? 'bg-[#4F8CFF]/10 border-[#4F8CFF]' : 'bg-[#151D2B]'
              } ${!isSameMonth(day, currentMonth) ? 'opacity-50' : ''}`}
            >
              <div className="text-xs text-[#E8EEF9] mb-1">{format(day, 'd')}</div>
              <div className="space-y-1">
                {dayEvents.map(event => {
                  const config = eventTypeConfig[event.event_type];
                  return (
                    <div
                      key={event.id}
                      className="text-xs p-1 bg-[#0B0F14] rounded border-l-2"
                      style={{ borderLeftColor: config.variant === 'primary' ? '#4F8CFF' : config.variant === 'danger' ? '#EF4444' : '#22C55E' }}
                    >
                      <p className="text-[#E8EEF9] truncate">{event.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-[#E8EEF9]">Upcoming Events</h4>
        {events.filter(e => new Date(e.start_date) >= new Date()).slice(0, 5).map(event => {
          const config = eventTypeConfig[event.event_type];
          return (
            <CCCard key={event.id} padding="sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <config.icon className="w-4 h-4 text-[#4F8CFF]" />
                    <p className="text-sm font-medium text-[#E8EEF9]">{event.title}</p>
                    <CCBadge size="sm" variant={config.variant}>{config.label}</CCBadge>
                  </div>
                  {event.description && (
                    <p className="text-xs text-[#6B7A94] mb-2">{event.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-[#9AA6BC]">
                    <span>{format(new Date(event.start_date), 'MMM d, yyyy h:mm a')}</span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.location}
                      </span>
                    )}
                    {event.meeting_link && (
                      <a href={event.meeting_link} target="_blank" className="flex items-center gap-1 text-[#4F8CFF] hover:underline">
                        <Video className="w-3 h-3" /> Join
                      </a>
                    )}
                  </div>
                </div>
                {canManageCalendar && (
                  <button
                    onClick={() => deleteEventMutation.mutate(event.id)}
                    className="text-[#6B7A94] hover:text-[#EF4444] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </CCCard>
          );
        })}
      </div>

      <CCModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Event"
        description="Add a new event to the calendar"
      >
        <div className="space-y-4">
          <CCInput
            label="Event Title"
            placeholder="Enter event title"
            value={eventForm.title}
            onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Description</label>
            <textarea
              value={eventForm.description}
              onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              placeholder="Enter event description"
              className="w-full h-20 bg-[#121824] border border-[#263248] rounded-lg text-[#E8EEF9] placeholder-[#6B7A94] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Event Type</label>
            <select
              value={eventForm.event_type}
              onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg text-[#E8EEF9] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            >
              {Object.entries(eventTypeConfig).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CCInput
              label="Start Date & Time"
              type="datetime-local"
              value={eventForm.start_date}
              onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
              required
            />
            <CCInput
              label="End Date & Time"
              type="datetime-local"
              value={eventForm.end_date}
              onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
            />
          </div>

          <CCInput
            label="Location"
            placeholder="Enter location"
            icon={MapPin}
            value={eventForm.location}
            onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
          />

          <CCInput
            label="Meeting Link"
            placeholder="https://meet.google.com/..."
            icon={Video}
            value={eventForm.meeting_link}
            onChange={(e) => setEventForm({ ...eventForm, meeting_link: e.target.value })}
          />

          <div className="flex gap-3 justify-end pt-4">
            <CCButton variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={handleCreateEvent}
              loading={createEventMutation.isPending}
            >
              Create Event
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}