import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Heart, Plus, Trash2, FolderHeart, Users, List, Building2, MapPin
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';
import { CCLoadingScreen, CCSkeletonLoader } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import ProfileCard from '@/components/profiles/ProfileCard';
import { useFeatureFlag } from '@/lib/featureFlags';
import VerificationGate from '@/components/auth/VerificationGate';

// Role tabs for filtering saved profiles
const PROFILE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'creator', label: 'Creators' },
  { key: 'studio', label: 'Studios' },
  { key: 'agent', label: 'Agents' },
  { key: 'photographer', label: 'Photographers' },
  { key: 'videographer', label: 'Videographers' },
  { key: 'video_editor', label: 'Editors' },
];

export default function Favorites() {
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedList, setSelectedList] = useState(null);
  const [showListView, setShowListView] = useState(false);
  const [addingToList, setAddingToList] = useState(null);
  const [selectedListForAdd, setSelectedListForAdd] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | role | 'properties'
  const queryClient = useQueryClient();
  const hostingEnabled = useFeatureFlag('hosting_marketplace');

  // Check auth and access
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profileData = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const currentProfile = profileData[0];
  const isAdmin = currentProfile?.is_admin;
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch favorites
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ['favorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch all profiles for favorites items
  const allFavoriteUserIds = [...new Set(favorites.flatMap(f => f.items?.map(i => i.user_id) || []))];
  
  const { data: profiles = [] } = useQuery({
    queryKey: ['favoritesProfiles', allFavoriteUserIds],
    queryFn: async () => {
      if (allFavoriteUserIds.length === 0) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      const activeProfiles = allProfiles.filter(p =>
        allFavoriteUserIds.includes(p.user_id) &&
        !p.banned &&
        !p.account_deactivated &&
        p.deletion_status !== 'anonymized' &&
        p.deletion_status !== 'completed'
      );
      // Auto-clean deleted profiles from favorite lists
      const activeIds = new Set(activeProfiles.map(p => p.user_id));
      const deletedIds = allFavoriteUserIds.filter(id => !activeIds.has(id));
      if (deletedIds.length > 0) {
        favorites.forEach(list => {
          const hasDeleted = list.items?.some(i => deletedIds.includes(i.user_id));
          if (hasDeleted) {
            base44.entities.Favorite.update(list.id, {
              items: list.items.filter(i => !deletedIds.includes(i.user_id))
            });
          }
        });
      }
      return activeProfiles;
    },
    enabled: allFavoriteUserIds.length > 0,
  });

  // Fetch creator details for profiles
  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['favoritesCreatorDetails', allFavoriteUserIds],
    queryFn: async () => {
      if (allFavoriteUserIds.length === 0) return [];
      const allDetails = await base44.entities.CreatorDetails.list();
      return allDetails.filter(d => allFavoriteUserIds.includes(d.user_id));
    },
    enabled: allFavoriteUserIds.length > 0 && profiles.length > 0,
  });

  // Fetch favorited properties (from property_items across all lists)
  const allFavPropertyIds = useMemo(() =>
    [...new Set(favorites.flatMap(f => f.property_items?.map(p => p.property_id) || []))]
  , [favorites]);

  const { data: favProperties = [] } = useQuery({
    queryKey: ['favoriteProperties', user?.email],
    queryFn: async () => {
      if (allFavPropertyIds.length === 0) return [];
      const all = await base44.entities.Property.list();
      return all.filter(p => allFavPropertyIds.includes(p.id));
    },
    enabled: allFavPropertyIds.length > 0,
  });

  // Build property availability map: propertyId → available
  const propertyAvailMap = useMemo(() => {
    const map = {};
    favorites.forEach(f => {
      (f.property_items || []).forEach(p => { map[p.property_id] = p.available !== false; });
    });
    return map;
  }, [favorites]);

  const favQueryKey = ['favorites', user?.email];

  // Create favorites list mutation
  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Favorite.create({
      owner_id: user.email,
      name,
      items: [],
    }),
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: favQueryKey });
      const previous = queryClient.getQueryData(favQueryKey);
      const optimistic = { id: `tmp_${Date.now()}`, owner_id: user.email, name, items: [] };
      queryClient.setQueryData(favQueryKey, (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError: (_err, _name, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(favQueryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favQueryKey });
      setIsCreating(false);
      setNewListName('');
    },
  });

  // Delete favorites list mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Favorite.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: favQueryKey });
      const previous = queryClient.getQueryData(favQueryKey);
      queryClient.setQueryData(favQueryKey, (old = []) => old.filter(f => f.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(favQueryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favQueryKey });
      setSelectedList(null);
    },
  });

  // Remove profile from favorites list mutation
  const removeFromListMutation = useMutation({
    mutationFn: async ({ listId, userId }) => {
      const list = favorites.find(f => f.id === listId);
      const updatedItems = list.items.filter(item => item.user_id !== userId);
      await base44.entities.Favorite.update(listId, { items: updatedItems });
    },
    onMutate: async ({ listId, userId }) => {
      await queryClient.cancelQueries({ queryKey: favQueryKey });
      const previous = queryClient.getQueryData(favQueryKey);
      queryClient.setQueryData(favQueryKey, (old = []) =>
        old.map(f => f.id === listId
          ? { ...f, items: (f.items || []).filter(i => i.user_id !== userId) }
          : f
        )
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(favQueryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favQueryKey });
      queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
    },
  });

  // Add profile to list mutation
  const addToListMutation = useMutation({
    mutationFn: async ({ listId, userId }) => {
      const list = favorites.find(f => f.id === listId);
      const updatedItems = [...(list.items || []), { user_id: userId, added_at: new Date().toISOString() }];
      await base44.entities.Favorite.update(listId, { items: updatedItems });
    },
    onMutate: async ({ listId, userId }) => {
      await queryClient.cancelQueries({ queryKey: favQueryKey });
      const previous = queryClient.getQueryData(favQueryKey);
      queryClient.setQueryData(favQueryKey, (old = []) =>
        old.map(f => f.id === listId
          ? { ...f, items: [...(f.items || []), { user_id: userId, added_at: new Date().toISOString() }] }
          : f
        )
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(favQueryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favQueryKey });
      queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
      setAddingToList(null);
      setSelectedListForAdd('');
    },
  });

  // Role-filtered profiles for active tab — must be before early returns
  const filteredProfiles = useMemo(() => {
    if (activeTab === 'all' || activeTab === 'properties') return profiles;
    return profiles.filter(p => p.role_type === activeTab);
  }, [profiles, activeTab]);

  if (userLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  const getProfilesForList = (list) => {
    return list.items?.map(item => profiles.find(p => p.user_id === item.user_id)).filter(Boolean) || [];
  };

  const hasLists = favorites.length > 0;

  const removePropertyFromFavorites = async (propertyId) => {
    for (const fav of favorites) {
      if (fav.property_items?.some(p => p.property_id === propertyId)) {
        await base44.entities.Favorite.update(fav.id, {
          property_items: fav.property_items.filter(p => p.property_id !== propertyId),
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['favorites', user?.email] });
    queryClient.invalidateQueries({ queryKey: ['favoriteProperties', user?.email] });
  };

  return (
    <FeatureRouteGuard flag="favorites" requiresSubscription={true}>
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <Heart className="w-5 h-5 text-[#FF2DAA]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Favorites</h1>
                <p className="text-xs text-[#6B7A94]">{profiles.length} saved profiles</p>
              </div>
            </div>
            <div className="flex gap-2">
              {hasLists && (
                <CCButton 
                  variant="outline" 
                  icon={showListView ? Heart : List}
                  onClick={() => setShowListView(!showListView)}
                >
                  {showListView ? 'Profiles' : 'Lists'}
                </CCButton>
              )}
              <CCButton variant="primary" icon={Plus} onClick={() => setIsCreating(true)}>
                New List
              </CCButton>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
          {PROFILE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-[#4F8CFF] text-white'
                  : 'bg-[#121824] border border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {hostingEnabled && (
            <button
              onClick={() => setActiveTab('properties')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                activeTab === 'properties'
                  ? 'bg-[#FF2DAA] text-white'
                  : 'bg-[#121824] border border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
              }`}
            >
              <Building2 className="w-3 h-3" /> Host Properties
              {allFavPropertyIds.length > 0 && (
                <span className="ml-0.5 bg-white/20 rounded-full px-1">{allFavPropertyIds.length}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Host Properties Tab */}
        {activeTab === 'properties' ? (
          favProperties.length === 0 ? (
            <CCEmpty
              icon={Building2}
              title="No saved properties"
              description="Heart any property listing to save it here."
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {favProperties.map(prop => {
                const isAvail = propertyAvailMap[prop.id] !== false;
                const cover = prop.media?.find(m => m.is_cover) || prop.media?.[0];
                return (
                  <div key={prop.id} className={`relative ${!isAvail ? 'opacity-60' : ''}`}>
                    <Link to={`/PropertyDetail?id=${prop.id}`} className="block group">
                      <div className="bg-[#151D2B] border border-[#263248] rounded-xl overflow-hidden hover:border-[#3A4A6B] transition-all">
                        <div className="relative aspect-[4/3] bg-[#0B0F14]">
                          {cover ? (
                            <img src={cover.url} alt={prop.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Building2 className="w-10 h-10 text-[#263248]" />
                            </div>
                          )}
                          {!isAvail && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="text-xs text-white bg-[#EF4444]/80 px-2 py-1 rounded">Unavailable</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-medium text-[#E8EEF9] text-sm truncate">{prop.title}</p>
                          <p className="text-xs text-[#9AA6BC] flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />{prop.city}{prop.state && `, ${prop.state}`}
                          </p>
                          {prop.pricing?.hourly_rate && (
                            <p className="text-xs text-[#E8EEF9] mt-1 font-semibold">${prop.pricing.hourly_rate}<span className="font-normal text-[#9AA6BC]">/hr</span></p>
                          )}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => removePropertyFromFavorites(prop.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-[#EF4444]/80 text-white rounded-full transition-colors"
                      title="Remove from favorites"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : favoritesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <CCCard key={i} padding="lg">
                <div className="animate-pulse space-y-3">
                  <CCSkeletonLoader className="h-80 w-full" />
                  <CCSkeletonLoader className="h-4 w-24" />
                </div>
              </CCCard>
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <CCEmpty
            icon={FolderHeart}
            title="No favorites yet"
            description="Start saving profiles you're interested in collaborating with."
          />
        ) : showListView && hasLists ? (
          // Lists View
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((list) => {
              const listProfiles = getProfilesForList(list);
              return (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CCCard 
                    hover 
                    clickable 
                    padding="lg"
                    onClick={() => setSelectedList(list)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-[#E8EEF9]">{list.name}</h3>
                        <p className="text-sm text-[#6B7A94]">
                          {list.items?.length || 0} profile{list.items?.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {list.is_default && (
                        <CCBadge variant="primary" size="sm">Default</CCBadge>
                      )}
                    </div>

                    {listProfiles.length > 0 ? (
                      <div className="flex -space-x-2">
                        {listProfiles.slice(0, 5).map((profile, i) => (
                          <CCAvatar
                            key={i}
                            src={profile?.avatar_url}
                            size="sm"
                            className="ring-2 ring-[#151D2B]"
                          />
                        ))}
                        {list.items?.length > 5 && (
                          <div className="w-8 h-8 rounded-full bg-[#263248] flex items-center justify-center text-xs text-[#9AA6BC] ring-2 ring-[#151D2B]">
                            +{list.items.length - 5}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-[#6B7A94]">
                        <Users className="w-4 h-4" />
                        No profiles saved yet
                      </div>
                    )}
                  </CCCard>
                </motion.div>
              );
            })}
          </div>
        ) : (
          // Profile Cards View
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProfiles.map((profile) => {
              const details = creatorDetails.find(d => d.user_id === profile.user_id);
              return (
                <div key={profile.user_id} className="relative">
                  <ProfileCard
                    profile={profile}
                    creatorDetails={details}
                    showActions={false}
                  />
                  <div className="mt-2 flex gap-2">
                    {hasLists && (
                      <CCButton
                        variant="outline"
                        size="sm"
                        fullWidth
                        icon={Plus}
                        onClick={() => setAddingToList(profile)}
                      >
                        Add to List
                      </CCButton>
                    )}
                    <CCButton
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => {
                        // Remove from all lists
                        favorites.forEach(list => {
                          if (list.items?.some(i => i.user_id === profile.user_id)) {
                            removeFromListMutation.mutate({ listId: list.id, userId: profile.user_id });
                          }
                        });
                      }}
                    >
                      Remove
                    </CCButton>
                  </div>
                </div>
              );
            })}
          </div>
        ) }
      </div>

      {/* Create List Modal */}
      <CCModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Create New List"
      >
        <div className="space-y-4">
          <CCInput
            label="List Name"
            placeholder="e.g., Miami Photographers"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={() => createMutation.mutate(newListName)}
              loading={createMutation.isPending}
              disabled={!newListName.trim()}
            >
              Create
            </CCButton>
          </div>
        </div>
      </CCModal>

      {/* View List Modal */}
      <CCModal
        isOpen={!!selectedList}
        onClose={() => setSelectedList(null)}
        title={selectedList?.name}
        size="lg"
      >
        {selectedList && (
          <div>
            <div className="flex justify-between mb-4">
              <p className="text-sm text-[#9AA6BC]">
                {selectedList.items?.length || 0} profiles in this list
              </p>
              <CCButton
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => deleteMutation.mutate(selectedList.id)}
                loading={deleteMutation.isPending}
              >
                Delete List
              </CCButton>
            </div>
            
            {getProfilesForList(selectedList).length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {getProfilesForList(selectedList).map((profile) => (
                  <div 
                    key={profile.user_id}
                    className="flex items-center gap-3 p-3 bg-[#121824] rounded-lg"
                  >
                    <Link 
                      to={createPageUrl('ViewProfile') + '?id=' + profile.user_id}
                      className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                    >
                      <CCAvatar src={profile.avatar_url} size="md" />
                      <div className="flex-1">
                        <p className="font-medium text-[#E8EEF9]">{profile.display_name}</p>
                        <p className="text-sm text-[#6B7A94] capitalize">{profile.role_type}</p>
                      </div>
                    </Link>
                    <CCButton 
                      variant="ghost" 
                      size="sm"
                      icon={Trash2}
                      onClick={() => removeFromListMutation.mutate({ 
                        listId: selectedList.id, 
                        userId: profile.user_id 
                      })}
                      loading={removeFromListMutation.isPending}
                    >
                      Remove
                    </CCButton>
                  </div>
                ))}
              </div>
            ) : (
              <CCEmpty
                icon={Users}
                title="Empty list"
                description="Save profiles to this list from their profile pages."
              />
            )}
          </div>
        )}
      </CCModal>

      {/* Add to List Modal */}
      <CCModal
        isOpen={!!addingToList}
        onClose={() => {
          setAddingToList(null);
          setSelectedListForAdd('');
        }}
        title="Add to List"
      >
        {addingToList && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-[#121824] rounded-lg">
              <CCAvatar src={addingToList.avatar_url} size="md" />
              <div>
                <p className="font-medium text-[#E8EEF9]">{addingToList.display_name}</p>
                <p className="text-sm text-[#6B7A94] capitalize">{addingToList.role_type}</p>
              </div>
            </div>
            
            <CCSelect
              label="Select List"
              value={selectedListForAdd}
              onChange={(e) => setSelectedListForAdd(e.target.value)}
              options={favorites.map(list => ({
                value: list.id,
                label: list.name
              }))}
              placeholder="Choose a list..."
            />

            <div className="flex gap-3 justify-end">
              <CCButton 
                variant="outline" 
                onClick={() => {
                  setAddingToList(null);
                  setSelectedListForAdd('');
                }}
              >
                Cancel
              </CCButton>
              <CCButton
                variant="primary"
                onClick={() => addToListMutation.mutate({ 
                  listId: selectedListForAdd, 
                  userId: addingToList.user_id 
                })}
                loading={addToListMutation.isPending}
                disabled={!selectedListForAdd}
              >
                Add to List
              </CCButton>
            </div>
          </div>
        )}
      </CCModal>
      </div>
    </FeatureRouteGuard>
  );
}