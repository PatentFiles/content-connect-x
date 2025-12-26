import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';
import LocationSelector from '@/components/location/LocationSelector';

export default function TravelDateManager({ profile, onClose }) {
  const [step, setStep] = useState('dates');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [location, setLocation] = useState(null);
  const [time, setTime] = useState('12');
  const [amPm, setAmPm] = useState('PM');
  const queryClient = useQueryClient();

  const addTravelDateMutation = useMutation({
    mutationFn: async (travelDate) => {
      const currentTravelDates = profile?.travel_dates || [];
      return base44.entities.UserProfile.update(profile.id, {
        travel_dates: [...currentTravelDates, travelDate],
        travel_enabled: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Travel date added');
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

  const handleSubmit = () => {
    if (!startDate || !endDate || !location) {
      toast.error('Please fill in all fields');
      return;
    }

    const travelDate = {
      start_date: startDate,
      end_date: endDate,
      location: `${location.city}, ${location.state}`,
      arrival_time: `${time}:00 ${amPm}`,
    };

    addTravelDateMutation.mutate(travelDate);
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
          {/* Location */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">
              Travel Location
            </label>
            <LocationSelector
              value={location}
              onChange={setLocation}
            />
          </div>

          {/* Arrival Time */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#E8EEF9]">
              Arrival Time
            </label>
            <div className="grid grid-cols-2 gap-4">
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
            >
              Add Travel Date
            </CCButton>
          </div>
        </div>
      )}
    </CCModal>
  );
}