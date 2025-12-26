import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCButton from '@/components/ui-custom/CCButton';

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

  useEffect(() => {
    if (entry) {
      setFormData({
        title: entry.title || '',
        start_date: entry.start_date,
        end_date: entry.end_date,
        start_time: entry.start_time || '',
        end_time: entry.end_time || '',
        location_city: entry.location_city || '',
        location_region: entry.location_region || '',
        location_country: entry.location_country || '',
        status: entry.status,
      });
    }
  }, [entry]);

  const handleSubmit = () => {
    if (!formData.start_date || !formData.end_date) {
      toast.error('Start and end dates are required');
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error('End date must be after start date');
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

        <div className="grid grid-cols-2 gap-4">
          <CCInput
            label="Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
          <CCInput
            label="End Date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
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
          <CCButton variant="outline" onClick={onClose}>
            Cancel
          </CCButton>
          <CCButton variant="primary" onClick={handleSubmit}>
            {entry ? 'Update' : 'Create'}
          </CCButton>
        </div>
      </div>
    </CCModal>
  );
}