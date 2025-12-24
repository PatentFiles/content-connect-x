import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  Plus, 
  Edit2, 
  Trash2, 
  MoreVertical,
  FolderHeart,
  Users
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen, CCSkeletonLoader } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';

export default function Shortlists() {
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedList, setSelectedList] = useState(null);
  const queryClient = useQueryClient();

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

  // Fetch favorites
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ['favorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: user?.email }),
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch profiles for favorites items
  const { data: profiles = [] } = useQuery({
    queryKey: ['favoritesProfiles', favorites],
    queryFn: async () => {
      const allUserIds = [...new Set(favorites.flatMap(f => f.items?.map(i => i.user_id) || []))];
      if (allUserIds.length === 0) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => allUserIds.includes(p.user_id));
    },
    enabled: favorites.length > 0,
  });

  // Create favorites list mutation
  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Favorite.create({
      owner_id: user.email,
      name,
      items: [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
      setIsCreating(false);
      setNewListName('');
    },
  });

  // Delete favorites list mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Favorite.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
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
    onSuccess: () => {
      queryClient.invalidateQueries(['favorites']);
      queryClient.invalidateQueries(['myFavorites']);
    },
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

  const getProfilesForList = (list) => {
    return list.items?.map(item => profiles.find(p => p.user_id === item.user_id)).filter(Boolean) || [];
  };

  return (
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
                <p className="text-xs text-[#6B7A94]">Your saved profiles</p>
              </div>
            </div>
            <CCButton variant="primary" icon={Plus} onClick={() => setIsCreating(true)}>
              New List
            </CCButton>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {favoritesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <CCCard key={i} padding="lg">
                <div className="animate-pulse space-y-3">
                  <CCSkeletonLoader className="h-6 w-32" />
                  <CCSkeletonLoader className="h-4 w-24" />
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(j => (
                      <CCSkeletonLoader key={j} className="w-8 h-8 rounded-full" />
                    ))}
                  </div>
                </div>
              </CCCard>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <CCEmpty
            icon={FolderHeart}
            title="No favorites yet"
            description="Create a list to start saving profiles you're interested in collaborating with."
            action={() => setIsCreating(true)}
            actionLabel="Create First List"
          />
        ) : (
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
        )}
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
                    <CCAvatar src={profile.avatar_url} size="md" />
                    <div className="flex-1">
                      <p className="font-medium text-[#E8EEF9]">{profile.display_name}</p>
                      <p className="text-sm text-[#6B7A94] capitalize">{profile.role_type}</p>
                    </div>
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
    </div>
  );
}