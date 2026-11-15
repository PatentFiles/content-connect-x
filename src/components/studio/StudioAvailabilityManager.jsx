/**
 * StudioAvailabilityManager
 *
 * Lets studios publish and manage AVAILABILITY windows with studio-specific
 * context: room label, equipment/features, booking notes/conditions, address.
 * Reuses the existing ScheduleEntry entity — no new schema created.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO, isAfter, startOfToday } from 'date-fns';
import {
  Plus, Pencil, Trash2, Building2, Clock, MapPin, FileText
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney',
];

const EQUIPMENT_OPTIONS = [
  'Professional Lighting Rig', '4K Cameras', 'Green Screen', 'Cyclorama Wall',
  'Audio Recording', 'Multiple Sets', 'Dressing Room', 'Production Crew Available',
  'Makeup Artist Available', 'Catering On-Site', 'Parking Available', 'Private Entrance',
];

function AvailabilityForm({ entry, userId, onSave, onClose }) {
  const [form, setForm] = useState({
    title: entry?.title || '',
    start_date: entry?.start_date || '',
    end_date: entry?.end_date || '',
    start_time: entry?.start_time || '',
    end_time: entry?.end_time || '',
    room_label: entry?.room_label || '',
    location_name: entry?.location_name || '',
    location_address: entry?.location_address || '',
    location_city: entry?.location_city || '',
    location_region: entry?.location_region || '',
    booking_notes: entry?.booking_notes || '',
    equipment_features: entry?.equipment_features || [],
    max_bookings: entry?.max_bookings || 1,
    timezone: entry?.timezone || 'America/New_York',
  });

  const toggleEquipment = (item) => {
    setForm(f => ({
      ...f,
      equipment_features: f.equipment_features.includes(item)
        ? f.equipment_features.filter(e => e !== item)
        : [...f.equipment_features, item],
    }));
  };

  const handleSubmit = () => {
    if (!form.start_date || !form.end_date) {
      toast.error('Start and end dates are required');
      return;
    }
    onSave({
      ...form,
      user_id: userId,
      entry_type: 'AVAILABILITY',
      status: 'AVAILABLE',
      source: 'MANUAL',
      location_type: 'STUDIO',
      max_bookings: parseInt(form.max_bookings) || 1,
    });
  };

  return (
    <div className="space-y-4">
      <CCInput
        label="Window Title (Optional)"
        placeholder="e.g., Spring Shoot Availability"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <CCInput
          label="Start Date *"
          type="date"
          value={form.start_date}
          onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: e.target.value }))}
        />
        <CCInput
          label="End Date *"
          type="date"
          value={form.end_date}
          onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CCInput
          label="Start Time (optional)"
          type="time"
          value={form.start_time}
          onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
        />
        <CCInput
          label="End Time (optional)"
          type="time"
          value={form.end_time}
          onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#E8EEF9] mb-1">Timezone</label>
        <select
          value={form.timezone}
          onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none"
        >
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      <div className="border-t border-[#263248] pt-4">
        <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wider mb-3">Studio Details</p>

        <CCInput
          label="Room / Set Label"
          placeholder="e.g., Main Set A, Cyc Room, Suite 2"
          value={form.room_label}
          onChange={e => setForm(f => ({ ...f, room_label: e.target.value }))}
        />
      </div>

      <CCInput
        label="Location / Venue Name"
        placeholder="e.g., Studio West LA"
        value={form.location_name}
        onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
      />

      <CCInput
        label="Address"
        placeholder="123 Main St"
        value={form.location_address}
        onChange={e => setForm(f => ({ ...f, location_address: e.target.value }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <CCInput
          label="City"
          placeholder="Los Angeles"
          value={form.location_city}
          onChange={e => setForm(f => ({ ...f, location_city: e.target.value }))}
        />
        <CCInput
          label="State / Region"
          placeholder="CA"
          value={form.location_region}
          onChange={e => setForm(f => ({ ...f, location_region: e.target.value }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Equipment & Features</label>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => toggleEquipment(item)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                form.equipment_features.includes(item)
                  ? 'bg-[#4F8CFF] border-[#4F8CFF] text-white'
                  : 'bg-transparent border-[#263248] text-[#9AA6BC] hover:border-[#4F8CFF]/50'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          className="mt-2 w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-xs text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none"
          placeholder="Add custom feature…"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              setForm(f => ({ ...f, equipment_features: [...f.equipment_features, e.target.value.trim()] }));
              e.target.value = '';
            }
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#E8EEF9] mb-1">Booking Notes / Conditions</label>
        <textarea
          rows={3}
          value={form.booking_notes}
          onChange={e => setForm(f => ({ ...f, booking_notes: e.target.value }))}
          placeholder="e.g., 50% deposit required. No-show policy: 24h cancellation window."
          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#E8EEF9] mb-1">Max Simultaneous Bookings</label>
        <input
          type="number"
          min={1}
          max={10}
          value={form.max_bookings}
          onChange={e => setForm(f => ({ ...f, max_bookings: e.target.value }))}
          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none"
        />
        <p className="text-xs text-[#6B7A94] mt-1">How many bookings can be accepted for this window (usually 1)</p>
      </div>

      <div className="flex gap-3 pt-2">
        <CCButton variant="outline" fullWidth onClick={onClose}>Cancel</CCButton>
        <CCButton variant="primary" fullWidth onClick={handleSubmit}>
          {entry ? 'Update Window' : 'Publish Window'}
        </CCButton>
      </div>
    </div>
  );
}

export default function StudioAvailabilityManager({ userId }) {
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const queryClient = useQueryClient();
  const today = startOfToday();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['studioAvailability', userId],
    queryFn: () => base44.entities.ScheduleEntry.filter({
      user_id: userId,
      entry_type: 'AVAILABILITY',
    }),
    enabled: !!userId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editEntry
      ? base44.entities.ScheduleEntry.update(editEntry.id, data)
      : base44.entities.ScheduleEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studioAvailability', userId] });
      toast.success(editEntry ? 'Availability window updated' : 'Availability window published');
      setShowForm(false);
      setEditEntry(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleEntry.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studioAvailability', userId] });
      toast.success('Window removed');
    },
    onError: (e) => toast.error(e.message),
  });

  const upcoming = entries.filter(e => isAfter(parseISO(e.end_date), today));
  const past = entries.filter(e => !isAfter(parseISO(e.end_date), today));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#E8EEF9]">Studio Availability Windows</h3>
          <p className="text-xs text-[#6B7A94]">Published windows are visible to members who can book your studio.</p>
        </div>
        <CCButton variant="primary" size="sm" icon={Plus} onClick={() => { setEditEntry(null); setShowForm(true); }}>
          Add Window
        </CCButton>
      </div>

      {isLoading ? (
        <p className="text-xs text-[#6B7A94] py-4 text-center">Loading…</p>
      ) : upcoming.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-[#263248] rounded-xl">
          <Building2 className="w-8 h-8 text-[#6B7A94] mx-auto mb-2" />
          <p className="text-sm text-[#9AA6BC]">No upcoming availability windows</p>
          <p className="text-xs text-[#6B7A94] mt-1">Add windows so members can book your studio.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map(entry => (
            <CCCard key={entry.id} padding="md" hover>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-medium text-[#E8EEF9]">
                      {format(parseISO(entry.start_date), 'MMM d')}
                      {entry.end_date !== entry.start_date && ` – ${format(parseISO(entry.end_date), 'MMM d, yyyy')}`}
                      {entry.end_date === entry.start_date && `, ${format(parseISO(entry.start_date), 'yyyy')}`}
                    </p>
                    <CCBadge variant={entry.status === 'BOOKED' ? 'danger' : 'success'} size="sm">
                      {entry.status === 'BOOKED' ? 'Fully Booked' : 'Available'}
                    </CCBadge>
                    {entry.current_booking_count > 0 && (
                      <CCBadge variant="warning" size="sm">
                        {entry.current_booking_count}/{entry.max_bookings || 1} booked
                      </CCBadge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#6B7A94]">
                    {(entry.start_time || entry.end_time) && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {entry.start_time}{entry.end_time && ` – ${entry.end_time}`}
                      </span>
                    )}
                    {entry.room_label && (
                      <span className="flex items-center gap-1 text-[#4F8CFF]">
                        <Building2 className="w-3 h-3" />
                        {entry.room_label}
                      </span>
                    )}
                    {(entry.location_name || entry.location_city) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {entry.location_name || entry.location_city}
                      </span>
                    )}
                  </div>
                  {entry.equipment_features?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {entry.equipment_features.slice(0, 3).map((f, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-[#1A2438] text-[#9AA6BC] text-xs rounded">
                          {f}
                        </span>
                      ))}
                      {entry.equipment_features.length > 3 && (
                        <span className="text-xs text-[#6B7A94]">+{entry.equipment_features.length - 3}</span>
                      )}
                    </div>
                  )}
                  {entry.booking_notes && (
                    <p className="text-xs text-[#F59E0B] mt-1 flex items-start gap-1">
                      <FileText className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {entry.booking_notes.slice(0, 80)}{entry.booking_notes.length > 80 ? '…' : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <CCButton variant="ghost" size="icon" onClick={() => { setEditEntry(entry); setShowForm(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </CCButton>
                  <CCButton variant="ghost" size="icon" onClick={() => deleteMutation.mutate(entry.id)} loading={deleteMutation.isPending}>
                    <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                  </CCButton>
                </div>
              </div>
            </CCCard>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-[#6B7A94] hover:text-[#9AA6BC]">
            {past.length} past window{past.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-2 opacity-50">
            {past.slice(0, 5).map(entry => (
              <div key={entry.id} className="p-2 bg-[#0D1520] rounded-lg border border-[#1A2438] flex items-center justify-between">
                <span className="text-xs text-[#6B7A94]">
                  {format(parseISO(entry.start_date), 'MMM d')} – {format(parseISO(entry.end_date), 'MMM d, yyyy')}
                  {entry.room_label && ` · ${entry.room_label}`}
                </span>
                <CCBadge variant="outline" size="sm">Past</CCBadge>
              </div>
            ))}
          </div>
        </details>
      )}

      <CCModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditEntry(null); }}
        title={editEntry ? 'Edit Availability Window' : 'Add Availability Window'}
        size="lg"
      >
        <AvailabilityForm
          entry={editEntry}
          userId={userId}
          onSave={(data) => saveMutation.mutate(data)}
          onClose={() => { setShowForm(false); setEditEntry(null); }}
        />
      </CCModal>
    </div>
  );
}