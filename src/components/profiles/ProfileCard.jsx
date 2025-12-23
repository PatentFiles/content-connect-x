import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Heart, MessageCircle, ShieldCheck, Clock } from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCAvatar from '../ui-custom/CCAvatars';
import CCBadge from '../ui-custom/CCBadge';
import CCButton from '../ui-custom/CCButton';

const roleColors = {
  creator: 'primary',
  photographer: 'warning',
  videographer: 'danger',
  agent: 'accent',
  studio: 'success',
};

const roleLabels = {
  creator: 'Creator',
  photographer: 'Photographer',
  videographer: 'Videographer',
  agent: 'Agent',
  studio: 'Studio',
};

export default function ProfileCard({
  profile,
  creatorDetails,
  serviceDetails,
  distance,
  onFavorite,
  onMessage,
  showActions = true,
  compact = false,
}) {
  const isVerified = profile?.verified;
  const isOnline = profile?.last_active_at && 
    new Date(profile.last_active_at) > new Date(Date.now() - 15 * 60 * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Link to={createPageUrl(`ViewProfile?id=${profile.user_id}`)}>
        <CCCard hover clickable padding="none" className="overflow-hidden max-w-[280px]">
          {/* Portrait Profile Image */}
          <div className="relative h-80 bg-gradient-to-br from-[#4F8CFF]/30 to-[#FF2DAA]/30">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-[#263248] flex items-center justify-center">
                  <span className="text-4xl text-[#6B7A94]">
                    {profile.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/50 to-transparent" />
            
            {/* Role Badge */}
            {profile.role_type && (
              <div className="absolute top-3 left-3">
                <CCBadge variant={roleColors[profile.role_type] || 'default'} size="sm">
                  {roleLabels[profile.role_type] || profile.role_type}
                </CCBadge>
              </div>
            )}

            {/* Profile Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center gap-2 mb-2">
                {isVerified && (
                  <div className="w-6 h-6 rounded-full bg-[#4F8CFF] flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                )}
                <h3 className="text-lg font-bold text-white">
                  {profile.display_name || 'Anonymous'}
                </h3>
              </div>
              
              <div className="text-sm text-white/90 leading-relaxed">
                {profile.age && <span>{profile.age}</span>}
                {profile.age && profile.base_location?.city && <span> • </span>}
                {profile.base_location?.city && (
                  <span>{profile.base_location.city}</span>
                )}
                {profile.base_location?.city && creatorDetails?.gender_identity && <span> • </span>}
                {creatorDetails?.gender_identity && (
                  <span className="capitalize">
                    {creatorDetails.gender_identity.replace('_', ' ')}
                  </span>
                )}
                {creatorDetails?.gender_identity && creatorDetails?.orientation_category && <span> • </span>}
                {creatorDetails?.orientation_category && (
                  <span className="capitalize">
                    {Array.isArray(creatorDetails.orientation_category) 
                      ? creatorDetails.orientation_category.join(', ').replace(/_/g, ' ')
                      : creatorDetails.orientation_category?.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="px-3 py-3">
              <div className="flex gap-2">
                <CCButton
                  variant="outline"
                  size="sm"
                  fullWidth
                  icon={Heart}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onFavorite?.(profile);
                  }}
                >
                  Save
                </CCButton>
                <CCButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  icon={MessageCircle}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMessage?.(profile);
                  }}
                >
                  Message
                </CCButton>
              </div>
            </div>
          )}
        </CCCard>
      </Link>
    </motion.div>
  );
}