import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Download, Trash2, Plus, CheckSquare, XSquare } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import ScheduleEntryCard from '@/components/schedule/ScheduleEntryCard';
import ScheduleEntryEditor from '@/components/schedule/ScheduleEntryEditor';

export default function AvailabilitySchedule() {
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['scheduleEntries', user?.email],
    queryFn: () => base44.entities.ScheduleEntry.filter({ 
      user_id: user?.email,
    }),
    enabled: !!user?.email,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduleEntry.create({
      user_id: user.email,
      entry_type: 'AVAILABILITY',
      source: 'MANUAL',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] });
      toast.success('Availability added');
      setShowEditor(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduleEntry.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] });
      toast.success('Availability updated');
      setShowEditor(false);
      setEditingEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleEntry.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] });
      toast.success('Availability deleted');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, data }) => {
      await Promise.all(ids.map(id => base44.entities.ScheduleEntry.update(id, data)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] });
      setSelectedEntries([]);
      toast.success('Entries updated');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.ScheduleEntry.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] });
      setSelectedEntries([]);
      toast.success('Entries deleted');
    },
  });

  if (isLoading) return <CCLoadingScreen message="Loading schedule..." />;

  const availabilityEntries = entries.filter(e => 
    e.entry_type === 'AVAILABILITY' || 
    e.entry_type === 'BOOKING' || 
    e.entry_type === 'EXTERNAL_BUSY'
  );

  const handleDelete = (id) => {
    if (confirm('Delete this availability entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowEditor(true);
  };

  const handleSave = (data) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSelect = (id, checked) => {
    setSelectedEntries(prev => 
      checked ? [...prev, id] : prev.filter(eid => eid !== id)
    );
  };

  const handleSelectAll = () => {
    const manualEntries = availabilityEntries.filter(e => 
      e.source === 'MANUAL' && !e.is_locked
    );
    setSelectedEntries(manualEntries.map(e => e.id));
  };

  const handleDeselectAll = () => {
    setSelectedEntries([]);
  };

  const handleBulkMarkUnavailable = () => {
    if (confirm(`Mark ${selectedEntries.length} entries as unavailable?`)) {
      bulkUpdateMutation.mutate({ 
        ids: selectedEntries, 
        data: { status: 'UNAVAILABLE' } 
      });
    }
  };

  const handleBulkDelete = () => {
    const manualSelected = selectedEntries.filter(id => {
      const entry = availabilityEntries.find(e => e.id === id);
      return entry?.source === 'MANUAL' && !entry?.is_locked;
    });
    
    if (manualSelected.length === 0) {
      toast.error('No manual entries selected');
      return;
    }

    if (confirm(`Delete ${manualSelected.length} entries?`)) {
      bulkDeleteMutation.mutate(manualSelected);
    }
  };

  const exportToCalendar = (type) => {
    const dates = availabilityEntries
      .filter(e => e.status === 'AVAILABLE')
      .map(e => e.start_date)
      .sort();
    
    if (dates.length === 0) {
      toast.error('No available dates to export');
      return;
    }

    if (type === 'google') {
      const startDate = dates[0].replace(/-/g, '');
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Available+for+Collaborations&dates=${startDate}/${startDate}`;
      window.open(url, '_blank');
    } else if (type === 'apple') {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Content Connect//Availability//EN
${dates.map(date => `BEGIN:VEVENT
DTSTART:${date.replace(/-/g, '')}
DTEND:${date.replace(/-/g, '')}
SUMMARY:Available for Collaborations
END:VEVENT`).join('\n')}
END:VCALENDAR`;
      
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'availability.ics';
      link.click();
    }
  };

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const entriesByMonth = availabilityEntries.reduce((acc, entry) => {
    const monthKey = format(new Date(entry.start_date), 'MMMM yyyy');
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(entry);
    return acc;
  }, {});

  const getDayEntries = (dateStr) => {
    return availabilityEntries.filter(entry => {
      const entryStart = new Date(entry.start_date);
      const entryEnd = new Date(entry.end_date);
      const currentDate = new Date(dateStr);
      return currentDate >= entryStart && currentDate <= entryEnd;
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] p-6 pb-24 md:pb-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E8EEF9]">Availability Schedule</h1>
            <p className="text-sm text-[#9AA6BC] mt-1">
              Manage your availability for collaborations
            </p>
          </div>
          <CCButton
            variant="primary"
            onClick={() => {
              setEditingEntry(null);
              setShowEditor(true);
            }}
            icon={Plus}
          >
            Add Availability
          </CCButton>
        </div>

        {/* Bulk Actions */}
        {selectedEntries.length > 0 && (
          <CCCard padding="md" className="bg-[#1A2438] border-[#4F8CFF]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#E8EEF9]">
                {selectedEntries.length} selected
              </p>
              <div className="flex items-center gap-2">
                <CCButton
                  variant="outline"
                  size="sm"
                  onClick={handleBulkMarkUnavailable}
                >
                  Mark Unavailable
                </CCButton>
                <CCButton
                  variant="danger"
                  size="sm"
                  onClick={handleBulkDelete}
                  icon={Trash2}
                >
                  Delete Selected
                </CCButton>
                <CCButton
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                >
                  Clear
                </CCButton>
              </div>
            </div>
          </CCCard>
        )}

        {/* Quick Actions */}
        <CCCard padding="lg">
          <div className="flex flex-wrap gap-3">
            <CCButton
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              icon={CheckSquare}
            >
              Select All Manual
            </CCButton>
            <CCButton
              variant="outline"
              size="sm"
              onClick={() => exportToCalendar('google')}
              icon={Download}
            >
              Export to Google Calendar
            </CCButton>
            <CCButton
              variant="outline"
              size="sm"
              onClick={() => exportToCalendar('apple')}
              icon={Download}
            >
              Export to Apple Calendar
            </CCButton>
          </div>
        </CCCard>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#4F8CFF]">{availabilityEntries.length}</p>
            <p className="text-sm text-[#9AA6BC] mt-1">Total Entries</p>
          </CCCard>
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#22C55E]">
              {availabilityEntries.filter(e => e.status === 'AVAILABLE').length}
            </p>
            <p className="text-sm text-[#9AA6BC] mt-1">Available</p>
          </CCCard>
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#F59E0B]">
              {availabilityEntries.filter(e => e.entry_type === 'BOOKING').length}
            </p>
            <p className="text-sm text-[#9AA6BC] mt-1">Booked</p>
          </CCCard>
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#9AA6BC]">
              {Object.keys(entriesByMonth).length}
            </p>
            <p className="text-sm text-[#9AA6BC] mt-1">Months</p>
          </CCCard>
        </div>

        {/* Calendar View */}
        <CCCard padding="lg">
          <div className="flex items-center justify-between mb-6">
            <CCButton variant="ghost" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
              <ChevronLeft className="w-5 h-5" />
            </CCButton>
            <h2 className="text-xl font-semibold text-[#E8EEF9]">
              {format(viewMonth, 'MMMM yyyy')}
            </h2>
            <CCButton variant="ghost" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
              <ChevronRight className="w-5 h-5" />
            </CCButton>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm text-[#6B7A94] font-medium py-2">
                {day}
              </div>
            ))}
            
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {daysInMonth.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayEntries = getDayEntries(dateStr);
              const hasAvailable = dayEntries.some(e => e.status === 'AVAILABLE');
              const hasBooked = dayEntries.some(e => e.entry_type === 'BOOKING');
              const isPast = date < new Date().setHours(0, 0, 0, 0);
              
              return (
                <div
                  key={dateStr}
                  className={`
                    aspect-square rounded-lg text-sm font-medium flex items-center justify-center relative
                    ${isPast ? 'text-[#3A4A6B]' : 'text-[#E8EEF9]'}
                    ${hasBooked ? 'bg-[#F59E0B]' : hasAvailable ? 'bg-[#4F8CFF]' : 'bg-[#151D2B]'}
                    ${hasBooked || hasAvailable ? 'text-white' : ''}
                  `}
                  title={dayEntries.map(e => e.title || e.entry_type).join(', ')}
                >
                  {format(date, 'd')}
                  {dayEntries.length > 1 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        </CCCard>

        {/* Entries by Month */}
        {Object.keys(entriesByMonth).length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#E8EEF9]">All Entries</h2>
            {Object.entries(entriesByMonth)
              .sort((a, b) => new Date(a[1][0].start_date) - new Date(b[1][0].start_date))
              .map(([month, monthEntries]) => (
              <div key={month} className="space-y-3">
                <h3 className="text-md font-semibold text-[#9AA6BC]">{month}</h3>
                <div className="space-y-3">
                  {monthEntries
                    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                    .map(entry => (
                    <ScheduleEntryCard
                      key={entry.id}
                      entry={entry}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isSelected={selectedEntries.includes(entry.id)}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <CCCard padding="lg" className="text-center">
            <Calendar className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No availability entries</p>
            <CCButton
              variant="primary"
              className="mt-4"
              onClick={() => {
                setEditingEntry(null);
                setShowEditor(true);
              }}
            >
              Add Availability
            </CCButton>
          </CCCard>
        )}
      </div>

      <ScheduleEntryEditor
        entry={editingEntry}
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditingEntry(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}