/**
 * SavePropertyToFavoritesButton
 * Reusable heart button to add/remove a property from the user's favorites.
 * Extends the existing Favorite entity using the new property_items array.
 * Usage: <SavePropertyToFavoritesButton propertyId={property.id} userEmail={user.email} />
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';

export default function SavePropertyToFavoritesButton({ propertyId, userEmail, className = '' }) {
  const [showPicker, setShowPicker] = useState(false);
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', userEmail],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: userEmail }),
    enabled: !!userEmail && showPicker,
  });

  // Is this property saved in any list?
  const isSaved = favorites.some(f =>
    f.property_items?.some(p => p.property_id === propertyId && p.available !== false)
  );

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        // Remove from all lists
        for (const fav of favorites) {
          if (fav.property_items?.some(p => p.property_id === propertyId)) {
            await base44.entities.Favorite.update(fav.id, {
              property_items: fav.property_items.filter(p => p.property_id !== propertyId),
            });
          }
        }
        return 'removed';
      }

      // Add to default list (or first list, or create one)
      let target = favorites.find(f => f.is_default) || favorites[0];
      if (!target) {
        target = await base44.entities.Favorite.create({
          owner_id: userEmail,
          name: 'Saved Properties',
          items: [],
          property_items: [],
        });
      }
      const existing = target.property_items || [];
      await base44.entities.Favorite.update(target.id, {
        property_items: [
          ...existing,
          { property_id: propertyId, added_at: new Date().toISOString(), available: true },
        ],
      });
      return 'saved';
    },
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['favoriteProperties', userEmail] });
      toast.success(action === 'saved' ? 'Property saved to favorites' : 'Removed from favorites');
    },
  });

  if (!userEmail) return null;

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleMutation.mutate(); }}
      disabled={toggleMutation.isPending}
      className={`p-2 rounded-full transition-all ${
        isSaved
          ? 'bg-[#FF2DAA]/20 text-[#FF2DAA] hover:bg-[#FF2DAA]/30'
          : 'bg-black/40 text-white hover:bg-black/60'
      } ${className}`}
      title={isSaved ? 'Remove from favorites' : 'Save to favorites'}
    >
      <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
    </button>
  );
}