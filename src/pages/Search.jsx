import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import { Search as SearchIcon, X, Users, Camera, Video, Briefcase, Building, Film } from 'lucide-react';
import TravelSync from '@/components/discovery/TravelSync';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen, CCProfileCardSkeleton } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import ProfileCard from '@/components/profiles/ProfileCard';
import ProfileFilters from '@/components/profiles/ProfileFilters';
import SaveToFavoritesModal from '@/components/profiles/SaveToFavoritesModal';
import ReportModal from '@/components/moderation/ReportModal';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';

const roleOptions = [
  { value: 'creator', label: 'Creators', icon: Users },
  { value: 'photographer', label: 'Photographers', icon: Camera },
  { value: 'videographer', label: 'Videographers', icon: Video },
  { value: 'video_editor', label: 'Video Editors', icon: Film },
  { value: 'agent', label: 'Agents', icon: Briefcase },
  { value: 'studio', label: 'Studios', icon: Building },
];

// Note: Video editors role_type is already in UserProfile enum; search includes them automatically.

export default function Search() {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUserId, setReportTargetUserId] = useState(null);
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [filters, setFilters] = useState({
    roleTypes: [],
    orientations: [],
    sceneTypes: [],
    tags: [],
    compensation: [],
    nearMe: false,
    travelAvailable: false,
    verifiedOnly: true,
    testingRequired: false,
    recentlyActive: false,
    sortBy: 'recently_active',
    country: '',
    state: '',
    city: '',
  });

  // Check auth and access
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: myProfile = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const isAdmin = myProfile?.[0]?.is_admin || user?.role === 'admin';
  const isSubscribed = isAdmin || subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch all creator details and verifications with staleTime and limits
  const { data: allVerifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list('-created_date', 1000),
    enabled: !!user && isSubscribed,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allTestingCredentials = [] } = useQuery({
    queryKey: ['allTestingCredentials'],
    queryFn: () => base44.entities.TestingCredential.list('-updated_date', 500),
    enabled: !!user && isSubscribed && filters.testingRequired,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allCreatorDetails = [] } = useQuery({
    queryKey: ['allCreatorDetails'],
    queryFn: () => base44.entities.CreatorDetails.list('-updated_date', 500),
    enabled: !!user && isSubscribed,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch unified search results (profiles + properties)
  const { data: searchResults = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['extendedSearch', searchQuery],
    queryFn: () => base44.functions.invoke('extendedSearch', { query: searchQuery, limit: 100 }),
    enabled: !!user && isSubscribed,
    staleTime: 5 * 60 * 1000,
  });

  // Unified results — already sorted by relevance from backend
  const unifiedResults = searchResults?.data?.results || [];

  // Filter unified results (already ranked by backend)
  const filteredResults = useMemo(() => {
    if (!unifiedResults.length) return [];
    let filtered = [...unifiedResults];

    // Profile-only filters
    const profileFiltered = filtered.filter(r => {
      if (r.type !== 'profile') return true; // Keep properties as-is
      const p = r;
      if (p.user_id === user?.email || p.is_admin) return false;
      
      // Role filter
      if (selectedRole && p.role_type !== selectedRole) return false;
      if (filters.roleTypes?.length > 0 && !filters.roleTypes.includes(p.role_type)) return false;

      // Location filters
      if (filters.country && !p.base_location?.country?.toLowerCase().includes(filters.country.toLowerCase())) return false;
      if (filters.state && !p.base_location?.state?.toLowerCase().includes(filters.state.toLowerCase())) return false;
      if (filters.city && !p.base_location?.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;

      // Travel
      if (filters.travelAvailable && !p.travel_enabled) return false;

      // Recently active
      if (filters.recentlyActive) {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        if (!p.last_active_at || new Date(p.last_active_at) < threeDaysAgo) return false;
      }

      return true;
    });

    // Creator-specific filters (need allCreatorDetails)
    const finalFiltered = profileFiltered.filter(r => {
      if (r.type !== 'profile') return true;
      const p = r;

      if (filters.orientations?.length > 0) {
        if (p.role_type !== 'creator') return true;
        const details = allCreatorDetails.find(d => d.user_id === p.user_id);
        if (!details?.orientation_category) return false;
        return Array.isArray(details.orientation_category)
          ? details.orientation_category.some(o => filters.orientations.includes(o))
          : filters.orientations.includes(details.orientation_category);
      }

      if (filters.sceneTypes?.length > 0) {
        if (p.role_type !== 'creator') return true;
        const details = allCreatorDetails.find(d => d.user_id === p.user_id);
        if (!details) return true;
        return filters.sceneTypes.some(st => {
          if (st === 'standard') return details.standard_acts?.length > 0;
          if (st === 'fetish') return details.fetish_acts?.length > 0;
          if (st === 'kink_edge') return details.kink_edge_acts?.length > 0;
          return false;
        });
      }

      if (filters.compensation?.length > 0) {
        if (p.role_type !== 'creator') return true;
        const details = allCreatorDetails.find(d => d.user_id === p.user_id);
        if (!details) return true;
        const prefs = details.compensation_preferences || [];
        return prefs.length === 0 || filters.compensation.some(c => prefs.includes(c));
      }

      return true;
    });

    // Verified filter (profile only)
    const verifiedFiltered = finalFiltered.filter(r => {
      if (r.type !== 'profile') return true;
      if (!filters.verifiedOnly) return true;
      const verifiedIds = allVerifications.filter(v => v.status === 'approved').map(v => v.user_id);
      return verifiedIds.includes(r.user_id);
    });

    // Testing filter (profile only)
    const testingFiltered = verifiedFiltered.filter(r => {
      if (r.type !== 'profile') return true;
      if (!filters.testingRequired) return true;
      const now = new Date();
      const validIds = allTestingCredentials
        .filter(tc => tc.status_badge === 'valid' && !(tc.expires_at && new Date(tc.expires_at) < now))
        .map(tc => tc.user_id);
      return validIds.includes(r.user_id);
    });

    return testingFiltered.slice(0, 50);
  }, [unifiedResults, selectedRole, filters, allVerifications, allCreatorDetails, allTestingCredentials, user?.email]);

  const profiles = useMemo(() => filteredResults.filter(r => r.type === 'profile'), [filteredResults]);
  const properties = useMemo(() => filteredResults.filter(r => r.type === 'property'), [filteredResults]);

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
      queryClient.invalidateQueries(['searchProfiles']);
      toast.success('User blocked');
    },
  });

  const [confirmBlockUserId, setConfirmBlockUserId] = useState(null);
  const handleBlock = (profile) => {
    setConfirmBlockUserId(profile.user_id);
  };

  const handleReport = (profile) => {
    setReportTargetUserId(profile.user_id);
    setShowReportModal(true);
  };

  if (userLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  return (
    <FeatureRouteGuard flag="search" requiresSubscription={true}>
      <div className="min-h-screen pb-20 md:pb-8" style={{ backgroundColor: 'var(--cc-bg)' }}>
      {/* Search Header */}
      <div className="sticky top-16 z-30 backdrop-blur-xl border-b" style={{ backgroundColor: 'color-mix(in srgb, var(--cc-bg) 95%, transparent)', borderColor: 'var(--cc-border)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Title */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--cc-text-primary)' }}>Search</h1>
            <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Find your next collaboration</p>
          </div>
          {/* Search Input — centered with max width */}
          <div className="flex gap-3 mb-4 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--cc-text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name, location, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 transition-all duration-200"
                style={{ backgroundColor: 'var(--cc-bg)', border: '1px solid var(--cc-border)', color: 'var(--cc-text-primary)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--cc-text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Role Quick Filters + Filters button */}
          <div className="flex flex-wrap gap-2 justify-center pb-2 overflow-x-auto">
            <CCButton
              variant={!selectedRole ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedRole('')}
              className="flex-shrink-0"
            >
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
                <span className="hidden sm:inline mr-1.5"><role.icon className="w-4 h-4" /></span>
                {role.label}
              </CCButton>
            ))}
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
                  nearMe: false,
                  travelAvailable: false,
                  verifiedOnly: true,
                  testingRequired: false,
                  recentlyActive: false,
                  sortBy: 'recently_active',
                  country: '',
                  state: '',
                  city: '',
                });
                setSelectedRole('');
              }}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <MobileRefreshPage onRefresh={() => queryClient.invalidateQueries({ queryKey: ['extendedSearch', searchQuery] })}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Travel Sync */}
        <div className="flex justify-center mb-6">
          <div className="w-full md:max-w-xl lg:max-w-2xl">
            <TravelSync userId={user?.email} myProfile={myProfile?.[0]} />
          </div>
        </div>
        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--cc-text-secondary)' }}>
            {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'} found
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

        {/* Unified Grid — sorted by relevance */}
        {profilesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <CCProfileCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredResults.length === 0 && !searchQuery && !selectedRole && filters.roleTypes.length === 0 ? (
          <CCEmpty
            icon={SearchIcon}
            title="Search for members & properties"
            description="Enter a name, location, or keyword above to find creators, photographers, hosts, properties, and more."
          />
        ) : filteredResults.length === 0 ? (
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
            {filteredResults.map((result) => {
              if (result.type === 'property') {
                return (
                  <Link key={result.id} to={`/PropertyDetail?id=${result.id}`}>
                    <div className="rounded-xl overflow-hidden transition-colors h-full border" style={{ backgroundColor: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
                      {result.media?.[0]?.url && (
                        <img src={result.media[0].url} alt={result.title} className="w-full h-40 object-cover" />
                      )}
                      <div className="p-4">
                        <p className="font-medium truncate" style={{ color: 'var(--cc-text-primary)' }}>{result.title}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--cc-text-secondary)' }}>{result.city}{result.state && `, ${result.state}`}</p>
                        <p className="text-xs mt-1 capitalize" style={{ color: 'var(--cc-text-muted)' }}>{result.property_type}</p>
                        {result.pricing?.hourly_rate && (
                          <p className="text-xs font-semibold mt-2" style={{ color: 'var(--cc-blue)' }}>${result.pricing.hourly_rate}/hr</p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              } else {
                const profile = result;
                const details = creatorDetails.find(d => d.user_id === profile.user_id);
                const isSaved = favorites.some(f => f.items?.some(item => item.user_id === profile.user_id));
                return (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    creatorDetails={details}
                    isSaved={isSaved}
                    onFavorite={handleFavorite}
                    onBlock={handleBlock}
                    onReport={handleReport}
                  />
                );
              }
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
      </MobileRefreshPage>
      </div>
    </FeatureRouteGuard>
  );
}