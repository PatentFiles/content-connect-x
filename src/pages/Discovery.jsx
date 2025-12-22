import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Compass, MapPin, Filter, ChevronRight } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { CCLoadingScreen, CCProfileCardSkeleton } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import ProfileCard from '@/components/profiles/ProfileCard';
import ProfileFilters from '@/components/profiles/ProfileFilters';
import AccessGate from '@/components/auth/AccessGate';

export default function Discovery() {
  const [filters, setFilters] = useState({
    roleTypes: [],
    lookingFor: [],
    distance: 50,
    compensation: [],
    travelAvailable: false,
    verifiedOnly: true,
    sortBy: 'distance',
  });

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

  const { data: myProfile } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const isVerified = verification?.[0]?.status === 'approved';
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch all profiles
  const { data: allProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: async () => {
      let profiles = await base44.entities.UserProfile.filter({ profile_complete: true });
      return profiles.filter(p => p.user_id !== user?.email);
    },
    enabled: !!user && isVerified && isSubscribed,
  });

  // Apply filters client-side
  const profiles = React.useMemo(() => {
    let filtered = [...allProfiles];
    
    if (filters.roleTypes.length > 0) {
      filtered = filtered.filter(p => filters.roleTypes.includes(p.role_type));
    }
    if (filters.travelAvailable) {
      filtered = filtered.filter(p => p.travel_enabled);
    }
    
    return filtered.slice(0, 20);
  }, [allProfiles, filters]);

  // Fetch creator details for profiles
  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['creatorDetails', profiles.map(p => p.user_id)],
    queryFn: async () => {
      if (profiles.length === 0) return [];
      const allDetails = await base44.entities.CreatorDetails.list();
      return allDetails.filter(d => profiles.some(p => p.user_id === d.user_id));
    },
    enabled: profiles.length > 0,
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

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <Compass className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Discovery</h1>
                <p className="text-xs text-[#6B7A94]">Find your next collaboration</p>
              </div>
            </div>
            <ProfileFilters
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters({
                roleTypes: [],
                lookingFor: [],
                distance: 50,
                compensation: [],
                travelAvailable: false,
                verifiedOnly: true,
                sortBy: 'distance',
              })}
            />
          </div>
        </div>
      </div>

      {/* Near Me Section */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#FF2DAA]" />
            <h2 className="text-lg font-medium text-[#E8EEF9]">Near You</h2>
          </div>
          <button className="text-sm text-[#4F8CFF] flex items-center gap-1">
            See all <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {profilesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <CCProfileCardSkeleton key={i} />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <CCEmpty
            icon={Compass}
            title="No profiles found"
            description="Try adjusting your filters or expanding your search radius."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => {
              const details = creatorDetails.find(d => d.user_id === profile.user_id);
              return (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  creatorDetails={details}
                  distance={Math.random() * 50}
                  onFavorite={(p) => console.log('Favorite:', p)}
                  onMessage={(p) => console.log('Message:', p)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Traveling Soon Section */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">✈️</span>
            <h2 className="text-lg font-medium text-[#E8EEF9]">Traveling Soon</h2>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
          {profiles.filter(p => p.travel_enabled && p.travel_dates?.length > 0).slice(0, 5).map((profile) => {
            const details = creatorDetails.find(d => d.user_id === profile.user_id);
            return (
              <div key={profile.id} className="w-72 flex-shrink-0">
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  creatorDetails={details}
                  showActions={false}
                  compact
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}