import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Heart, MessageCircle, ShieldCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import CCCard from '../ui-custom/CCCard';
import CCAvatar from '../ui-custom/CCAvatars';
import CCBadge from '../ui-custom/CCBadge';
import CCButton from '../ui-custom/CCButton';
import TrustBadges from '@/components/profile/TrustBadges';
import ReputationBadge from '@/components/trust/ReputationBadge';

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
  verification,
  testingCred,
  reputationScore,
  distance,
  onFavorite,
  onMessage,
  onBlock,
  onReport,
  showActions = true,
  compact = false,
  isRepresented = false,
  isSaved = false,
}) {
  const navigate = useNavigate();
  const [isMessaging, setIsMessaging] = useState(false);

  const isVerified = profile?.verified;
  const isOnline = profile?.last_active_at && 
    new Date(profile.last_active_at) > new Date(Date.now() - 15 * 60 * 1000);

  const handleMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onMessage) {
      onMessage(profile);
      return;
    }

    // Create/find conversation and navigate
    setIsMessaging(true);
    try {
      const { data } = await base44.functions.invoke('startConversation', {
        recipient_id: profile.user_id
      });

      if (data.conversation) {
        navigate(createPageUrl(`Messages?conversation=${data.conversation.id}`));
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
    } finally {
      setIsMessaging(false);
    }
  };

  const handleBlock = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onBlock) {
      onBlock(profile);
    }
  };

  const handleReport = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onReport) {
      onReport(profile);
    }
  };

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
            
            {/* Role Badge & Represented Badge */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {profile.role_type && (
                <div className="bg-black/70 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className={`text-xs font-semibold ${
                    profile.role_type === 'creator' ? 'text-[#4F8CFF]' :
                    profile.role_type === 'agent' ? 'text-[#FF2DAA]' :
                    profile.role_type === 'studio' ? 'text-[#22C55E]' :
                    profile.role_type === 'photographer' ? 'text-[#F59E0B]' :
                    profile.role_type === 'videographer' ? 'text-[#EF4444]' :
                    'text-white'
                  }`}>
                    {roleLabels[profile.role_type] || profile.role_type}
                  </span>
                </div>
              )}
              {isRepresented && profile.role_type === 'creator' && (
                <div className="bg-[#FF2DAA]/90 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className="text-xs font-semibold text-white">
                    Represented
                  </span>
                </div>
              )}
            </div>

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

          {/* Trust Badges + Reputation */}
          {(verification || testingCred || reputationScore) && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5">
              <TrustBadges profile={profile} verification={verification} testingCred={testingCred} size="sm" />
              {reputationScore && <ReputationBadge score={reputationScore} size="sm" compact />}
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="px-3 py-3">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onFavorite?.(profile);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[#263248] bg-transparent hover:bg-[#151D2B] transition-all duration-200"
                >
                  <Heart 
                    className={`w-4 h-4 ${isSaved ? 'fill-[#EF4444] text-[#EF4444]' : 'text-[#E8EEF9]'}`}
                  />
                  <span className="text-[#E8EEF9]">
                    {isSaved ? 'Saved' : 'Save'}
                  </span>
                </button>
                <CCButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  icon={MessageCircle}
                  onClick={handleMessage}
                  loading={isMessaging}
                  disabled={isMessaging}
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