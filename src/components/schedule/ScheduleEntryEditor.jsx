import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';

export default function ScheduleEntryEditor({ entry, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    location_city: '',
    location_region: '',
    location_country: '',
    status: 'AVAILABLE',
  });
  const [viewMonth, setViewMonth] = useState(new Date());

  useEffect(() => {
    if (entry) {
      setFormData({
        title: entry.title || '',
        start_date: entry.start_date || '',
        end_date: entry.end_date || '',
        start_time: entry.start_time || '',
        end_time: entry.end_time || '',
        location_city: entry.location_city || '',
        location_region: entry.location_region || '',
        location_country: entry.location_country || '',
        status: entry.status || 'AVAILABLE',
      });
      if (entry.start_date) setViewMonth(new Date(entry.start_date + 'T00:00:00'));
    } else {
      setFormData({
        title: '',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        location_city: '',
        location_region: '',
        location_country: '',
        status: 'AVAILABLE',
      });
    }
  }, [entry, isOpen]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const selectDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (!formData.start_date || (formData.start_date && formData.end_date)) {
      setFormData({ ...formData, start_date: dateStr, end_date: '' });
    } else if (new Date(dateStr) >= new Date(formData.start_date)) {
      setFormData({ ...formData, end_date: dateStr });
    } else {
      setFormData({ ...formData, start_date: dateStr, end_date: '' });
    }
  };

  const handleSubmit = () => {
    if (!formData.start_date || !formData.end_date) {
      toast.error('Please select start and end dates on the calendar');
      return;
    }
    onSave(formData);
  };

  return (
    <CCModal
      isOpen={isOpen}
      onClose={onClose}
      title={entry ? 'Edit Availability' : 'Add Availability'}
      size="lg"
    >
      <div className="space-y-4">
        <CCInput
          label="Title (Optional)"
          placeholder="e.g., Available for shoots"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />

        {/* Calendar Picker */}
        <div>
          <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
            Select Dates <span className="text-[#FF2DAA]">*</span>
          </label>
          <div className="bg-[#0B0F14] border border-[#263248] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <CCButton variant="ghost" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </CCButton>
              <span className="text-sm font-semibold text-[#E8EEF9]">
                {format(viewMonth, 'MMMM yyyy')}
              </span>
              <CCButton variant="ghost" size="icon" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </CCButton>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-[#6B7A94] font-medium py-1">{d}</div>
              ))}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {daysInMonth.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isPast = date < new Date().setHours(0, 0, 0, 0);
                const isStart = dateStr === formData.start_date;
                const isEnd = dateStr === formData.end_date;
                const isInRange = formData.start_date && formData.end_date &&
                  new Date(dateStr) > new Date(formData.start_date) &&
                  new Date(dateStr) < new Date(formData.end_date);
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isPast}
                    onClick={() => !isPast && selectDate(date)}
                    className={`aspect-square rounded text-xs font-medium transition-all
                      ${isPast ? 'text-[#3A4A6B] opacity-40 cursor-not-allowed' : ''}
                      ${isStart || isEnd ? 'bg-[#4F8CFF] text-white' : ''}
                      ${isInRange ? 'bg-[#4F8CFF]/30 text-[#E8EEF9]' : ''}
                      ${!isPast && !isStart && !isEnd && !isInRange ? 'text-[#E8EEF9] hover:bg-[#263248]' : ''}
                    `}
                  >
                    {format(date, 'd')}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-[#9AA6BC] text-center mt-2">
              {formData.start_date && formData.end_date ? (
                <span className="text-[#22C55E]">
                  {format(new Date(formData.start_date + 'T00:00:00'), 'MMM d')} → {format(new Date(formData.end_date + 'T00:00:00'), 'MMM d, yyyy')}
                </span>
              ) : formData.start_date ? (
                <>Start: {format(new Date(formData.start_date + 'T00:00:00'), 'MMM d')} — now select end date</>
              ) : (
                <>Click a date to start</>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CCInput
            label="Start Time (Optional)"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
          />
          <CCInput
            label="End Time (Optional)"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
          />
        </div>

        <CCInput
          label="City (Optional)"
          placeholder="e.g., Los Angeles"
          value={formData.location_city}
          onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <CCInput
            label="State/Region (Optional)"
            placeholder="e.g., CA"
            value={formData.location_region}
            onChange={(e) => setFormData({ ...formData, location_region: e.target.value })}
          />
          <CCInput
            label="Country (Optional)"
            placeholder="e.g., USA"
            value={formData.location_country}
            onChange={(e) => setFormData({ ...formData, location_country: e.target.value })}
          />
        </div>

        <CCSelect
          label="Status"
          options={[
            { value: 'AVAILABLE', label: 'Available' },
            { value: 'UNAVAILABLE', label: 'Unavailable' },
          ]}
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-4">
          <CCButton variant="outline" onClick={onClose}>Cancel</CCButton>
          <CCButton variant="primary" onClick={handleSubmit}>
            {entry ? 'Update' : 'Create'}
          </CCButton>
        </div>
      </div>
    </CCModal>
  );
}