import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, Plus, X } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';
import LocationSelector from '@/components/location/LocationSelector';

export default function TravelDateManager({ profile, onClose }) {
  const [step, setStep] = useState('dates');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [time, setTime] = useState('12');
  const [amPm, setAmPm] = useState('PM');
  const queryClient = useQueryClient();

  const addTravelDateMutation = useMutation({
    mutationFn: async (travelDates) => {
      const currentTravelDates = profile?.travel_dates || [];
      return base44.entities.UserProfile.update(profile.id, {
        travel_dates: [...currentTravelDates, ...travelDates],
        travel_enabled: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Travel dates added');
      onClose();
    },
  });

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const selectDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if (!startDate) {
      setStartDate(dateStr);
    } else if (!endDate && new Date(dateStr) > new Date(startDate)) {
      setEndDate(dateStr);
      setStep('location');
    } else {
      // Reset selection
      setStartDate(dateStr);
      setEndDate(null);
    }
  };

  const handleAddDestination = () => {
    if (!currentLocation) {
      toast.error('Please select a location');
      return;
    }

    setDestinations([
      ...destinations,
      {
        location: `${currentLocation.city}, ${currentLocation.state}`,
        arrival_time: `${time}:00 ${amPm}`,
      }
    ]);
    setCurrentLocation(null);
    setTime('12');
    setAmPm('PM');
  };

  const handleRemoveDestination = (index) => {
    setDestinations(destinations.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      toast.error('Please select travel dates');
      return;
    }

    if (destinations.length === 0) {
      toast.error('Please add at least one destination');
      return;
    }

    const travelDates = destinations.map(dest => ({
      start_date: startDate,
      end_date: endDate,
      location: dest.location,
      arrival_time: dest.arrival_time,
    }));

    addTravelDateMutation.mutate(travelDates);
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1));
  };

  return (
    <CCModal
      isOpen={true}
      onClose={onClose}
      title={step === 'dates' ? 'Select Travel Dates' : 'Add Location & Time'}
      description={step === 'dates' ? 'Select start and end dates for your travel' : 'Where and when will you arrive?'}
      size="lg"
    >
      {step === 'dates' ? (
        <div className="space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <CCButton variant="ghost" size="icon" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </CCButton>
            <h3 className="text-lg font-semibold text-[#E8EEF9]">
              {format(selectedMonth, 'MMMM yyyy')}
            </h3>
            <CCButton variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </CCButton>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-[#6B7A94] font-medium py-2">
                {day}
              </div>
            ))}
            
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {daysInMonth.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const isStart = dateStr === startDate;
              const isEnd = dateStr === endDate;
              const isInRange = startDate && endDate && 
                new Date(dateStr) > new Date(startDate) && 
                new Date(dateStr) < new Date(endDate);
              const isPast = date < new Date().setHours(0, 0, 0, 0);
              
              return (
                <button
                  key={dateStr}
                  onClick={() => !isPast && selectDate(date)}
                  disabled={isPast}
                  className={`
                    aspect-square rounded-lg text-sm font-medium transition-all
                    ${isPast ? 'text-[#3A4A6B] cursor-not-allowed' : 'hover:bg-[#263248]'}
                    ${isStart || isEnd ? 'bg-[#4F8CFF] text-white' : ''}
                    ${isInRange ? 'bg-[#4F8CFF]/30 text-[#E8EEF9]' : 'text-[#E8EEF9]'}
                  `}
                >
                  {format(date, 'd')}
                </button>
              );
            })}
          </div>

          {startDate && (
            <div className="text-sm text-[#9AA6BC] text-center">
              {endDate ? (
                <>Selected: {format(new Date(startDate), 'MMM d')} - {format(new Date(endDate), 'MMM d')}</>
              ) : (
                <>Start: {format(new Date(startDate), 'MMM d')} (select end date)</>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected Date Range */}
          <div className="p-3 rounded-lg bg-[#0B0F14] border border-[#263248]">
            <p className="text-sm text-[#9AA6BC]">Travel Dates</p>
            <p className="text-[#E8EEF9] font-medium">
              {format(new Date(startDate), 'MMM d')} - {format(new Date(endDate), 'MMM d, yyyy')}
            </p>
          </div>

          {/* Added Destinations */}
          {destinations.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#E8EEF9]">
                Destinations ({destinations.length})
              </label>
              {destinations.map((dest, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#0B0F14] border border-[#263248]">
                  <div>
                    <p className="text-sm font-medium text-[#E8EEF9]">{dest.location}</p>
                    <p className="text-xs text-[#9AA6BC]">Arrives: {dest.arrival_time}</p>
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

          {/* Add Destination Form */}
          <div className="p-4 rounded-lg bg-[#0B0F14] border border-[#263248] space-y-3">
            <label className="text-sm font-medium text-[#E8EEF9] block">
              Add Destination
            </label>
            
            <LocationSelector
              value={currentLocation}
              onChange={setCurrentLocation}
            />

            <div>
              <label className="text-sm font-medium text-[#E8EEF9] block mb-2">
                Arrival Time
              </label>
              <div className="grid grid-cols-2 gap-3">
                <CCSelect
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  }))}
                />
                <CCSelect
                  value={amPm}
                  onChange={(e) => setAmPm(e.target.value)}
                  options={[
                    { value: 'AM', label: 'AM' },
                    { value: 'PM', label: 'PM' },
                  ]}
                />
              </div>
            </div>

            <CCButton
              variant="outline"
              fullWidth
              onClick={handleAddDestination}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add This Destination
            </CCButton>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <CCButton
              variant="outline"
              fullWidth
              onClick={() => setStep('dates')}
            >
              Back
            </CCButton>
            <CCButton
              variant="primary"
              fullWidth
              onClick={handleSubmit}
              loading={addTravelDateMutation.isPending}
              disabled={destinations.length === 0}
            >
              Save Travel Plan
            </CCButton>
          </div>
        </div>
      )}
    </CCModal>
  );
}