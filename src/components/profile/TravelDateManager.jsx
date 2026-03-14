import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import TravelDestinationForm from './TravelDestinationForm';

export default function TravelDateManager({ profile, onClose }) {
  const [destinations, setDestinations] = useState([]);
  const queryClient = useQueryClient();

  // Save each destination as a ScheduleEntry with entry_type TRAVEL
  const addTravelDatesMutation = useMutation({
    mutationFn: async (travelDates) => {
      await Promise.all(
        travelDates.map(dest =>
          base44.entities.ScheduleEntry.create({
            user_id: profile.user_id,
            entry_type: 'TRAVEL',
            source: 'MANUAL',
            title: dest.location,
            location_city: dest.location.split(',')[0]?.trim() || dest.location,
            location_region: dest.location.split(',')[1]?.trim() || '',
            start_date: dest.start_date,
            end_date: dest.end_date,
            start_time: dest.arrival_time,
            status: 'AVAILABLE',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        )
      );
      // Also update UserProfile travel_enabled
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, { travel_enabled: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travelEntries'] });
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Travel dates saved');
      onClose();
    },
  });

  const handleAddDestination = (destination) => {
    setDestinations([...destinations, destination]);
  };

  const handleRemoveDestination = (index) => {
    setDestinations(destinations.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (destinations.length === 0) {
      toast.error('Please add at least one destination');
      return;
    }
    addTravelDatesMutation.mutate(destinations);
  };

  return (
    <CCModal
      isOpen={true}
      onClose={onClose}
      title="Add Travel Destinations"
      description="Add your travel destinations with dates and times"
      size="lg"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {destinations.length > 0 && (
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">
              Destinations ({destinations.length})
            </label>
            {destinations.map((dest, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#121824] border border-[#263248] mb-2">
                <div>
                  <p className="text-sm font-medium text-[#E8EEF9]">{dest.location}</p>
                  <p className="text-xs text-[#9AA6BC]">
                    {format(new Date(dest.start_date + 'T00:00:00'), 'MMM d')} - {format(new Date(dest.end_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-[#6B7A94]">Arrives: {dest.arrival_time}</p>
                </div>
                <button
                  onClick={() => handleRemoveDestination(idx)}
                  className="text-[#6B7A94] hover:text-[#FF2DAA] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <TravelDestinationForm onAdd={handleAddDestination} />

        <div className="flex gap-3 sticky bottom-0 bg-[#151D2B] pt-4 border-t border-[#263248]">
          <CCButton variant="outline" fullWidth onClick={onClose}>Cancel</CCButton>
          <CCButton
            variant="primary"
            fullWidth
            onClick={handleSubmit}
            loading={addTravelDatesMutation.isPending}
            disabled={destinations.length === 0}
          >
            Save Travel Plan
          </CCButton>
        </div>
      </div>
    </CCModal>
  );
}