import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Download, Trash2, Plus } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import AvailabilityManager from '@/components/profile/AvailabilityManager';

export default function AvailabilitySchedule() {
  const [showManager, setShowManager] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (dates) => {
      return base44.entities.UserProfile.update(profiles[0].id, {
        availability_dates: dates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Availability updated');
    },
  });

  if (isLoading) return <CCLoadingScreen message="Loading availability..." />;

  const profile = profiles[0];
  const availabilityDates = profile?.availability_dates || [];

  const exportToCalendar = (type) => {
    const dates = availabilityDates.sort();
    if (dates.length === 0) {
      toast.error('No availability dates to export');
      return;
    }

    if (type === 'google') {
      const startDate = dates[0].replace(/-/g, '');
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Available+for+Collaborations&dates=${startDate}/${startDate}&details=I+am+available+for+collaborations`;
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

  const clearAllDates = () => {
    if (confirm('Are you sure you want to clear all availability dates?')) {
      updateAvailabilityMutation.mutate([]);
    }
  };

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group dates by month
  const datesByMonth = availabilityDates.reduce((acc, dateStr) => {
    const monthKey = format(new Date(dateStr), 'MMMM yyyy');
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(dateStr);
    return acc;
  }, {});

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
            onClick={() => setShowManager(true)}
            icon={Plus}
          >
            Update Availability
          </CCButton>
        </div>

        {/* Quick Actions */}
        <CCCard padding="lg">
          <div className="flex flex-wrap gap-3">
            <CCButton
              variant="outline"
              size="sm"
              onClick={() => exportToCalendar('google')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export to Google Calendar
            </CCButton>
            <CCButton
              variant="outline"
              size="sm"
              onClick={() => exportToCalendar('apple')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export to Apple Calendar
            </CCButton>
            {availabilityDates.length > 0 && (
              <CCButton
                variant="danger"
                size="sm"
                onClick={clearAllDates}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </CCButton>
            )}
          </div>
        </CCCard>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#4F8CFF]">{availabilityDates.length}</p>
            <p className="text-sm text-[#9AA6BC] mt-1">Total Days</p>
          </CCCard>
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#22C55E]">
              {Object.keys(datesByMonth).length}
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
              const isAvailable = availabilityDates.includes(dateStr);
              const isPast = date < new Date().setHours(0, 0, 0, 0);
              
              return (
                <div
                  key={dateStr}
                  className={`
                    aspect-square rounded-lg text-sm font-medium flex items-center justify-center
                    ${isPast ? 'text-[#3A4A6B]' : 'text-[#E8EEF9]'}
                    ${isAvailable ? 'bg-[#4F8CFF] text-white' : 'bg-[#151D2B]'}
                  `}
                >
                  {format(date, 'd')}
                </div>
              );
            })}
          </div>
        </CCCard>

        {/* Dates by Month */}
        {Object.keys(datesByMonth).length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#E8EEF9]">All Available Dates</h2>
            {Object.entries(datesByMonth).map(([month, dates]) => (
              <CCCard key={month} padding="lg">
                <h3 className="text-md font-semibold text-[#E8EEF9] mb-3">{month}</h3>
                <div className="flex flex-wrap gap-2">
                  {dates.sort().map(dateStr => (
                    <CCBadge key={dateStr} variant="primary">
                      {format(new Date(dateStr), 'EEE, MMM d')}
                    </CCBadge>
                  ))}
                </div>
              </CCCard>
            ))}
          </div>
        ) : (
          <CCCard padding="lg" className="text-center">
            <Calendar className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No availability dates set</p>
            <CCButton
              variant="primary"
              className="mt-4"
              onClick={() => setShowManager(true)}
            >
              Add Availability
            </CCButton>
          </CCCard>
        )}
      </div>

      {showManager && (
        <AvailabilityManager
          profile={profile}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  );
}