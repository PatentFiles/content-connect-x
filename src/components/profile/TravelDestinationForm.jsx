import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCSelect from '@/components/ui-custom/CCSelect';
import LocationSelector from '@/components/location/LocationSelector';
import { toast } from 'sonner';

export default function TravelDestinationForm({ onAdd }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [location, setLocation] = useState(null);
  const [time, setTime] = useState('12');
  const [amPm, setAmPm] = useState('PM');

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const selectDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if (!startDate) {
      setStartDate(dateStr);
    } else if (!endDate && new Date(dateStr) > new Date(startDate)) {
      setEndDate(dateStr);
    } else {
      setStartDate(dateStr);
      setEndDate(null);
    }
  };

  const handleAdd = () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (!location) {
      toast.error('Please select a location');
      return;
    }

    onAdd({
      start_date: startDate,
      end_date: endDate,
      location: `${location.city}, ${location.state}`,
      arrival_time: `${time}:00 ${amPm}`,
    });

    // Reset form
    setStartDate(null);
    setEndDate(null);
    setLocation(null);
    setTime('12');
    setAmPm('PM');
  };

  const previousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1));
  };

  return (
    <div className="p-4 rounded-lg bg-[#0B0F14] border border-[#263248] space-y-4">
      <h4 className="text-sm font-medium text-[#E8EEF9]">Add Destination</h4>
      
      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <CCButton variant="ghost" size="icon" onClick={previousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </CCButton>
          <h3 className="text-sm font-semibold text-[#E8EEF9]">
            {format(selectedMonth, 'MMMM yyyy')}
          </h3>
          <CCButton variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </CCButton>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-xs text-[#6B7A94] font-medium py-1">
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
                  aspect-square rounded text-xs font-medium transition-all
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
          <div className="text-xs text-[#9AA6BC] text-center mt-2">
            {endDate ? (
              <>Selected: {format(new Date(startDate), 'MMM d')} - {format(new Date(endDate), 'MMM d')}</>
            ) : (
              <>Start: {format(new Date(startDate), 'MMM d')} (select end date)</>
            )}
          </div>
        )}
      </div>

      {/* Location */}
      <div>
        <label className="text-xs font-medium text-[#E8EEF9] block mb-2">
          Location
        </label>
        <LocationSelector value={location} onChange={setLocation} />
      </div>

      {/* Arrival Time */}
      <div>
        <label className="text-xs font-medium text-[#E8EEF9] block mb-2">
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
        variant="primary"
        fullWidth
        onClick={handleAdd}
        disabled={!startDate || !endDate || !location}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add This Destination
      </CCButton>
    </div>
  );
}