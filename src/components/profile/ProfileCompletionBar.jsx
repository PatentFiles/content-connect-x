import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import { TrendingUp } from 'lucide-react';

export default function ProfileCompletionBar({ user, profile }) {
  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['myCreatorDetails', user?.email],
    queryFn: () => base44.entities.CreatorDetails.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: galleries = [] } = useQuery({
    queryKey: ['myGalleries', user?.email],
    queryFn: () => base44.entities.Gallery.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: socialLinks = [] } = useQuery({
    queryKey: ['socialLinks', user?.email],
    queryFn: () => base44.entities.SocialLink.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const details = creatorDetails[0];
  const publicGallery = galleries.find(g => g.type === 'public');
  const hasSocials = socialLinks.length > 0 ||
    Object.values(details?.socials || {}).some(v => v && typeof v === 'string' && v.trim() !== '');

  const items = [
    { label: 'Display Name', done: !!profile?.display_name, weight: 10 },
    { label: 'Bio', done: !!profile?.bio, weight: 15 },
    { label: 'Profile Photo', done: !!profile?.avatar_url, weight: 15 },
    { label: 'Cover Photo', done: !!profile?.cover_url, weight: 10 },
    { label: 'Location', done: !!profile?.base_location?.city, weight: 10 },
    { label: 'Collaboration Rate', done: !!details?.rates_text, weight: 15 },
    { label: 'Gallery Photos', done: (publicGallery?.items?.length || 0) > 0, weight: 15 },
    { label: 'Social Links', done: hasSocials, weight: 10 },
  ];

  const pct = items.reduce((acc, item) => acc + (item.done ? item.weight : 0), 0);

  if (pct >= 100) return null;

  const color = pct >= 75 ? '#22C55E' : pct >= 50 ? '#4F8CFF' : pct >= 25 ? '#F59E0B' : '#EF4444';
  const missing = items.filter(i => !i.done);

  return (
    <CCCard padding="lg" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#4F8CFF]" />
          <h3 className="font-semibold text-[#E8EEF9]">Profile Completion</h3>
        </div>
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-[#263248] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {/* Missing items */}
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {missing.slice(0, 4).map(item => (
            <span key={item.label} className="text-xs px-2 py-1 bg-[#263248] rounded-full text-[#9AA6BC]">
              + {item.label} (+{item.weight}%)
            </span>
          ))}
          {missing.length > 4 && (
            <span className="text-xs px-2 py-1 bg-[#263248] rounded-full text-[#9AA6BC]">
              +{missing.length - 4} more
            </span>
          )}
        </div>
      )}

      <Link to={createPageUrl('Profile')}>
        <CCButton variant="outline" size="sm" fullWidth>
          Complete Profile
        </CCButton>
      </Link>
    </CCCard>
  );
}