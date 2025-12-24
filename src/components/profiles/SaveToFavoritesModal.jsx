import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Heart, Plus, Check } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';
import CCModal from '@/components/ui-custom/CCModal';

export default function SaveToFavoritesModal({ 
  isOpen, 
  onClose, 
  profileUserId, 
  userEmail 
}) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState('');
  const queryClient = useQueryClient();

  // Fetch user's favorites
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites', userEmail],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: userEmail }),
    enabled: !!userEmail && isOpen,
  });

  // Add to favorites mutation
  const addToFavoritesMutation = useMutation({
    mutationFn: async (favoriteId) => {
      const favorite = favorites.find(f => f.id === favoriteId);
      const currentItems = favorite.items || [];
      const updatedItems = [...currentItems, { user_id: profileUserId, added_at: new Date().toISOString() }];
      await base44.entities.Favorite.update(favoriteId, { 
        items: updatedItems 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
      toast.success('Saved to favorites');
      onClose();
    },
  });

  // Create new favorites list mutation
  const createFavoritesMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Favorite.create({
        owner_id: userEmail,
        name: newListName,
        items: [{ user_id: profileUserId, added_at: new Date().toISOString() }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
      toast.success('Saved to new list');
      setNewListName('');
      setIsCreatingNew(false);
      onClose();
    },
  });

  const handleSaveToList = (favoriteId) => {
    addToFavoritesMutation.mutate(favoriteId);
  };

  const handleCreateNew = () => {
    if (!newListName.trim()) {
      toast.error('Please enter a list name');
      return;
    }
    createFavoritesMutation.mutate();
  };

  const isSavedInList = (favorite) => {
    return favorite.items?.some(item => item.user_id === profileUserId);
  };

  return (
    <CCModal
      isOpen={isOpen}
      onClose={onClose}
      title="Save to Favorites"
      description="Choose a list or create a new one"
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-[#4F8CFF] border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : (
          <>
            {/* Existing lists */}
            {favorites.length > 0 && (
              <div className="space-y-2">
                {favorites.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => !isSavedInList(list) && handleSaveToList(list.id)}
                    disabled={isSavedInList(list) || addToFavoritesMutation.isPending}
                    className="w-full flex items-center justify-between p-3 bg-[#151D2B] hover:bg-[#1A2438] rounded-lg border border-[#263248] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-[#FF2DAA]" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-[#E8EEF9]">{list.name}</p>
                        <p className="text-xs text-[#6B7A94]">
                          {list.items?.length || 0} profiles
                        </p>
                      </div>
                    </div>
                    {isSavedInList(list) && (
                      <Check className="w-5 h-5 text-[#22C55E]" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Create new list */}
            {!isCreatingNew ? (
              <CCButton
                variant="outline"
                icon={Plus}
                onClick={() => setIsCreatingNew(true)}
                fullWidth
              >
                Create New List
              </CCButton>
            ) : (
              <div className="space-y-3">
                <CCInput
                  label="New List Name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Los Angeles Models"
                />
                <div className="flex gap-2">
                  <CCButton
                    variant="outline"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewListName('');
                    }}
                    fullWidth
                  >
                    Cancel
                  </CCButton>
                  <CCButton
                    variant="primary"
                    onClick={handleCreateNew}
                    loading={createFavoritesMutation.isPending}
                    fullWidth
                  >
                    Create & Save
                  </CCButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CCModal>
  );
}