/**
 * TravelSync
 *
 * Shows who is traveling to the same city or overlapping travel windows.
 * Uses ScheduleEntry + UserProfile + availability helpers.
 * Respects UserProfile.travel_enabled and visibility settings.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { MapPin, Calendar } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCBadge from '@/components/ui-custom/CCBadge';
import { format, parseISO } from 'date-fns';

export default function TravelSync({ userId, myProfile }) {
  const today = new Date().toISOString().split('T')[0];
  const sixtyDaysOut = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // My travel dates
  const { data: myTravelEntries = [] } = useQuery({
    queryKey: ['myTravelEntries', userId],
    queryFn: () => base44.entities.ScheduleEntry.filter({ user_id: userId, entry_type: 'travel' }),
    enabled: !!userId,
  });

  // All travel entries from others
  const { data: allTravelEntries = [] } = useQuery({
    queryKey: ['allTravelEntries'],
    queryFn: () => base44.entities.ScheduleEntry.filter({ entry_type: 'travel' }),
    staleTime: 10 * 60 * 1000,
  });

  // Profiles of travelers
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['travelProfiles'],
    queryFn: () => base44.entities.UserProfile.filter({ travel_enabled: true, profile_complete: true }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allVerifications = [] } = useQuery({
    queryKey: ['travelVerifications'],
    queryFn: () => base44.entities.VerificationRecord.filter({ status: 'approved' }),
    staleTime: 10 * 60 * 1000,
  });

  const profileMap = useMemo(() => Object.fromEntries(allProfiles.map(p => [p.user_id, p])), [allProfiles]);
  const verifiedSet = useMemo(() => new Set(allVerifications.map(v => v.user_id)), [allVerifications]);

  // Find overlapping travelers
  const travelMatches = useMemo(() => {
    if (!myTravelEntries.length && !myProfile?.base_location?.city) return [];

    const results = new Map();

    // Check each future travel entry by others
    allTravelEntries
      .filter(e =>
        e.user_id !== userId &&
        e.date >= today &&
        e.date <= sixtyDaysOut
      )
      .forEach(e => {
        const profile = profileMap[e.user_id];
        if (!profile || profile.banned || profile.suspended || profile.account_deactivated) return;
        if (!profile.travel_enabled) return;

        // Check if traveling to same city as me (base location)
        const myCity = myProfile?.base_location?.city?.toLowerCase();
        const travelCity = e.location?.toLowerCase();
        const isSameCity = myCity && travelCity && (travelCity.includes(myCity) || myCity.includes(travelCity));

        // Check if overlapping with my travel dates
        const isOverlapping = myTravelEntries.some(myEntry => {
          if (!myEntry.date_end && myEntry.date === e.date) return true;
          if (myEntry.date_end) {
            return e.date >= myEntry.date && e.date <= myEntry.date_end;
          }
          return false;
        });

        if (isSameCity || isOverlapping) {
          if (!results.has(e.user_id)) {
            results.set(e.user_id, {
              profile,
              entries: [],
              isSameCity,
              isOverlapping,
              isVerified: verifiedSet.has(e.user_id),
            });
          }
          results.get(e.user_id).entries.push(e);
        }
      });

    return Array.from(results.values()).slice(0, 8);
  }, [allTravelEntries, myTravelEntries, profileMap, verifiedSet, userId, myProfile, today, sixtyDaysOut]);

  if (travelMatches.length === 0) {
    return (
      <CCCard padding="md">
        <div className="text-center mb-2">
          <h3 className="text-sm font-semibold cc-text-fix-primary">Travel Sync</h3>
        </div>
        <p className="text-xs cc-text-fix-muted text-center">
          No overlapping travel found. Add travel dates to find matches in your destination cities.
        </p>
      </CCCard>
    );
  }

  return (
    <CCCard padding="md">
      <div className="text-center mb-3">
        <h3 className="text-sm font-semibold cc-text-fix-primary">Travel Sync</h3>
        <CCBadge variant="primary" size="sm" className="mt-1 inline-block">{travelMatches.length} match{travelMatches.length !== 1 ? 'es' : ''}</CCBadge>
      </div>

      <div className="space-y-2">
        {travelMatches.map(({ profile, entries, isSameCity, isOverlapping, isVerified }) => {
          const nextEntry = entries.sort((a, b) => a.date.localeCompare(b.date))[0];
          return (
            <Link
              key={profile.user_id}
              to={createPageUrl(`ViewProfile?user_id=${profile.user_id}`)}
              className="block"
            >
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-cc-surface-hover transition-colors">
                <CCAvatar src={profile.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium cc-text-fix-primary truncate">{profile.display_name}</p>
                    {isVerified && <span className="cc-text-blue-fix text-xs">✓</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {isSameCity && (
                      <span className="text-xs text-[#F59E0B] flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />Visiting your city
                      </span>
                    )}
                    {isOverlapping && !isSameCity && (
                      <span className="text-xs cc-text-blue-fix flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />Overlapping travel
                      </span>
                    )}
                    {nextEntry?.location && (
                      <span className="text-xs cc-text-fix-muted">{nextEntry.location}</span>
                    )}
                    {nextEntry?.date && (
                      <span className="text-xs cc-text-fix-muted">
                        {format(parseISO(nextEntry.date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </CCCard>
  );
}