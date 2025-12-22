import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  Briefcase, 
  Plus, 
  Filter, 
  Clock, 
  CheckCircle, 
  FileText,
  ChevronRight,
  Users,
  Calendar,
  DollarSign
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCAvatarGroup } from '@/components/ui-custom/CCAvatars';
import { CCLoadingScreen, CCSkeletonLoader } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';

const statusConfig = {
  draft: { label: 'Draft', variant: 'default', icon: FileText },
  negotiating: { label: 'Negotiating', variant: 'warning', icon: Clock },
  agreed: { label: 'Agreed', variant: 'primary', icon: CheckCircle },
  contract_sent: { label: 'Contract Sent', variant: 'primary', icon: FileText },
  signed: { label: 'Signed', variant: 'success', icon: CheckCircle },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'danger', icon: null },
};

export default function DealRooms() {
  const [filter, setFilter] = useState('all');

  // Check auth and access
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: verification } = useQuery({
    queryKey: ['verification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const isVerified = verification?.[0]?.status === 'approved';
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch deal rooms
  const { data: dealRooms = [], isLoading: dealRoomsLoading } = useQuery({
    queryKey: ['dealRooms', user?.email],
    queryFn: async () => {
      const allRooms = await base44.entities.DealRoom.list('-created_date');
      return allRooms.filter(r => r.participant_ids?.includes(user?.email));
    },
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch participant profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['dealRoomProfiles', dealRooms],
    queryFn: async () => {
      const allIds = [...new Set(dealRooms.flatMap(r => r.participant_ids || []))];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => allIds.includes(p.user_id));
    },
    enabled: dealRooms.length > 0,
  });

  if (userLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <AccessGate type="both" />;
  }

  if (!isVerified) {
    return <AccessGate type="verification" />;
  }

  if (!isSubscribed) {
    return <AccessGate type="subscription" />;
  }

  const filteredRooms = filter === 'all' 
    ? dealRooms 
    : dealRooms.filter(r => r.status === filter);

  const getParticipantAvatars = (room) => {
    return room.participant_ids?.map(id => {
      const profile = profiles.find(p => p.user_id === id);
      return { src: profile?.avatar_url, alt: profile?.display_name };
    }) || [];
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Deal Rooms</h1>
                <p className="text-xs text-[#6B7A94]">Manage your collaborations</p>
              </div>
            </div>
            <Link to={createPageUrl('CreateDealRoom')}>
              <CCButton variant="primary" icon={Plus}>
                New Deal
              </CCButton>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex gap-2 justify-center items-center overflow-x-auto pb-2 scrollbar-hide">
            {['all', 'draft', 'negotiating', 'agreed', 'signed', 'completed'].map((status) => (
              <CCButton
                key={status}
                variant={filter === status ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status === 'all' ? 'All' : statusConfig[status]?.label}
              </CCButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {dealRoomsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <CCCard key={i} padding="lg">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <CCSkeletonLoader className="h-6 w-32" />
                    <CCSkeletonLoader className="h-6 w-20 rounded-full" />
                  </div>
                  <CCSkeletonLoader className="h-4 w-48" />
                  <div className="flex gap-4">
                    <CCSkeletonLoader className="h-4 w-24" />
                    <CCSkeletonLoader className="h-4 w-24" />
                  </div>
                </div>
              </CCCard>
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <CCEmpty
            icon={Briefcase}
            title="No deal rooms yet"
            description="Create a deal room to start negotiating collaborations with other verified members."
            action={() => window.location.href = createPageUrl('CreateDealRoom')}
            actionLabel="Create Deal Room"
          />
        ) : (
          <div className="space-y-4">
            {filteredRooms.map((room) => {
              const status = statusConfig[room.status] || statusConfig.draft;
              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Link to={createPageUrl(`ViewDealRoom?id=${room.id}`)}>
                    <CCCard hover clickable padding="lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <CCAvatarGroup avatars={getParticipantAvatars(room)} max={3} />
                          <div>
                            <p className="text-[#E8EEF9] font-medium">
                              {room.participant_ids?.length || 0} Participants
                            </p>
                            <p className="text-sm text-[#6B7A94] capitalize">
                              {room.scene_type || 'Scene'} • {room.compensation_type?.replace('_', ' ') || 'TBD'}
                            </p>
                          </div>
                        </div>
                        <CCBadge variant={status.variant} icon={status.icon}>
                          {status.label}
                        </CCBadge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-[#9AA6BC]">
                        {room.schedule?.confirmed_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(room.schedule.confirmed_date).toLocaleDateString()}
                          </span>
                        )}
                        {room.location?.city && (
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {room.location.city}
                          </span>
                        )}
                        {room.compensation_details?.amount && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${room.compensation_details.amount}
                          </span>
                        )}
                      </div>

                      {room.acts_selected?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {room.acts_selected.slice(0, 3).map(act => (
                            <CCBadge key={act} variant="outline" size="sm">{act}</CCBadge>
                          ))}
                          {room.acts_selected.length > 3 && (
                            <CCBadge variant="outline" size="sm">+{room.acts_selected.length - 3}</CCBadge>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-end mt-4 pt-3 border-t border-[#263248]">
                        <span className="text-sm text-[#4F8CFF] flex items-center gap-1">
                          View Details <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </CCCard>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}