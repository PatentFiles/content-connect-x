/**
 * SoloSessionCard
 * Displays a compact summary card for a SoloSession record.
 * Used in dashboards, session lists, and booking inboxes.
 */
import React from 'react';
import { format } from 'date-fns';
import { MapPin, Clock, Calendar, ArrowRight, Users, User } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';

const STATUS_VARIANTS = {
  draft: 'outline',
  pending_host: 'warning',
  confirmed: 'primary',
  contract_pending: 'warning',
  contract_signed: 'success',
  active: 'success',
  completed: 'default',
  cancelled: 'danger',
  disputed: 'danger',
};

const TYPE_LABELS = {
  solo_session: 'Solo Session',
  service_booking: 'Service Booking',
  location_booking: 'Location Booking',
};

const PARTICIPANT_ICONS = {
  on_platform: User,
  external: Users,
  mixed: Users,
};

export default function SoloSessionCard({ session, onClick, showHost = false, hostProfile = null, guestProfile = null }) {
  const StatusIcon = PARTICIPANT_ICONS[session.participant_mode] || User;
  const displayDate = session.schedule?.confirmed_date
    ? format(new Date(session.schedule.confirmed_date), 'MMM d, yyyy')
    : 'Date TBD';

  const displayName = showHost
    ? (hostProfile?.display_name || session.host_user_id?.split('@')[0] || 'Host')
    : (guestProfile?.display_name || session.guest_user_id?.split('@')[0] || 'Guest');

  return (
    <CCCard
      clickable={!!onClick}
      onClick={onClick}
      padding="md"
      className="hover:border-[#3A4A6B] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <CCBadge variant={STATUS_VARIANTS[session.status] || 'default'} size="sm">
              {session.status?.replace(/_/g, ' ')}
            </CCBadge>
            <CCBadge variant="outline" size="sm">
              {TYPE_LABELS[session.session_type] || session.session_type}
            </CCBadge>
            {session.upgraded_to_collaboration && (
              <CCBadge variant="primary" size="sm">↑ Upgraded</CCBadge>
            )}
          </div>

          <p className="font-medium text-[#E8EEF9] truncate text-sm">
            {session.session_name || TYPE_LABELS[session.session_type]}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#9AA6BC]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {displayDate}
            </span>
            {session.schedule?.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {session.schedule.start_time}
                {session.schedule.end_time && ` – ${session.schedule.end_time}`}
              </span>
            )}
            {session.location?.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {session.location.city}
              </span>
            )}
            <span className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {displayName}
            </span>
          </div>
        </div>

        {onClick && <ArrowRight className="w-4 h-4 text-[#6B7A94] flex-shrink-0 mt-1" />}
      </div>
    </CCCard>
  );
}