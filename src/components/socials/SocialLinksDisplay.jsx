import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link2, Lock, ShieldCheck } from 'lucide-react';
import CCBadge from '../ui-custom/CCBadge';

const groupLabels = {
  FAN_PLATFORM: 'Fan Platforms',
  SOCIAL_TRAFFIC: 'Social',
  DIRECT_CONTACT: 'Direct Contact',
  HUB: 'Links',
  TUBE_MODEL_PAGES: 'Portfolio',
  CREATOR_MARKETPLACES: 'Marketplace',
  KINK_COMMUNITY: 'Community',
  GAY_PLATFORMS: 'Platforms',
  INTERNATIONAL: 'International',
  STUDIO_NICHE: 'Studio',
  CUSTOM: 'Other',
};

export default function SocialLinksDisplay({ userId, viewerContext = 'PUBLIC' }) {
  const { data: platforms = [] } = useQuery({
    queryKey: ['socialPlatforms'],
    queryFn: () => base44.entities.SocialPlatform.filter({ is_enabled: true }),
  });

  const { data: userLinks = [] } = useQuery({
    queryKey: ['socialLinks', userId],
    queryFn: () => base44.entities.SocialLink.filter({ user_id: userId, is_active: true }),
    enabled: !!userId,
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['socialVerifications', userId],
    queryFn: () => base44.entities.SocialLinkVerification.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const canViewLink = (link) => {
    if (viewerContext === 'OWNER') return true;
    if (link.visibility === 'PRIVATE') return false;
    if (link.visibility === 'PUBLIC') return true;
    if (link.visibility === 'VERIFIED_ONLY' && viewerContext === 'VERIFIED') return true;
    if (link.visibility === 'MATCHED_ONLY' && viewerContext === 'MATCHED') return true;
    if (link.visibility === 'DEAL_ROOM_ONLY' && viewerContext === 'DEAL_ROOM') return true;
    return false;
  };

  const getVerificationStatus = (linkId) => {
    const verification = verifications.find(v => v.social_link_id === linkId);
    return verification?.status === 'VERIFIED';
  };

  const getDisplayUrl = (link, platform) => {
    if (platform.input_type === 'HANDLE' && platform.base_url) {
      return platform.base_url + link.value;
    }
    return link.value;
  };

  const visibleLinks = userLinks.filter(canViewLink);

  const groupedLinks = visibleLinks.reduce((acc, link) => {
    const platform = platforms.find(p => p.id === link.platform_id);
    if (!platform) return acc;

    if (!acc[platform.group]) acc[platform.group] = [];
    acc[platform.group].push({ link, platform });
    return acc;
  }, {});

  if (Object.keys(groupedLinks).length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedLinks).map(([group, items]) => (
        <div key={group}>
          <h3 className="text-sm font-medium text-[#6B7A94] mb-3">{groupLabels[group]}</h3>
          <div className="space-y-2">
            {items.map(({ link, platform }) => {
              const isVerified = getVerificationStatus(link.id);
              const displayUrl = getDisplayUrl(link, platform);

              return (
                <a
                  key={link.id}
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-[#121824] rounded-lg hover:bg-[#1A2438] transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#263248] flex items-center justify-center flex-shrink-0">
                    <Link2 className="w-4 h-4 text-[#9AA6BC]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#E8EEF9]">{platform.display_name}</p>
                      {isVerified && (
                        <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A94] truncate">
                      {platform.input_type === 'HANDLE' ? `@${link.value}` : displayUrl}
                    </p>
                  </div>
                  {link.visibility === 'DEAL_ROOM_ONLY' && (
                    <CCBadge variant="warning" size="sm">Deal Room</CCBadge>
                  )}
                  {link.visibility === 'MATCHED_ONLY' && (
                    <CCBadge variant="accent" size="sm">After Match</CCBadge>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      ))}

      {/* Hidden links placeholder */}
      {userLinks.length > visibleLinks.length && (
        <div className="p-4 bg-[#263248]/30 border border-[#263248] rounded-lg text-center">
          <Lock className="w-6 h-6 mx-auto mb-2 text-[#6B7A94]" />
          <p className="text-sm text-[#9AA6BC]">
            {userLinks.length - visibleLinks.length} more link{userLinks.length - visibleLinks.length !== 1 ? 's' : ''} available in Deal Room
          </p>
        </div>
      )}
    </div>
  );
}