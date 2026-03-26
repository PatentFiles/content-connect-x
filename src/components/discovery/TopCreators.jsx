/**
 * TopCreators / Trusted Creators
 *
 * Leaderboard surface based on trust score, activity, completion rate.
 * No vanity metrics (no likes, no reviews).
 * Uses ReputationScore + VerificationRecord + Collaboration data.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Award, ShieldCheck, TrendingUp, Star } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCBadge from '@/components/ui-custom/CCBadge';
import ReputationBadge from '@/components/trust/ReputationBadge';
import { CCSkeletonLoader } from '@/components/ui-custom/CCLoading';

const ROLE_LABELS = {
  creator: 'Creator',
  photographer: 'Photographer',
  videographer: 'Videographer',
  agent: 'Agent',
  studio: 'Studio',
};

const ROLE_COLORS = {
  creator: 'primary',
  photographer: 'warning',
  videographer: 'accent',
  agent: 'success',
  studio: 'default',
};

export default function TopCreators({ userId, roleFilter = '', limit = 6, title = 'Trusted Members' }) {
  const { data: reputationScores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ['topReputationScores', roleFilter],
    queryFn: () => base44.entities.ReputationScore.list('-score', 50),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['topCreatorProfiles'],
    queryFn: () => base44.entities.UserProfile.filter({ profile_complete: true }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allVerifications = [] } = useQuery({
    queryKey: ['topCreatorVerifications'],
    queryFn: () => base44.entities.VerificationRecord.filter({ status: 'approved' }),
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = scoresLoading || profilesLoading;

  // Join score + profile + verification
  const ranked = React.useMemo(() => {
    if (!reputationScores.length || !allProfiles.length) return [];

    const profileMap = Object.fromEntries(allProfiles.map(p => [p.user_id, p]));
    const verifiedSet = new Set(allVerifications.map(v => v.user_id));

    return reputationScores
      .filter(s => {
        const p = profileMap[s.user_id];
        if (!p) return false;
        if (p.user_id === userId) return false;
        if (p.banned || p.suspended || p.account_deactivated) return false;
        if (roleFilter && p.role_type !== roleFilter) return false;
        return s.score >= 20; // minimum threshold to appear
      })
      .map(s => ({
        score: s,
        profile: profileMap[s.user_id],
        isVerified: verifiedSet.has(s.user_id),
      }))
      .sort((a, b) => b.score.score - a.score.score)
      .slice(0, limit);
  }, [reputationScores, allProfiles, allVerifications, userId, roleFilter, limit]);

  if (isLoading) {
    return (
      <CCCard padding="md">
        <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#4F8CFF]" />
          {title}
        </h3>
        <div className="space-y-2">
          {[1, 2, 3].map(i => <CCSkeletonLoader key={i} className="h-12 w-full" />)}
        </div>
      </CCCard>
    );
  }

  if (ranked.length === 0) return null;

  return (
    <CCCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-2">
          <Award className="w-4 h-4 text-[#4F8CFF]" />
          {title}
        </h3>
        <span className="text-xs text-[#6B7A94]">By trust score</span>
      </div>

      <div className="space-y-2">
        {ranked.map(({ score, profile, isVerified }, index) => (
          <Link
            key={score.user_id}
            to={createPageUrl(`ViewProfile?user_id=${profile.user_id}`)}
            className="block"
          >
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1A2438] transition-colors">
              {/* Rank */}
              <div className="w-5 text-center flex-shrink-0">
                {index === 0 ? (
                  <Star className="w-4 h-4 text-[#F59E0B] mx-auto" />
                ) : (
                  <span className="text-xs text-[#6B7A94] font-mono">{index + 1}</span>
                )}
              </div>

              <CCAvatar src={profile.avatar_url} size="sm" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-[#E8EEF9] truncate">
                    {profile.display_name}
                  </p>
                  {isVerified && <ShieldCheck className="w-3 h-3 text-[#4F8CFF] flex-shrink-0" />}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <CCBadge variant={ROLE_COLORS[profile.role_type] || 'default'} size="sm">
                    {ROLE_LABELS[profile.role_type] || profile.role_type}
                  </CCBadge>
                  {profile.base_location?.city && (
                    <span className="text-xs text-[#6B7A94] break-words">{profile.base_location.city}</span>
                  )}
                  <ReputationBadge score={score} size="sm" compact />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </CCCard>
  );
}