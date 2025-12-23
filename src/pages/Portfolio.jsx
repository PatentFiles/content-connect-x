import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Camera, 
  Video,
  Trash2,
  Upload,
  Star,
  GripVertical,
  Edit2,
  Tag,
  Save,
  X as XIcon
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [editingTags, setEditingTags] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    categories: [],
    creator_types: [],
    location_city: '',
    location_state: '',
    custom_tags: [],
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

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ id, is_featured }) => 
      base44.entities.ServicePortfolioItem.update(id, { is_featured }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myPortfolio']);
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: ({ id, custom_tags }) => 
      base44.entities.ServicePortfolioItem.update(id, { custom_tags }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myPortfolio']);
      setEditingTags(null);
      setNewTag('');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (updates) => 
      Promise.all(updates.map(({ id, sort_order }) => 
        base44.entities.ServicePortfolioItem.update(id, { sort_order })
      )),
    onSuccess: () => {
      queryClient.invalidateQueries(['myPortfolio']);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => base44.entities.ServicePortfolioItem.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries(['myPortfolio']);
      setSelectedItems([]);
      setBulkEditMode(false);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }) => 
      Promise.all(ids.map(id => base44.entities.ServicePortfolioItem.update(id, updates))),
    onSuccess: () => {
      queryClient.invalidateQueries(['myPortfolio']);
      setSelectedItems([]);
    },
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(portfolioItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    const updates = items.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));
    
    reorderMutation.mutate(updates);
  };

  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleBulkFeature = () => {
    bulkUpdateMutation.mutate({ ids: selectedItems, updates: { is_featured: true } });
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedItems.length} items?`)) {
      bulkDeleteMutation.mutate(selectedItems);
    }
  };

  const handleAddTag = (item) => {
    if (newTag.trim()) {
      const tags = [...(item.custom_tags || []), newTag.trim()];
      updateTagsMutation.mutate({ id: item.id, custom_tags: tags });
    }
  };

  const handleRemoveTag = (item, tagToRemove) => {
    const tags = (item.custom_tags || []).filter(t => t !== tagToRemove);
    updateTagsMutation.mutate({ id: item.id, custom_tags: tags });
  };

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
  const sortedItems = [...portfolioItems].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

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
          <div className="flex gap-2">
            {portfolioItems.length > 0 && (
              <CCButton 
                variant={bulkEditMode ? 'accent' : 'outline'} 
                icon={Edit2}
                onClick={() => {
                  setBulkEditMode(!bulkEditMode);
                  setSelectedItems([]);
                }}
              >
                {bulkEditMode ? 'Done' : 'Bulk Edit'}
              </CCButton>
            )}
            <CCButton variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
              Add Item
            </CCButton>
          </div>
        </div>

        {bulkEditMode && selectedItems.length > 0 && (
          <div className="mb-4 flex gap-2 items-center justify-between bg-[#151D2B] border border-[#263248] rounded-lg p-3">
            <span className="text-sm text-[#E8EEF9]">{selectedItems.length} selected</span>
            <div className="flex gap-2">
              <CCButton variant="primary" size="sm" icon={Star} onClick={handleBulkFeature}>
                Feature
              </CCButton>
              <CCButton variant="danger" size="sm" icon={Trash2} onClick={handleBulkDelete}>
                Delete
              </CCButton>
            </div>
          </div>
        )}

        {portfolioItems.length === 0 ? (
          <CCEmpty
            icon={isVideographer ? Video : Camera}
            title="No portfolio items yet"
            description="Start showcasing your work"
            action={() => setShowAddModal(true)}
            actionLabel="Add First Item"
          />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="portfolio">
              {(provided) => (
                <div 
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid md:grid-cols-3 gap-4"
                >
                  {sortedItems.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                        >
                          <CCCard padding="none" className={`overflow-hidden ${snapshot.isDragging ? 'shadow-2xl' : ''}`}>
                            {bulkEditMode && (
                              <div className="absolute top-2 left-2 z-10">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.includes(item.id)}
                                  onChange={() => toggleItemSelection(item.id)}
                                  className="w-5 h-5"
                                />
                              </div>
                            )}
                            <div className="relative">
                              <div {...provided.dragHandleProps} className="absolute top-2 right-2 z-10 cursor-move bg-black/50 rounded p-1">
                                <GripVertical className="w-4 h-4 text-white" />
                              </div>
                              {item.is_featured && (
                                <div className="absolute top-2 left-2 z-10">
                                  <Star className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]" />
                                </div>
                              )}
                              <div className="aspect-video bg-[#151D2B]">
                                <img 
                                  src={item.thumbnail_url || item.media_url} 
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                            <div className="p-4">
                              <h3 className="font-semibold text-[#E8EEF9] mb-2">{item.title}</h3>
                              {item.description && (
                                <p className="text-sm text-[#9AA6BC] mb-3">{item.description}</p>
                              )}
                              {item.categories && item.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {item.categories.map(cat => (
                                    <CCBadge key={cat} variant="primary" size="sm">{cat}</CCBadge>
                                  ))}
                                </div>
                              )}
                              
                              {/* Custom Tags */}
                              {editingTags === item.id ? (
                                <div className="mb-3 p-2 bg-[#0B0F14] rounded border border-[#263248]">
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {(item.custom_tags || []).map(tag => (
                                      <span key={tag} className="flex items-center gap-1 bg-[#263248] text-[#E8EEF9] text-xs px-2 py-1 rounded">
                                        {tag}
                                        <button onClick={() => handleRemoveTag(item, tag)}>
                                          <XIcon className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={newTag}
                                      onChange={(e) => setNewTag(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag(item)}
                                      placeholder="Add tag..."
                                      className="flex-1 bg-[#121824] border border-[#263248] rounded px-2 py-1 text-xs text-[#E8EEF9] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
                                    />
                                    <button onClick={() => handleAddTag(item)} className="text-[#4F8CFF] text-xs">
                                      <Save className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                item.custom_tags && item.custom_tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {item.custom_tags.map(tag => (
                                      <span key={tag} className="bg-[#263248] text-[#E8EEF9] text-xs px-2 py-1 rounded">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )
                              )}

                              {item.location_city && (
                                <p className="text-xs text-[#6B7A94] mb-3">
                                  {item.location_city}{item.location_state && `, ${item.location_state}`}
                                </p>
                              )}
                              
                              <div className="flex gap-2">
                                <CCButton 
                                  variant="outline" 
                                  size="sm" 
                                  icon={Star}
                                  onClick={() => toggleFeaturedMutation.mutate({ id: item.id, is_featured: !item.is_featured })}
                                >
                                  {item.is_featured ? 'Unfeature' : 'Feature'}
                                </CCButton>
                                <CCButton 
                                  variant="outline" 
                                  size="sm" 
                                  icon={Tag}
                                  onClick={() => setEditingTags(editingTags === item.id ? null : item.id)}
                                >
                                  Tags
                                </CCButton>
                                <CCButton 
                                  variant="danger" 
                                  size="sm" 
                                  icon={Trash2}
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                />
                              </div>
                            </div>
                          </CCCard>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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