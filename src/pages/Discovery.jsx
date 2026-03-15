import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Compass, MapPin, Filter, ChevronRight, Users, Camera, Video, Briefcase, Building } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { CCLoadingScreen, CCProfileCardSkeleton } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import ProfileCard from '@/components/profiles/ProfileCard';
import ProfileFilters from '@/components/profiles/ProfileFilters';
import AccessGate from '@/components/auth/AccessGate';
import SaveToFavoritesModal from '@/components/profiles/SaveToFavoritesModal';
import ReportModal from '@/components/moderation/ReportModal';

// Calculate distance between two coordinates in miles
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const roleOptions = [
  { value: 'creator', label: 'Creators', icon: Users },
  { value: 'photographer', label: 'Photographers', icon: Camera },
  { value: 'videographer', label: 'Videographers', icon: Video },
  { value: 'agent', label: 'Agents', icon: Briefcase },
  { value: 'studio', label: 'Studios', icon: Building },
];

export default function Discovery() {
  const [selectedRole, setSelectedRole] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUserId, setReportTargetUserId] = useState(null);
  const queryClient = useQueryClient();
  
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
    testingRequired: false,
    recentlyActive: false,
    sortBy: 'distance',
    city: '',
    state: '',
    availableDates: [],
  });

  // Check auth and access
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allVerifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list(),
    enabled: !!user,
  });

  const { data: allTestingCredentials = [] } = useQuery({
    queryKey: ['allTestingCredentials'],
    queryFn: () => base44.entities.TestingCredential.list(),
    enabled: !!user && filters.testingRequired,
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

  // Fetch all profiles and creator details
  const { data: allProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: async () => {
      let profiles = await base44.entities.UserProfile.filter({ profile_complete: true });
      return profiles.filter(p => p.user_id !== user?.email && p.role_type !== 'admin');
    },
    enabled: !!user && isVerified && isSubscribed,
  });

  const { data: allCreatorDetails = [] } = useQuery({
    queryKey: ['allCreatorDetails'],
    queryFn: () => base44.entities.CreatorDetails.list(),
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch representation data for creators
  const { data: allAgentReps = [] } = useQuery({
    queryKey: ['allAgentReps'],
    queryFn: () => base44.entities.AgentRepresentation.filter({ status: 'ACTIVE' }),
    enabled: !!user && isVerified && isSubscribed,
  });

  const { data: allStudioRosters = [] } = useQuery({
    queryKey: ['allStudioRosters'],
    queryFn: () => base44.entities.StudioRoster.filter({ status: 'ACTIVE' }),
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ['myFavorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: user?.email }),
    enabled: !!user?.email,
  });

  // Unsave from favorites mutation
  const unsaveFromFavoritesMutation = useMutation({
    mutationFn: async (userId) => {
      const listsWithProfile = favorites.filter(f => f.items?.some(item => item.user_id === userId));
      await Promise.all(
        listsWithProfile.map(list => {
          const updatedItems = list.items.filter(item => item.user_id !== userId);
          return base44.entities.Favorite.update(list.id, { items: updatedItems });
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast.success('Removed from favorites');
    },
  });

  const handleFavorite = (profile) => {
    const isSaved = favorites.some(f => f.items?.some(item => item.user_id === profile.user_id));
    
    if (isSaved) {
      // Unsave directly
      unsaveFromFavoritesMutation.mutate(profile.user_id);
    } else {
      setSelectedProfile(profile);
      if (favorites.length === 0) {
        // No lists, create default
        base44.entities.Favorite.create({
          owner_id: user.email,
          name: 'My Favorites',
          items: [{ user_id: profile.user_id, added_at: new Date().toISOString() }],
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
          toast.success('Saved to favorites');
        });
      } else {
        setShowSaveModal(true);
      }
    }
  };

  const blockUserMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.BlockedUser.create({
        blocker_id: user.email,
        blocked_id: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allProfiles']);
      toast.success('User blocked');
    },
  });

  const handleBlock = (profile) => {
    if (confirm('Block this user? They will not be able to contact you.')) {
      blockUserMutation.mutate(profile.user_id);
    }
  };

  const handleReport = (profile) => {
    setReportTargetUserId(profile.user_id);
    setShowReportModal(true);
  };

  // Apply filters client-side
  const profiles = React.useMemo(() => {
    if (!allProfiles || allProfiles.length === 0) return [];
    
    let filtered = [...allProfiles];
    
    // Role type filter
    if (filters.roleTypes?.length > 0) {
      filtered = filtered.filter(p => filters.roleTypes.includes(p.role_type));
    }
    
    // Orientation filter (creators only)
    if (filters.orientations?.length > 0) {
      filtered = filtered.filter(p => {
        if (p.role_type !== 'creator') return true;
        const details = allCreatorDetails.find(d => d.user_id === p.user_id);
        if (!details || !details.orientation_category) return false;
        // orientation_category is an array, check if any match
        return Array.isArray(details.orientation_category) 
          ? details.orientation_category.some(o => filters.orientations.includes(o))
          : filters.orientations.includes(details.orientation_category);
      });
    }
    
    // Scene type filter — maps to the acts arrays in CreatorDetails
    if (filters.sceneTypes?.length > 0) {
      filtered = filtered.filter(p => {
        if (p.role_type !== 'creator') return true; // non-creators always pass
        const details = allCreatorDetails.find(d => d.user_id === p.user_id);
        if (!details) return true; // no details yet — don't hide
        const hasAnyActs = (details.standard_acts?.length > 0) || (details.fetish_acts?.length > 0) || (details.kink_edge_acts?.length > 0);
        if (!hasAnyActs) return true; // creator hasn't filled acts yet — don't hide
        return filters.sceneTypes.some(sceneType => {
          if (sceneType === 'standard') return details.standard_acts?.length > 0;
          if (sceneType === 'fetish') return details.fetish_acts?.length > 0;
          if (sceneType === 'kink_edge') return details.kink_edge_acts?.length > 0;
          return false;
        });
      });
    }
    
    // Tag filter (niche tags stored in tags array on creator details)
    if (filters.tags?.length > 0) {
      filtered = filtered.filter(p => {
        const details = allCreatorDetails.find(d => d.user_id === p.user_id);
        return details && details.niche_tags?.some(tag => filters.tags.includes(tag));
      });
    }
    
    // Compensation filter — only applies to creators
    if (filters.compensation?.length > 0) {
      filtered = filtered.filter(p => {
        if (p.role_type !== 'creator') return true;
        const details = allCreatorDetails.find(d => d.user_id === p.user_id);
        if (!details) return true; // creator hasn't filled details yet — don't hide them
        const prefs = details.compensation_preferences || [];
        if (prefs.length === 0) return true; // no prefs set — don't hide
        return filters.compensation.some(comp => prefs.includes(comp));
      });
    }
    
    // Availability mode filter
    if (filters.availabilityMode?.length > 0) {
      // This would need availability_mode field in profile - for now just pass through
      filtered = filtered.filter(p => true);
    }
    
    // Travel available filter
    if (filters.travelAvailable) {
      filtered = filtered.filter(p => p.travel_enabled);
    }
    
    // Verified only filter
    if (filters.verifiedOnly) {
      const verifiedUserIds = allVerifications
        .filter(v => v.status === 'approved')
        .map(v => v.user_id);
      filtered = filtered.filter(p => verifiedUserIds.includes(p.user_id));
    }

    // Testing required filter
    if (filters.testingRequired) {
      const now = new Date();
      const verifiedTestingUserIds = allTestingCredentials
        .filter(tc => {
          // Must be valid status
          if (tc.status_badge !== 'valid') return false;
          // Must not be expired
          if (tc.expires_at && new Date(tc.expires_at) < now) return false;
          return true;
        })
        .map(tc => tc.user_id);
      
      filtered = filtered.filter(p => verifiedTestingUserIds.includes(p.user_id));
    }
    
    // Recently active filter
    if (filters.recentlyActive) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      filtered = filtered.filter(p => 
        p.last_active_at && new Date(p.last_active_at) > threeDaysAgo
      );
    }
    
    // Location filters - only if nearMe or explicit location is set
    const myLocation = myProfile?.[0]?.base_location;
    if (filters.nearMe && myLocation?.lat && myLocation?.lng) {
      // Filter by distance
      filtered = filtered.filter(p => {
        if (!p.base_location?.lat || !p.base_location?.lng) return false;
        const distance = calculateDistance(
          myLocation.lat, myLocation.lng,
          p.base_location.lat, p.base_location.lng
        );
        return distance <= 100; // 100 miles
      });
    }
    
    if (filters.country) {
      filtered = filtered.filter(p => 
        p.base_location?.country?.toLowerCase().includes(filters.country.toLowerCase())
      );
    }
    if (filters.state) {
      filtered = filtered.filter(p => 
        p.base_location?.state?.toLowerCase().includes(filters.state.toLowerCase())
      );
    }
    if (filters.city) {
      filtered = filtered.filter(p => 
        p.base_location?.city?.toLowerCase().includes(filters.city.toLowerCase())
      );
    }
    
    // Filter by availability dates
    if (filters.availableDates?.length > 0) {
      filtered = filtered.filter(p => {
        if (!p.availability_dates || p.availability_dates.length === 0) return false;
        return filters.availableDates.some(filterDate => 
          p.availability_dates.includes(filterDate)
        );
      });
    }
    
    // Sort
    if (filters.sortBy === 'distance' && myLocation?.lat && myLocation?.lng) {
      filtered.sort((a, b) => {
        const distA = a.base_location?.lat && a.base_location?.lng
          ? calculateDistance(myLocation.lat, myLocation.lng, a.base_location.lat, a.base_location.lng)
          : 999999;
        const distB = b.base_location?.lat && b.base_location?.lng
          ? calculateDistance(myLocation.lat, myLocation.lng, b.base_location.lat, b.base_location.lng)
          : 999999;
        return distA - distB;
      });
    } else if (filters.sortBy === 'recently_active') {
      filtered.sort((a, b) => 
        new Date(b.last_active_at || 0) - new Date(a.last_active_at || 0)
      );
    } else if (filters.sortBy === 'response_time') {
      filtered.sort((a, b) => 
        (a.response_time_hours || 999) - (b.response_time_hours || 999)
      );
    } else if (filters.sortBy === 'rating') {
      filtered.sort((a, b) => {
        const ratingA = a.response_time_hours ? Math.max(1, 5 - (a.response_time_hours / 24)) : 3;
        const ratingB = b.response_time_hours ? Math.max(1, 5 - (b.response_time_hours / 24)) : 3;
        return ratingB - ratingA;
      });
    }
    
    return filtered.slice(0, 20);
  }, [allProfiles, filters, allVerifications, allCreatorDetails]);

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
          <div className="flex items-center justify-between mb-3">
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
              onReset={() => { setFilters({ roleTypes: [], orientations: [], sceneTypes: [], tags: [], compensation: [], nearMe: false, travelAvailable: false, verifiedOnly: true, testingRequired: false, recentlyActive: false, sortBy: 'distance', country: '', state: '', city: '' }); setSelectedRole(''); }}
            />
          </div>
          {/* Role Quick Filters */}
          <div className="flex flex-wrap gap-2 pb-1">
            <CCButton variant={!selectedRole ? 'primary' : 'outline'} size="sm" onClick={() => setSelectedRole('')} className="flex-shrink-0">
              All
            </CCButton>
            {roleOptions.map((role) => (
              <CCButton
                key={role.value}
                variant={selectedRole === role.value ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedRole(role.value)}
                className="flex-shrink-0"
              >
                <role.icon className="w-4 h-4 mr-1" />
                {role.label}
              </CCButton>
            ))}
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
          <Link to={createPageUrl('Search')} className="text-sm text-[#4F8CFF] flex items-center gap-1">
            See all <ChevronRight className="w-4 h-4" />
          </Link>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
            {profiles.map((profile) => {
              const details = creatorDetails.find(d => d.user_id === profile.user_id);
              const verification = allVerifications.find(v => v.user_id === profile.user_id);
              const isVerified = verification?.status === 'approved';
              const isRepresented = profile.role_type === 'creator' && (
                allAgentReps.some(r => r.creator_user_id === profile.user_id) ||
                allStudioRosters.some(r => r.creator_user_id === profile.user_id)
              );
              const myLocation = myProfile?.[0]?.base_location;
              const distance = myLocation?.lat && myLocation?.lng && profile.base_location?.lat && profile.base_location?.lng
                ? calculateDistance(myLocation.lat, myLocation.lng, profile.base_location.lat, profile.base_location.lng)
                : undefined;
              const isSaved = favorites.some(f => f.items?.some(item => item.user_id === profile.user_id));
              return (
                <ProfileCard
                  key={profile.id}
                  profile={{...profile, verified: isVerified}}
                  creatorDetails={details}
                  distance={distance}
                  isRepresented={isRepresented}
                  isSaved={isSaved}
                  onFavorite={handleFavorite}
                  onBlock={handleBlock}
                  onReport={handleReport}
                />
              );
            })}
          </div>
        )}
      </div>



      {/* Save to Favorites Modal */}
      {selectedProfile && (
        <SaveToFavoritesModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false);
            setSelectedProfile(null);
          }}
          profileUserId={selectedProfile.user_id}
          userEmail={user?.email}
        />
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportTargetUserId(null);
        }}
        targetUserId={reportTargetUserId}
        targetContentType="profile"
      />
    </div>
  );
}