import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MapPin, Trash2, Plus, Download, Calendar } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import TravelDateManager from '@/components/profile/TravelDateManager';

export default function TravelSchedule() {
  const [showManager, setShowManager] = useState(false);
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
  const travelDates = profile?.travel_dates || [];

  const deleteTravelDate = (index) => {
    if (confirm('Are you sure you want to delete this travel date?')) {
      const newTravelDates = travelDates.filter((_, i) => i !== index);
      updateTravelMutation.mutate(newTravelDates);
    }
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all travel dates?')) {
      updateTravelMutation.mutate([]);
    }
  };

  const exportToCalendar = (travel, type) => {
    if (type === 'google') {
      const startDate = travel.start_date.replace(/-/g, '');
      const endDate = travel.end_date.replace(/-/g, '');
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Travel+to+${encodeURIComponent(travel.location)}&dates=${startDate}/${endDate}&details=Arriving+at+${travel.arrival_time}`;
      window.open(url, '_blank');
    } else if (type === 'apple') {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Content Connect//Travel//EN
BEGIN:VEVENT
DTSTART:${travel.start_date.replace(/-/g, '')}
DTEND:${travel.end_date.replace(/-/g, '')}
SUMMARY:Travel to ${travel.location}
DESCRIPTION:Arriving at ${travel.arrival_time}
END:VEVENT
END:VCALENDAR`;
      
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `travel-${travel.location.replace(/[^a-z0-9]/gi, '-')}.ics`;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] p-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E8EEF9]">Travel Schedule</h1>
            <p className="text-sm text-[#9AA6BC] mt-1">
              Manage your travel destinations and dates
            </p>
          </div>
          <CCButton
            variant="primary"
            onClick={() => setShowManager(true)}
            icon={Plus}
          >
            Add Travel
          </CCButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#4F8CFF]">{travelDates.length}</p>
            <p className="text-sm text-[#9AA6BC] mt-1">Destinations</p>
          </CCCard>
          <CCCard padding="lg" className="text-center">
            <p className="text-3xl font-bold text-[#FF2DAA]">
              {travelDates.filter(t => new Date(t.start_date) > new Date()).length}
            </p>
            <p className="text-sm text-[#9AA6BC] mt-1">Upcoming</p>
          </CCCard>
        </div>

        {/* Quick Actions */}
        {travelDates.length > 0 && (
          <CCCard padding="lg">
            <CCButton
              variant="danger"
              size="sm"
              onClick={clearAll}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Travel Dates
            </CCButton>
          </CCCard>
        )}

        {/* Travel List */}
        {travelDates.length > 0 ? (
          <div className="space-y-4">
            {travelDates
              .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
              .map((travel, idx) => {
                const isPast = new Date(travel.end_date) < new Date();
                return (
                  <CCCard key={idx} padding="lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${isPast ? 'bg-[#3A4A6B]/20' : 'bg-[#4F8CFF]/20'}`}>
                          <MapPin className={`w-6 h-6 ${isPast ? 'text-[#6B7A94]' : 'text-[#4F8CFF]'}`} />
                        </div>
                        <div>
                          <h3 className={`text-lg font-semibold ${isPast ? 'text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>
                            {travel.location}
                          </h3>
                          <p className="text-sm text-[#9AA6BC] mt-1">
                            {format(new Date(travel.start_date), 'EEE, MMM d')} - {format(new Date(travel.end_date), 'EEE, MMM d, yyyy')}
                          </p>
                          {travel.arrival_time && (
                            <p className="text-xs text-[#6B7A94] mt-1">
                              Arrives: {travel.arrival_time}
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
                          onClick={() => exportToCalendar(travel, 'google')}
                        >
                          <Calendar className="w-4 h-4" />
                        </CCButton>
                        <CCButton
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTravelDate(idx)}
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
  );
}