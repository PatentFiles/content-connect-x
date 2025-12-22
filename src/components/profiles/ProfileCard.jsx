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
  creator: 'accent',
  photographer: 'primary',
  videographer: 'primary',
  agent: 'warning',
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
        <CCCard hover clickable padding="none" className="overflow-hidden">
          {/* Cover Image */}
          <div className="relative h-32 bg-gradient-to-br from-[#4F8CFF]/30 to-[#FF2DAA]/30">
            {profile.cover_url && (
              <img
                src={profile.cover_url}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#151D2B] to-transparent" />
            
            {/* Distance badge */}
            {distance && (
              <div className="absolute top-3 right-3">
                <CCBadge variant="default" size="sm" icon={MapPin}>
                  {distance < 1 ? '<1' : Math.round(distance)} mi
                </CCBadge>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="relative px-4 pb-4">
            {/* Avatar */}
            <div className="absolute -top-8 left-4">
              <CCAvatar
                src={profile.avatar_url}
                alt={profile.display_name}
                size="xl"
                verified={isVerified}
                online={isOnline}
              />
            </div>

            {/* Content */}
            <div className="pt-12">
              {/* Name & Role */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#E8EEF9] flex items-center gap-2">
                    {profile.display_name || 'Anonymous'}
                    {isVerified && (
                      <ShieldCheck className="w-4 h-4 text-[#4F8CFF]" />
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <CCBadge variant={roleColors[profile.role_type]} size="sm">
                      {roleLabels[profile.role_type]}
                    </CCBadge>
                    {creatorDetails?.orientation_category && (
                      <CCBadge variant="outline" size="sm">
                        {creatorDetails.orientation_category.replace('_', ' ')}
                      </CCBadge>
                    )}
                    {profile.age && (
                      <span className="text-xs text-[#9AA6BC]">
                        {profile.age}
                      </span>
                    )}
                    {creatorDetails?.gender_identity && (
                      <span className="text-xs text-[#9AA6BC] capitalize">
                        {creatorDetails.gender_identity.replace('_', ' ')}
                      </span>
                    )}
                    {profile.response_time_hours && (
                      <span className="text-xs text-[#6B7A94] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ~{profile.response_time_hours}h reply
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Location */}
              {profile.base_location && (
                <p className="text-sm text-[#9AA6BC] flex items-center gap-1 mb-3">
                  <MapPin className="w-3 h-3" />
                  {profile.base_location.city}, {profile.base_location.country}
                </p>
              )}

              {/* Actions */}
              {showActions && (
                <div className="flex gap-2 pt-3 border-t border-[#263248]">
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
              )}
            </div>
          </div>
        </CCCard>
      </Link>
    </motion.div>
  );
}