import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X, Filter, Users, Camera, Video, Briefcase, Building } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';

import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen, CCProfileCardSkeleton } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import ProfileCard from '@/components/profiles/ProfileCard';
import ProfileFilters from '@/components/profiles/ProfileFilters';
import AccessGate from '@/components/auth/AccessGate';

const roleOptions = [
  { value: 'creator', label: 'Creators', icon: Users },
  { value: 'photographer', label: 'Photographers', icon: Camera },
  { value: 'videographer', label: 'Videographers', icon: Video },
  { value: 'agent', label: 'Agents', icon: Briefcase },
  { value: 'studio', label: 'Studios', icon: Building },
];

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [filters, setFilters] = useState({
    roleTypes: [],
    orientations: [],
    sceneTypes: [],
    tags: [],
    compensation: [],
    skills: [],
    nearMe: false,
    travelAvailable: false,
    verifiedOnly: true,
    recentlyActive: false,
    sortBy: 'recently_active',
    city: '',
    state: '',
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

  const isVerified = verification?.[0]?.status === 'approved';
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch all creator details and verifications
  const { data: allVerifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list(),
    enabled: !!user && isVerified && isSubscribed,
  });

  const { data: allCreatorDetails = [] } = useQuery({
    queryKey: ['allCreatorDetails'],
    queryFn: () => base44.entities.CreatorDetails.list(),
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch profiles with filters
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['searchProfiles', searchQuery, selectedRole, filters],
    queryFn: async () => {
      let allProfiles = await base44.entities.UserProfile.filter({ profile_complete: true });
      allProfiles = allProfiles.filter(p => p.user_id !== user?.email);

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        allProfiles = allProfiles.filter(p => 
          p.display_name?.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q) ||
          p.base_location?.city?.toLowerCase().includes(q)
        );
      }

      // Role filter
      if (selectedRole) {
        allProfiles = allProfiles.filter(p => p.role_type === selectedRole);
      } else if (filters.roleTypes?.length > 0) {
        allProfiles = allProfiles.filter(p => filters.roleTypes.includes(p.role_type));
      }

      // Orientation filter (creators only)
      if (filters.orientations?.length > 0) {
        allProfiles = allProfiles.filter(p => {
          if (p.role_type !== 'creator') return true;
          const details = allCreatorDetails.find(d => d.user_id === p.user_id);
          return details && filters.orientations.includes(details.orientation_category);
        });
      }

      // Scene type & tags
      if (filters.sceneTypes?.length > 0) {
        allProfiles = allProfiles.filter(p => {
          const details = allCreatorDetails.find(d => d.user_id === p.user_id);
          return details && details.content_categories?.some(cat => filters.sceneTypes.includes(cat));
        });
      }

      if (filters.tags?.length > 0) {
        allProfiles = allProfiles.filter(p => {
          const details = allCreatorDetails.find(d => d.user_id === p.user_id);
          return details && details.tags?.some(tag => filters.tags.includes(tag));
        });
      }

      // Compensation
      if (filters.compensation?.length > 0) {
        allProfiles = allProfiles.filter(p => {
          const details = allCreatorDetails.find(d => d.user_id === p.user_id);
          const collabTypes = details?.collab_types || [];
          return filters.compensation.some(comp => collabTypes.includes(comp));
        });
      }

      // Travel & Location
      if (filters.travelAvailable) {
        allProfiles = allProfiles.filter(p => p.travel_enabled);
      }

      if (filters.city) {
        allProfiles = allProfiles.filter(p => 
          p.base_location?.city?.toLowerCase().includes(filters.city.toLowerCase())
        );
      }

      if (filters.state) {
        allProfiles = allProfiles.filter(p => 
          p.base_location?.state?.toLowerCase().includes(filters.state.toLowerCase())
        );
      }

      // Verified only
      if (filters.verifiedOnly) {
        const verifiedUserIds = allVerifications
          .filter(v => v.status === 'approved')
          .map(v => v.user_id);
        allProfiles = allProfiles.filter(p => verifiedUserIds.includes(p.user_id));
      }

      // Recently active
      if (filters.recentlyActive) {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        allProfiles = allProfiles.filter(p => 
          p.last_active_at && new Date(p.last_active_at) > threeDaysAgo
        );
      }

      // Sort
      if (filters.sortBy === 'recently_active') {
        allProfiles.sort((a, b) => new Date(b.last_active_at || 0) - new Date(a.last_active_at || 0));
      } else if (filters.sortBy === 'response_time') {
        allProfiles.sort((a, b) => (a.response_time_hours || 999) - (b.response_time_hours || 999));
      }

      return allProfiles.slice(0, 50);
    },
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch creator details
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
      {/* Search Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Search Input */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
              <input
                type="text"
                placeholder="Search by name, location, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-10 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7A94] hover:text-[#E8EEF9]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <ProfileFilters
              filters={filters}
              onChange={setFilters}
              onReset={() => {
                setFilters({
                  roleTypes: [],
                  orientations: [],
                  sceneTypes: [],
                  tags: [],
                  compensation: [],
                  skills: [],
                  nearMe: false,
                  travelAvailable: false,
                  verifiedOnly: true,
                  recentlyActive: false,
                  sortBy: 'recently_active',
                  city: '',
                  state: '',
                });
                setSelectedRole('');
              }}
            />
          </div>

          {/* Role Quick Filters */}
          <div className="flex gap-2 justify-center overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <CCButton
              variant={!selectedRole ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedRole('')}
            >
              All
            </CCButton>
            {roleOptions.map((role) => (
              <CCButton
                key={role.value}
                variant={selectedRole === role.value ? 'primary' : 'outline'}
                size="sm"
                icon={role.icon}
                onClick={() => setSelectedRole(role.value)}
              >
                {role.label}
              </CCButton>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#9AA6BC]">
            {profiles.length} {profiles.length === 1 ? 'result' : 'results'} found
          </p>
          {(searchQuery || selectedRole || filters.roleTypes.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {searchQuery && (
                <CCBadge variant="primary" size="sm">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </CCBadge>
              )}
              {selectedRole && (
                <CCBadge variant="accent" size="sm">
                  {roleOptions.find(r => r.value === selectedRole)?.label}
                  <button onClick={() => setSelectedRole('')} className="ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </CCBadge>
              )}
            </div>
          )}
        </div>

        {/* Grid */}
        {profilesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <CCProfileCardSkeleton key={i} />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <CCEmpty
            icon={SearchIcon}
            title="No results found"
            description="Try different keywords or adjust your filters."
            action={() => {
              setSearchQuery('');
              setSelectedRole('');
            }}
            actionLabel="Clear search"
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
                  onFavorite={(p) => console.log('Favorite:', p)}
                  onMessage={(p) => console.log('Message:', p)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}