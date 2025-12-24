import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Heart, Plus, Check } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';
import { CCModal } from '@/components/ui-custom/CCModal';

export default function SaveToShortlistModal({ 
  isOpen, 
  onClose, 
  profileUserId, 
  userEmail 
}) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState('');
  const queryClient = useQueryClient();

  // Fetch user's shortlists
  const { data: shortlists = [], isLoading } = useQuery({
    queryKey: ['shortlists', userEmail],
    queryFn: () => base44.entities.Shortlist.filter({ user_id: userEmail }),
    enabled: !!userEmail && isOpen,
  });

  // Add to shortlist mutation
  const addToShortlistMutation = useMutation({
    mutationFn: async (shortlistId) => {
      const shortlist = shortlists.find(s => s.id === shortlistId);
      const updatedProfiles = [...(shortlist.saved_profiles || []), profileUserId];
      await base44.entities.Shortlist.update(shortlistId, { 
        saved_profiles: updatedProfiles 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortlists'] });
      queryClient.invalidateQueries({ queryKey: ['myShortlists'] });
      toast.success('Saved to favorites');
      onClose();
    },
  });

  // Create new shortlist mutation
  const createShortlistMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Shortlist.create({
        user_id: userEmail,
        name: newListName,
        saved_profiles: [profileUserId],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortlists'] });
      queryClient.invalidateQueries({ queryKey: ['myShortlists'] });
      toast.success('Saved to new list');
      setNewListName('');
      setIsCreatingNew(false);
      onClose();
    },
  });

  const handleSaveToList = (shortlistId) => {
    addToShortlistMutation.mutate(shortlistId);
  };

  const handleCreateNew = () => {
    if (!newListName.trim()) {
      toast.error('Please enter a list name');
      return;
    }
    createShortlistMutation.mutate();
  };

  const isSavedInList = (shortlist) => {
    return shortlist.saved_profiles?.includes(profileUserId);
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
            {shortlists.length > 0 && (
              <div className="space-y-2">
                {shortlists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => !isSavedInList(list) && handleSaveToList(list.id)}
                    disabled={isSavedInList(list) || addToShortlistMutation.isPending}
                    className="w-full flex items-center justify-between p-3 bg-[#151D2B] hover:bg-[#1A2438] rounded-lg border border-[#263248] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-[#FF2DAA]" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-[#E8EEF9]">{list.name}</p>
                        <p className="text-xs text-[#6B7A94]">
                          {list.saved_profiles?.length || 0} profiles
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
                    loading={createShortlistMutation.isPending}
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