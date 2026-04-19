import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { MapPin, Trash2, Plus, Download, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import TravelDateManager from '@/components/profile/TravelDateManager';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';

export default function TravelSchedule() {
  const [showManager, setShowManager] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [monthCache, setMonthCache] = useState({});
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
  const cacheKey = `${user?.email}-${monthStartStr}`;

  const { data: travelEntries = [], isLoading } = useQuery({
    queryKey: ['travelEntries', user?.email, monthStartStr],
    queryFn: async () => {
      const allEntries = await base44.entities.ScheduleEntry.filter({ 
        user_id: user?.email,
        entry_type: 'TRAVEL',
      });
      const filtered = allEntries.filter(entry => {
        const entryStart = entry.start_date;
        const entryEnd = entry.end_date;
        return (entryStart >= monthStartStr && entryStart <= monthEndStr) ||
               (entryEnd >= monthStartStr && entryEnd <= monthEndStr) ||
               (entryStart <= monthStartStr && entryEnd >= monthEndStr);
      });
      
      setMonthCache(prev => {
        const newCache = { ...prev, [cacheKey]: filtered };
        const keys = Object.keys(newCache);
        if (keys.length > 2) {
          const oldestKey = keys[0];
          delete newCache[oldestKey];
        }
        return newCache;
      });
      
      return filtered;
    },
    enabled: !!user?.email,
    initialData: () => monthCache[cacheKey],
    staleTime: 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const updateTravelMutation = useMutation({
    mutationFn: async (travelDates) => {
      return base44.entities.UserProfile.update(profiles[0].id, {
        travel_dates: travelDates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Travel schedule updated');
    },
  });

  if (isLoading) return <CCLoadingScreen message="Loading travel schedule..." />;

  const profile = profiles[0];
    if (confirm('Are you sure you want to delete this travel entry?')) {
      base44.entities.ScheduleEntry.delete(id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['travelEntries'] });
        toast.success('Travel entry deleted');
      });
    }
  };

  const exportToCalendar = (entry, type) => {
    const location = entry.location_city || entry.title || 'Destination';
    if (type === 'google') {
      const startDate = entry.start_date.replace(/-/g, '');
      const endDate = entry.end_date.replace(/-/g, '');
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Travel+to+${encodeURIComponent(location)}&dates=${startDate}/${endDate}`;
      window.open(url, '_blank');
    } else if (type === 'apple') {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Content Connect//Travel//EN
BEGIN:VEVENT
DTSTART:${entry.start_date.replace(/-/g, '')}
DTEND:${entry.end_date.replace(/-/g, '')}
SUMMARY:Travel to ${location}
END:VEVENT
END:VCALENDAR`;
      
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `travel-${location.replace(/[^a-z0-9]/gi, '-')}.ics`;
      link.click();
    }
  };

  const deleteTravelEntry = (id) => {
    if (confirm('Are you sure you want to delete this travel entry?')) {
      base44.entities.ScheduleEntry.delete(id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['travelEntries'] });
        toast.success('Travel entry deleted');
      });
    }
  };

  return (
    <FeatureRouteGuard flag="travel_schedule" requiresSubscription={true}>
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#E8EEF9]">Travel Schedule</h1>
          <p className="text-sm text-[#9AA6BC] mt-2">
            Manage your travel destinations and dates
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <div></div>
          <CCButton
            variant="primary"
            onClick={() => setShowManager(true)}
            icon={Plus}
          >
            Add Travel
          </CCButton>
        </div>

        {/* Month Navigation */}
        <CCCard padding="lg">
          <div className="flex items-center justify-between">
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
        </CCCard>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#4F8CFF]">{travelEntries.length}</p>
            <p className="text-sm text-[#9AA6BC] mt-1">This Month</p>
          </CCCard>
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#FF2DAA]">
              {travelEntries.filter(t => new Date(t.start_date) > new Date()).length}
            </p>
            <p className="text-sm text-[#9AA6BC] mt-1">Upcoming</p>
          </CCCard>
        </div>

        {/* Travel List */}
        {travelEntries.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#E8EEF9]">
              {format(viewMonth, 'MMMM yyyy')} Travel
            </h2>
            {travelEntries
              .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
              .map((entry) => {
                const isPast = new Date(entry.end_date) < new Date();
                const location = entry.location_city || entry.title || 'Destination';
                return (
                  <CCCard key={entry.id} padding="lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${isPast ? 'bg-[#3A4A6B]/20' : 'bg-[#4F8CFF]/20'}`}>
                          <MapPin className={`w-6 h-6 ${isPast ? 'text-[#6B7A94]' : 'text-[#4F8CFF]'}`} />
                        </div>
                        <div>
                          <h3 className={`text-lg font-semibold ${isPast ? 'text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>
                            {location}
                          </h3>
                          <p className="text-sm text-[#9AA6BC] mt-1">
                            {format(new Date(entry.start_date), 'EEE, MMM d')} - {format(new Date(entry.end_date), 'EEE, MMM d, yyyy')}
                          </p>
                          {entry.start_time && (
                            <p className="text-xs text-[#6B7A94] mt-1">
                              Arrives: {entry.start_time}
                            </p>
                          )}
                          {isPast && (
                            <p className="text-xs text-[#6B7A94] mt-2 italic">Past trip</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CCButton
                          variant="outline"
                          size="sm"
                          onClick={() => exportToCalendar(entry, 'google')}
                        >
                          <Calendar className="w-4 h-4" />
                        </CCButton>
                        <CCButton
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTravelEntry(entry.id)}
                        >
                          <Trash2 className="w-4 h-4 text-[#EF4444]" />
                        </CCButton>
                      </div>
                    </div>
                  </CCCard>
                );
              })}
          </div>
        ) : (
          <CCCard padding="lg" className="text-center">
            <MapPin className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No travel dates scheduled</p>
            <CCButton
              variant="primary"
              className="mt-4"
              onClick={() => setShowManager(true)}
            >
              Add Travel Destination
            </CCButton>
          </CCCard>
        )}
      </div>

      {showManager && (
        <TravelDateManager
          profile={profile}
          onClose={() => setShowManager(false)}
        />
      )}
      </div>
    </FeatureRouteGuard>
  );
}