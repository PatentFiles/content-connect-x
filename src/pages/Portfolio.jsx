import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Camera, 
  Video,
  Trash2,
  Upload
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import AccessGate from '@/components/auth/AccessGate';

export default function Portfolio() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    categories: [],
    creator_types: [],
    location_city: '',
    location_state: '',
  });
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles[0];

  const { data: portfolioItems = [], isLoading: portfolioLoading } = useQuery({
    queryKey: ['myPortfolio', user?.email],
    queryFn: () => base44.entities.ServicePortfolioItem.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setNewItem({ ...newItem, media_url: file_url, thumbnail_url: file_url });
    setUploading(false);
  };

  const addItemMutation = useMutation({
    mutationFn: (data) => base44.entities.ServicePortfolioItem.create({
      ...data,
      user_id: user.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myPortfolio']);
      setShowAddModal(false);
      setNewItem({
        title: '',
        description: '',
        categories: [],
        creator_types: [],
        location_city: '',
        location_state: '',
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.ServicePortfolioItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['myPortfolio']);
    },
  });

  const toggleCategory = (category) => {
    const current = newItem.categories;
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    setNewItem({ ...newItem, categories: updated });
  };

  const toggleCreatorType = (type) => {
    const current = newItem.creator_types;
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setNewItem({ ...newItem, creator_types: updated });
  };

  if (userLoading || portfolioLoading) {
    return <CCLoadingScreen message="Loading portfolio..." />;
  }

  if (!['photographer', 'videographer'].includes(profile?.role_type)) {
    return <AccessGate type="both" />;
  }

  const isVideographer = profile?.role_type === 'videographer';

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">
              {isVideographer ? 'Reels/Portfolio' : 'Portfolio'}
            </h1>
            <p className="text-[#6B7A94]">Showcase your work</p>
          </div>
          <CCButton variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Item
          </CCButton>
        </div>

        {portfolioItems.length === 0 ? (
          <CCEmpty
            icon={isVideographer ? Video : Camera}
            title="No portfolio items yet"
            description="Start showcasing your work"
            action={() => setShowAddModal(true)}
            actionLabel="Add First Item"
          />
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {portfolioItems.map(item => (
              <CCCard key={item.id} padding="none" className="overflow-hidden">
                <div className="aspect-video bg-[#151D2B]">
                  <img 
                    src={item.thumbnail_url || item.media_url} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-[#E8EEF9] mb-2">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-[#9AA6BC] mb-3">{item.description}</p>
                  )}
                  {item.categories && item.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.categories.map(cat => (
                        <CCBadge key={cat} variant="primary" size="sm">{cat}</CCBadge>
                      ))}
                    </div>
                  )}
                  {item.location_city && (
                    <p className="text-xs text-[#6B7A94] mb-3">
                      {item.location_city}{item.location_state && `, ${item.location_state}`}
                    </p>
                  )}
                  <CCButton 
                    variant="danger" 
                    size="sm" 
                    fullWidth 
                    icon={Trash2}
                    onClick={() => deleteItemMutation.mutate(item.id)}
                  >
                    Delete
                  </CCButton>
                </div>
              </CCCard>
            ))}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <CCModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Portfolio Item"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Upload Media</label>
            <label className="flex items-center justify-center gap-2 p-6 bg-[#151D2B] border-2 border-dashed border-[#263248] rounded-lg cursor-pointer hover:border-[#4F8CFF] transition-colors">
              <Upload className="w-5 h-5 text-[#6B7A94]" />
              <span className="text-sm text-[#9AA6BC]">
                {uploading ? 'Uploading...' : newItem.media_url ? 'File uploaded' : 'Click to upload'}
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          <CCInput
            label="Title"
            placeholder="Give your work a title..."
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Description</label>
            <textarea
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px]"
              placeholder="Describe this work..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {['Portrait', 'Studio', 'Outdoor', 'BTS', 'Cinematic', 'Documentary', 'Social', 'Promo'].map(cat => (
                <CCButton
                  key={cat}
                  variant={newItem.categories.includes(cat) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </CCButton>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Creator Types</label>
            <div className="flex flex-wrap gap-2">
              {['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Trans Male', 'Trans Female'].map(type => (
                <CCButton
                  key={type}
                  variant={newItem.creator_types.includes(type) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleCreatorType(type)}
                >
                  {type}
                </CCButton>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CCInput
              label="City"
              placeholder="Los Angeles"
              value={newItem.location_city}
              onChange={(e) => setNewItem({ ...newItem, location_city: e.target.value })}
            />
            <CCInput
              label="State"
              placeholder="CA"
              value={newItem.location_state}
              onChange={(e) => setNewItem({ ...newItem, location_state: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary"
              onClick={() => addItemMutation.mutate(newItem)}
              loading={addItemMutation.isPending}
              disabled={!newItem.media_url || !newItem.title}
            >
              Add to Portfolio
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}