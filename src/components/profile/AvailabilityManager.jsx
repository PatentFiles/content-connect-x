import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import CCCard from '@/components/ui-custom/CCCard';

export default function AvailabilityManager({ profile, onClose }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState(profile?.availability_dates || []);
  const queryClient = useQueryClient();

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (dates) => {
      return base44.entities.UserProfile.update(profile.id, {
        availability_dates: dates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Availability updated');
      onClose();
    },
  });

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const toggleDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const exists = selectedDates.includes(dateStr);
    
    if (exists) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
  };

  const handleSave = () => {
    updateAvailabilityMutation.mutate(selectedDates);
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
      title="Update Availability"
      description="Select the dates you're available for collaborations"
      size="lg"
    >
      <div className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <CCButton
            variant="ghost"
            size="icon"
            onClick={previousMonth}
          >
            <ChevronLeft className="w-4 h-4" />
          </CCButton>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">
            {format(selectedMonth, 'MMMM yyyy')}
          </h3>
          <CCButton
            variant="ghost"
            size="icon"
            onClick={nextMonth}
          >
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
          
          {/* Empty cells for alignment */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          
          {/* Date cells */}
          {daysInMonth.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSelected = selectedDates.includes(dateStr);
            const isPast = date < new Date().setHours(0, 0, 0, 0);
            
            return (
              <button
                key={dateStr}
                onClick={() => !isPast && toggleDate(date)}
                disabled={isPast}
                className={`
                  aspect-square rounded-lg text-sm font-medium transition-all
                  ${isPast ? 'text-[#3A4A6B] cursor-not-allowed' : 'hover:bg-[#263248]'}
                  ${isSelected ? 'bg-[#4F8CFF] text-white' : 'text-[#E8EEF9]'}
                `}
              >
                {format(date, 'd')}
              </button>
            );
          })}
        </div>

        {/* Selected Dates Preview */}
        {selectedDates.length > 0 && (
          <CCCard className="bg-[#0B0F14]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#E8EEF9]">
                Selected Dates ({selectedDates.length})
              </span>
              <CCButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDates([])}
              >
                Clear All
              </CCButton>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedDates.sort().slice(0, 10).map(dateStr => (
                <div
                  key={dateStr}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#263248] text-xs text-[#E8EEF9]"
                >
                  {format(new Date(dateStr), 'MMM d')}
                  <button
                    onClick={() => setSelectedDates(selectedDates.filter(d => d !== dateStr))}
                    className="hover:text-[#FF2DAA]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {selectedDates.length > 10 && (
                <span className="text-xs text-[#6B7A94]">
                  +{selectedDates.length - 10} more
                </span>
              )}
            </div>
          </CCCard>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <CCButton
            variant="outline"
            fullWidth
            onClick={onClose}
          >
            Cancel
          </CCButton>
          <CCButton
            variant="primary"
            fullWidth
            onClick={handleSave}
            loading={updateAvailabilityMutation.isPending}
          >
            Save Availability
          </CCButton>
        </div>
      </div>
    </CCModal>
  );
}