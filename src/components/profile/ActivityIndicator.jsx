import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Small activity indicator showing online / recently active status.
 * Uses profile.last_active_at and profile.visibility_settings.show_online_status.
 *
 * Status thresholds:
 *  - Online:       active within 15 min
 *  - Recently:      active within 24 h
 *  - Offline:       active > 24 h ago (only shown when showLabel=true)
 */
export default function ActivityIndicator({
  profile,
  showLabel = false,
  size = 'sm',
  className,
}) {
  if (!profile) return null;

  // Respect the user's privacy setting (default true)
  const showOnline = profile.visibility_settings?.show_online_status ?? true;
  if (!showOnline) return null;

  const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : null;
  if (!lastActive) return null;

  const now = Date.now();
  const diffMin = (now - lastActive.getTime()) / 60000;

  // Online: within 15 minutes
  const isOnline = diffMin <= 15;
  // Recently active: within 24 hours
  const isRecent = diffMin <= 24 * 60;

  if (!isOnline && !isRecent && !showLabel) return null;

  let dotColor, label;
  if (isOnline) {
    dotColor = 'bg-green-500';
    label = 'Online';
  } else if (isRecent) {
    dotColor = 'bg-yellow-500';
    label = formatRecentLabel(diffMin);
  } else {
    dotColor = 'bg-gray-400';
    label = formatOfflineLabel(diffMin);
  }

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', textSize, className)}
      style={{ color: 'var(--cc-text-secondary)' }}
      role="status"
      title={label}
    >
      <span className="relative flex">
        {isOnline && (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', dotColor)} />
        )}
        <span className={cn('relative inline-flex rounded-full', dotSize, dotColor)} />
      </span>
      {showLabel && <span>{label}</span>}
    </div>
  );
}

function formatRecentLabel(diffMin) {
  if (diffMin < 60) return `Active ${Math.max(1, Math.round(diffMin))}m ago`;
  const hours = Math.round(diffMin / 60);
  if (hours === 1) return 'Active 1h ago';
  return `Active ${hours}h ago`;
}

function formatOfflineLabel(diffMin) {
  const days = Math.round(diffMin / (60 * 24));
  if (days <= 0) return 'Recently active';
  if (days === 1) return 'Last active 1d ago';
  if (days > 30) return 'Inactive';
  return `Last active ${days}d ago`;
}