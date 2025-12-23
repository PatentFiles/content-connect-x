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
          {/* Large Profile Image */}
          <div className="relative h-64 bg-gradient-to-br from-[#4F8CFF]/30 to-[#FF2DAA]/30">
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/60 to-transparent" />
            
            {/* Distance badge */}
            {distance && (
              <div className="absolute top-3 right-3">
                <CCBadge variant="default" size="sm" icon={MapPin}>
                  {distance < 1 ? '<1' : Math.round(distance)} mi
                </CCBadge>
              </div>
            )}

            {/* Profile Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {profile.display_name || 'Anonymous'}
                  {isVerified && (
                    <ShieldCheck className="w-5 h-5 text-[#4F8CFF]" />
                  )}
                </h3>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-white/90 mb-2">
                {profile.age && <span>{profile.age}</span>}
                {profile.age && creatorDetails?.gender_identity && <span>•</span>}
                {creatorDetails?.gender_identity && (
                  <span className="capitalize">
                    {creatorDetails.gender_identity.replace('_', ' ')}
                  </span>
                )}
                {creatorDetails?.orientation_category && (
                  <>
                    <span>•</span>
                    <span className="capitalize">
                      {Array.isArray(creatorDetails.orientation_category) 
                        ? creatorDetails.orientation_category[0]?.replace('_', ' ')
                        : creatorDetails.orientation_category?.replace('_', ' ')}
                    </span>
                  </>
                )}
              </div>

              {/* Location */}
              {profile.base_location && (
                <p className="text-sm text-white/80 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {profile.base_location.city && profile.base_location.state 
                    ? `${profile.base_location.city}, ${profile.base_location.state}`
                    : profile.base_location.city}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="px-4 pb-4 pt-3">
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