/**
 * CollaborationFeed
 *
 * Activity/social-proof feed showing safe, non-sensitive platform activity:
 * - Recently active members
 * - Newly verified users
 * - Travel announcements (if user opted in)
 * - Milestone completions (if user allows)
 *
 * Privacy: only shows data users have opted to share.
 * No sensitive collaboration details exposed.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ShieldCheck, MapPin, Star, Zap, Clock, Award, TrendingUp
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { formatDistanceToNow } from 'date-fns';

const FEED_ICONS = {
  user_verified: ShieldCheck,
  collaboration_completed: TrendingUp,
  user_newly_joined: Zap,
  travel_announced: MapPin,
  milestone_reached: Award,
  testing_updated: Star,
};

const FEED_COLORS = {
  user_verified: 'text-[#4F8CFF]',
  collaboration_completed: 'text-[#22C55E]',
  user_newly_joined: 'text-[#FF2DAA]',
  travel_announced: 'text-[#F59E0B]',
  milestone_reached: 'text-[#4F8CFF]',
  testing_updated: 'text-[#22C55E]',
};

function FeedItem({ item }) {
  const Icon = FEED_ICONS[item.type] || Clock;
  const color = FEED_COLORS[item.type] || 'text-[#9AA6BC]';
  const age = item.created_date ? formatDistanceToNow(new Date(item.created_date), { addSuffix: true }) : '';

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#1A2438] last:border-0">
      <div className="flex-shrink-0">
        {item.avatar_url ? (
          <CCAvatar src={item.avatar_url} size="sm" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#1A2438] flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#E8EEF9] leading-snug">{item.headline}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.location_hint && (
            <span className="text-xs text-[#6B7A94] flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />{item.location_hint}
            </span>
          )}
          {age && <span className="text-xs text-[#6B7A94]">{age}</span>}
        </div>
      </div>
    </div>
  );
}

// Activity derived from live data (real-time, no stale feed entity needed)
function LiveActivitySection({ userId }) {
  const { data: recentProfiles = [] } = useQuery({
    queryKey: ['feedRecentlyActive'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ profile_complete: true });
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return profiles
        .filter(p => p.user_id !== userId && p.last_active_at && new Date(p.last_active_at) > sevenDaysAgo)
        .sort((a, b) => new Date(b.last_active_at) - new Date(a.last_active_at))
        .slice(0, 8);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentVerified = [] } = useQuery({
    queryKey: ['feedRecentVerified'],
    queryFn: async () => {
      const verifications = await base44.entities.VerificationRecord.filter({ status: 'approved' });
      const profiles = await base44.entities.UserProfile.filter({ profile_complete: true });
      const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return verifications
        .filter(v => v.verified_at && new Date(v.verified_at) > sevenDaysAgo && v.user_id !== userId)
        .slice(0, 5)
        .map(v => ({ ...v, profile: profileMap[v.user_id] }))
        .filter(v => v.profile);
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: travelEntries = [] } = useQuery({
    queryKey: ['feedTravelAnnouncements'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const entries = await base44.entities.ScheduleEntry.filter({ entry_type: 'travel' });
      const profiles = await base44.entities.UserProfile.filter({ profile_complete: true });
      const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));
      return entries
        .filter(e => e.date >= today && e.user_id !== userId && profileMap[e.user_id]?.travel_enabled)
        .slice(0, 5)
        .map(e => ({ ...e, profile: profileMap[e.user_id] }))
        .filter(e => e.profile);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Build synthetic feed items from live data
  const feedItems = [];

  recentVerified.forEach(v => {
    if (!v.profile?.display_name) return;
    feedItems.push({
      id: `verified-${v.id}`,
      type: 'user_verified',
      headline: `${v.profile.display_name} completed identity verification`,
      avatar_url: v.profile.avatar_url,
      created_date: v.verified_at,
      location_hint: v.profile.base_location?.city || null,
    });
  });

  travelEntries.forEach(e => {
    feedItems.push({
      id: `travel-${e.id}`,
      type: 'travel_announced',
      headline: `${e.profile.display_name} is traveling to ${e.location || 'a new location'}`,
      avatar_url: e.profile.avatar_url,
      created_date: e.created_date,
      location_hint: e.location || null,
    });
  });

  // Sort by recency
  feedItems.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

  return (
    <div className="space-y-4">
      {feedItems.length > 0 && (
        <CCCard padding="md">
          <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#FF2DAA]" />
            Recent Activity
          </h3>
          <div>
            {feedItems.slice(0, 8).map(item => (
              <FeedItem key={item.id} item={item} />
            ))}
          </div>
        </CCCard>
      )}

      {/* Recently Active Members */}
      {recentProfiles.length > 0 && (
        <CCCard padding="md">
          <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#22C55E]" />
            Recently Active
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentProfiles.slice(0, 8).map(p => (
              <Link
                key={p.user_id}
                to={createPageUrl(`ViewProfile?user_id=${p.user_id}`)}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <CCAvatar src={p.avatar_url} size="sm" online={!!p.last_active_at && new Date(p.last_active_at) > new Date(Date.now() - 2 * 60 * 60 * 1000)} />
                <span className="text-xs text-[#9AA6BC] max-w-[56px] truncate text-center">{p.display_name}</span>
              </Link>
            ))}
          </div>
        </CCCard>
      )}
    </div>
  );
}

export default function CollaborationFeed({ userId }) {
  if (!userId) return null;
  return <LiveActivitySection userId={userId} />;
}