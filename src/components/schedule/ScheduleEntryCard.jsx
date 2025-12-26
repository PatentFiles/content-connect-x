import React from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Lock, Trash2, Edit2 } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';

export default function ScheduleEntryCard({ entry, onEdit, onDelete, isSelected, onSelect }) {
  const isLocked = entry.is_locked || entry.source === 'COLLABORATION';
  const canDelete = entry.source === 'MANUAL' && !isLocked;
  const canEdit = !isLocked;

  const getStatusColor = () => {
    if (entry.status === 'BOOKED') return 'warning';
    if (entry.status === 'UNAVAILABLE') return 'danger';
    return 'success';
  };

  const getEntryTypeLabel = () => {
    if (entry.entry_type === 'BOOKING') return 'Booked';
    if (entry.entry_type === 'EXTERNAL_BUSY') return 'Busy';
    return 'Available';
  };

  return (
    <CCCard padding="md" className={`${isSelected ? 'ring-2 ring-[#4F8CFF]' : ''}`}>
      <div className="flex items-start gap-3">
        {!isLocked && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(entry.id, e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CCBadge variant={getStatusColor()}>
                {getEntryTypeLabel()}
              </CCBadge>
              {isLocked && (
                <CCBadge variant="outline" icon={Lock}>
                  Locked
                </CCBadge>
              )}
              {entry.title && (
                <span className="text-sm font-medium text-[#E8EEF9]">
                  {entry.title}
                </span>
              )}
            </div>
            
            {!isLocked && (
              <div className="flex items-center gap-1">
                {canEdit && (
                  <CCButton
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(entry)}
                    className="h-7 w-7"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </CCButton>
                )}
                {canDelete && (
                  <CCButton
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(entry.id)}
                    className="h-7 w-7 text-[#EF4444] hover:text-[#DC2626]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </CCButton>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-[#9AA6BC]">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(entry.start_date), 'MMM d, yyyy')}
                {entry.end_date !== entry.start_date && (
                  <> - {format(new Date(entry.end_date), 'MMM d, yyyy')}</>
                )}
              </span>
            </div>

            {(entry.start_time || entry.end_time) && (
              <div className="flex items-center gap-2 text-sm text-[#9AA6BC]">
                <Clock className="w-4 h-4" />
                <span>
                  {entry.start_time || '—'} - {entry.end_time || '—'}
                </span>
              </div>
            )}

            {entry.location_city && (
              <div className="flex items-center gap-2 text-sm text-[#9AA6BC]">
                <MapPin className="w-4 h-4" />
                <span>
                  {entry.location_city}
                  {entry.location_region && `, ${entry.location_region}`}
                </span>
              </div>
            )}

            {isLocked && entry.lock_reason && (
              <p className="text-xs text-[#6B7A94] mt-2 italic">
                {entry.lock_reason}
              </p>
            )}
          </div>
        </div>
      </div>
    </CCCard>
  );
}