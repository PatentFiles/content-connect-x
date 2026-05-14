import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Compass, MapPin, ChevronRight, Users, Camera, Video, Briefcase, Building, Film, Home, Search as SearchIcon, X } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import { CCLoadingScreen, CCProfileCardSkeleton } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import ProfileCard from '@/components/profiles/ProfileCard';
import ProfileFilters from '@/components/profiles/ProfileFilters';
import SaveToFavoritesModal from '@/components/profiles/SaveToFavoritesModal';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import ReportModal from '@/components/moderation/ReportModal';
import AgentRepresentationRequestModal from '@/components/representation/AgentRepresentationRequestModal';
import TopCreators from '@/components/discovery/TopCreators';
import TravelSync from '@/components/discovery/TravelSync';
import AgentMarketplaceCard from '@/components/marketplace/AgentMarketplaceCard';

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
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
  { value: 'video_editor', label: 'Video Editors', icon: Film },
  { value: 'agent', label: 'Talent Agents', icon: Briefcase },
  { value: 'studio', label: 'Studios', icon: Building },
];

// Note: Video editors role_type is already in UserProfile enum; discovery includes them automatically.

export default function Discovery() {
  const [activeTab, setActiveTab] = useState('profiles'); // 'profiles' or 'properties'
  const [selectedRole, setSelectedRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetUserId, setReportTargetUserId] = useState(null);
  const [showAgentRepModal, setShowAgentRepModal] = useState(false);
  const [selectedAgentUserId, setSelectedAgentUserId] = useState(null);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role') || '';

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
    sortBy: 'distance',
    city: '',
    state: '',
    country: '',
    availableDates: [],
  });

  useEffect(() => {
    if (roleParam) setSelectedRole(roleParam);
  }, []);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
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

  const isAdmin = myProfile?.[0]?.is_admin || user?.role === 'admin';
  const isSubscribed = isAdmin || subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  const { data: allVerifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list('-created_date', 1000),
    enabled: !!user && isSubscribed,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allTestingCredentials = [] } = useQuery({
    queryKey: ['allTestingCredentials'],
    queryFn: () => base44.entities.TestingCredential.list(),
    enabled: !!user && filters.testingRequired,
  });

  // Use unified search (same as Search page)
  const { data: unifiedResults = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['extendedSearch', searchQuery],
    queryFn: () => base44.functions.invoke('extendedSearch', { query: searchQuery, limit: 100 }),
    enabled: !!user && isSubscribed,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allCreatorDetails = [] } = useQuery({
    queryKey: ['allCreatorDetails'],
    queryFn: () => base44.entities.CreatorDetails.list('-updated_date', 500),
    enabled: !!user && isSubscribed,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allAgentReps = [] } = useQuery({
    queryKey: ['allAgentReps'],
    queryFn: () => base44.entities.AgentRepresentation.filter({ status: 'ACTIVE' }),
    enabled: !!user && isSubscribed,
  });

  const { data: myCreatorReps = [] } = useQuery({
    queryKey: ['myCreatorReps', user?.email],
    queryFn: () => base44.entities.AgentRepresentation.filter({ creator_user_id: user?.email }),
    enabled: !!user?.email && myProfile?.[0]?.role_type === 'creator',
  });

  const { data: allAgentDetails = [] } = useQuery({
    queryKey: ['allAgentDetails'],
    queryFn: () => base44.entities.AgentDetails.list('-updated_date', 200),
    enabled: !!user && isSubscribed && selectedRole === 'agent',
    staleTime: 10 * 60 * 1000,
  });

  const { data: allStudioRosters = [] } = useQuery({
    queryKey: ['allStudioRosters'],
    queryFn: () => base44.entities.StudioRoster.filter({ status: 'ACTIVE' }, '-updated_date', 200),
    enabled: !!user && isSubscribed,
    staleTime: 10 * 60 * 1000,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['myFavorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: reputationScores = [] } = useQuery({
    queryKey: ['discoveryReputationScores'],
    queryFn: () => base44.entities.ReputationScore.list('-score', 100),
    enabled: !!user && isSubscribed,
    staleTime: 10 * 60 * 1000,
  });

  const favQueryKey = ['myFavorites', user?.email];

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
      queryClient.invalidateQueries({ queryKey: favQueryKey });
      toast.success('Removed from favorites');
    },
  });

  const handleFavorite = (profile) => {
    const isSaved = favorites.some(f => f.items?.some(item => item.user_id === profile.user_id));
    if (isSaved) {
      unsaveFromFavoritesMutation.mutate(profile.user_id);
    } else {
      setSelectedProfile(profile);
      if (favorites.length === 0) {
        base44.entities.Favorite.create({
          owner_id: user.email,
          name: 'My Favorites',
          items: [{ user_id: profile.user_id, added_at: new Date().toISOString() }],
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: favQueryKey });
          toast.success('Saved to favorites');
        });
      } else {
        setShowSaveModal(true);
      }
    }
  };

  const blockUserMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.BlockedUser.create({ blocker_id: user.email, blocked_id: userId });
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

  // Filter unified results by type (already ranked by backend)
  const filteredResults = useMemo(() => {
    if (!unifiedResults.length) return [];
    let filtered = [...unifiedResults];

    // Profile-only filters
    const profileFiltered = filtered.filter(r => {
      if (r.type !== 'profile') return true;
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

    // Creator-specific filters
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



  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['creatorDetails', profiles.map(p => p.user_id)],
    queryFn: async () => {
      if (!profiles.length) return [];
      const all = await base44.entities.CreatorDetails.list();
      return all.filter(d => profiles.some(p => p.user_id === d.user_id));
    },
    enabled: profiles.length > 0,
  });

  if (userLoading) return <CCLoadingScreen message="Loading..." />;

  return (
    <FeatureRouteGuard flag="discovery" requiresSubscription={true}>
      <div className="min-h-screen pb-20 md:pb-8" style={{ backgroundColor: 'var(--cc-bg)' }}>
      <div className="sticky top-16 z-30 backdrop-blur-xl border-b" style={{ backgroundColor: 'color-mix(in srgb, var(--cc-bg) 95%, transparent)', borderColor: 'var(--cc-border)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="text-center mb-4">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--cc-text-primary)' }}>Discover</h1>
            <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Find your next collaboration</p>
          </div>
          {/* Search bar — centered with max width */}
          <div className="flex gap-3 mb-4 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--cc-text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name, location, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 transition-all duration-200"
                style={{ backgroundColor: 'var(--cc-surface)', border: '1px solid var(--cc-border)', color: 'var(--cc-text-primary)' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--cc-text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-2 justify-center mb-4">
            <CCButton
              variant={activeTab === 'profiles' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('profiles')}
            >
              Collaborators
            </CCButton>
            <CCButton
              variant={activeTab === 'properties' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('properties')}
            >
              <Home className="w-4 h-4 mr-1" />
              Host Properties
            </CCButton>
          </div>

          {/* Role pills + Filters button — only show on Collaborators tab */}
          {activeTab === 'profiles' && (
            <div className="flex flex-wrap gap-2 pb-1 justify-center">
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
              <ProfileFilters
                filters={filters}
                onChange={setFilters}
                onReset={() => {
                  setFilters({
                    roleTypes: [], orientations: [], sceneTypes: [], tags: [],
                    compensation: [], nearMe: false, travelAvailable: false,
                    verifiedOnly: true, testingRequired: false, recentlyActive: false,
                    sortBy: 'distance', country: '', state: '', city: ''
                  });
                  setSelectedRole('');
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'profiles' && (
          <div className="flex justify-center mb-4">
            <div className="flex flex-col gap-4 w-full md:max-w-xl lg:max-w-2xl">
              <TravelSync userId={user?.email} myProfile={myProfile?.[0]} />
              <div className="rounded-xl p-4" style={{ border: '1px solid var(--cc-border)', backgroundColor: 'var(--cc-surface)' }}>
                <TopCreators userId={user?.email} limit={4} title="Top Trusted Members" />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {activeTab === 'profiles' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: 'var(--cc-pink)' }} />
                  <h2 className="text-lg font-medium" style={{ color: 'var(--cc-text-primary)' }}>Near You</h2>
                </div>
                <Link to={createPageUrl('Search')} className="text-sm flex items-center gap-1" style={{ color: 'var(--cc-blue)' }}>
                  See all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {resultsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1,2,3,4,5,6].map(i => <CCProfileCardSkeleton key={i} />)}
                </div>
              ) : profiles.length === 0 ? (
                <CCEmpty icon={Compass} title="No profiles found" description="Try adjusting your filters or search query." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profiles.map((profile) => {
                    const details = creatorDetails.find(d => d.user_id === profile.user_id);
                    const verif = allVerifications.find(v => v.user_id === profile.user_id);
                    const reputationScore = reputationScores.find(r => r.user_id === profile.user_id);
                    const isRepresented = profile.role_type === 'creator' && (
                      allAgentReps.some(r => r.creator_user_id === profile.user_id) ||
                      allStudioRosters.some(r => r.creator_user_id === profile.user_id)
                    );
                    const myRepWithThisAgent = myCreatorReps.find(r => r.agent_user_id === profile.user_id);
                    const myLocation = myProfile?.[0]?.base_location;
                    const distance = myLocation?.lat && profile.base_location?.lat
                      ? calculateDistance(myLocation.lat, myLocation.lng, profile.base_location.lat, profile.base_location.lng)
                      : undefined;
                    const isSaved = favorites.some(f => f.items?.some(item => item.user_id === profile.user_id));

                    if (profile.role_type === 'agent' && myProfile?.[0]?.role_type === 'creator') {
                      const agentDet = allAgentDetails.find(d => d.user_id === profile.user_id);
                      return (
                        <AgentMarketplaceCard
                          key={profile.id}
                          agentProfile={{...profile, verified: verif?.status === 'approved'}}
                          agentDetails={agentDet}
                          representationStatus={myRepWithThisAgent}
                          reputationScore={reputationScore}
                          onRequestRepresentation={() => {
                            setSelectedProfile(profile);
                            setSelectedAgentUserId(profile.user_id);
                            setShowAgentRepModal(true);
                          }}
                        />
                      );
                    }

                    return (
                      <ProfileCard
                        key={profile.id}
                        profile={{...profile, verified: verif?.status === 'approved'}}
                        creatorDetails={details}
                        distance={distance}
                        isRepresented={isRepresented}
                        isSaved={isSaved}
                        reputationScore={reputationScore}
                        onFavorite={handleFavorite}
                        onBlock={handleBlock}
                        onReport={handleReport}
                      />
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4" style={{ color: 'var(--cc-pink)' }} />
                <h2 className="text-lg font-medium" style={{ color: 'var(--cc-text-primary)' }}>Available Host Properties</h2>
              </div>

              {resultsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map(i => <CCProfileCardSkeleton key={i} />)}
                </div>
              ) : properties.length === 0 ? (
                <CCEmpty icon={Building} title="No properties found" description="Try adjusting your search query or filters." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {properties.map((property) => (
                    <Link key={property.id} to={`/PropertyDetail?id=${property.id}`}>
                      <div className="rounded-xl overflow-hidden transition-colors h-full" style={{ backgroundColor: 'var(--cc-surface)', border: '1px solid var(--cc-border)' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cc-blue)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--cc-border)'}
                      >
                        {property.media?.[0]?.url && (
                          <img src={property.media[0].url} alt={property.title} className="w-full h-40 object-cover" />
                        )}
                        <div className="p-4">
                          <p className="font-medium truncate" style={{ color: 'var(--cc-text-primary)' }}>{property.title}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--cc-text-secondary)' }}>{property.city}{property.state && `, ${property.state}`}</p>
                          <p className="text-xs mt-1 capitalize" style={{ color: 'var(--cc-text-muted)' }}>{property.property_type}</p>
                          {property.pricing?.hourly_rate && (
                            <p className="text-xs font-semibold mt-2" style={{ color: 'var(--cc-blue)' }}>${property.pricing.hourly_rate}/hr</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {selectedProfile && (
          <SaveToFavoritesModal
            isOpen={showSaveModal}
            onClose={() => { setShowSaveModal(false); setSelectedProfile(null); }}
            profileUserId={selectedProfile.user_id}
            userEmail={user?.email}
          />
        )}

        <ReportModal
          isOpen={showReportModal}
          onClose={() => { setShowReportModal(false); setReportTargetUserId(null); }}
          targetUserId={reportTargetUserId}
          targetContentType="profile"
        />

        <AgentRepresentationRequestModal
          isOpen={showAgentRepModal}
          onClose={() => { setShowAgentRepModal(false); setSelectedAgentUserId(null); }}
          agentUserId={selectedAgentUserId}
          creatorUserId={user?.email}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['myCreatorReps'] })}
        />
      </div>
      </div>
    </FeatureRouteGuard>
  );
}