import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';

export default function CatalogModeration() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const queryClient = useQueryClient();

  const { data: pendingSubmissions = [] } = useQuery({
    queryKey: ['customValueSubmissions', 'pending'],
    queryFn: () => base44.entities.CustomValueSubmission.filter({ status: 'pending' }),
  });

  const { data: catalogItems = [] } = useQuery({
    queryKey: ['catalogItems'],
    queryFn: () => base44.entities.ContentCatalogItem.list(),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ submissionId, category, value }) => {
      // Create catalog item
      const catalogItem = await base44.entities.ContentCatalogItem.create({
        category,
        value,
        status: 'active',
        approved_by: (await base44.auth.me()).email,
        approved_at: new Date().toISOString()
      });

      // Update submission
      await base44.entities.CustomValueSubmission.update(submissionId, {
        status: 'approved'
      });

      return catalogItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customValueSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['catalogItems'] });
      toast.success('Item approved and added to catalog');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (submissionId) => {
      await base44.entities.CustomValueSubmission.update(submissionId, {
        status: 'rejected'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customValueSubmissions'] });
      toast.success('Item rejected');
    },
  });

  const toggleItemSelection = (id) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    const items = pendingSubmissions.filter(s => selectedItems.includes(s.id));
    
    for (const item of items) {
      await approveMutation.mutateAsync({
        submissionId: item.id,
        category: item.category,
        value: item.custom_value
      });
    }
    
    setSelectedItems([]);
  };

  const handleBulkReject = async () => {
    for (const id of selectedItems) {
      await rejectMutation.mutateAsync(id);
    }
    
    setSelectedItems([]);
  };

  const categories = [
    'all',
    'scene_pairing',
    'standard_act',
    'fetish_act',
    'kink_edge_act',
    'platform',
    'niche_tag'
  ];

  const filteredSubmissions = selectedCategory === 'all'
    ? pendingSubmissions
    : pendingSubmissions.filter(s => s.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#E8EEF9]">Catalog Moderation</h2>
        <div className="flex gap-2">
          <CCBadge variant="warning">
            {pendingSubmissions.length} Pending
          </CCBadge>
          <CCBadge variant="default">
            {catalogItems.length} Active Items
          </CCBadge>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <CCButton
            key={cat}
            variant={selectedCategory === cat ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.replace(/_/g, ' ')}
          </CCButton>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <CCCard padding="md">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9AA6BC]">
              {selectedItems.length} items selected
            </span>
            <div className="flex gap-2">
              <CCButton
                variant="success"
                size="sm"
                icon={Check}
                onClick={handleBulkApprove}
              >
                Approve All
              </CCButton>
              <CCButton
                variant="danger"
                size="sm"
                icon={X}
                onClick={handleBulkReject}
              >
                Reject All
              </CCButton>
            </div>
          </div>
        </CCCard>
      )}

      {/* Pending Submissions */}
      <div className="space-y-3">
        {filteredSubmissions.map(submission => (
          <CCCard key={submission.id} padding="md">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedItems.includes(submission.id)}
                onChange={() => toggleItemSelection(submission.id)}
                className="w-4 h-4 rounded border-[#263248] bg-[#121824] text-[#4F8CFF]"
              />
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium text-[#E8EEF9]">
                    {submission.custom_value}
                  </span>
                  <CCBadge variant="default" size="sm">
                    {submission.category.replace(/_/g, ' ')}
                  </CCBadge>
                </div>
                <div className="text-xs text-[#6B7A94]">
                  Submitted by {submission.submitted_by} on{' '}
                  {new Date(submission.created_date).toLocaleDateString()}
                </div>
              </div>

              <div className="flex gap-2">
                <CCButton
                  variant="success"
                  size="sm"
                  icon={Check}
                  onClick={() => approveMutation.mutate({
                    submissionId: submission.id,
                    category: submission.category,
                    value: submission.custom_value
                  })}
                  loading={approveMutation.isPending}
                >
                  Approve
                </CCButton>
                <CCButton
                  variant="danger"
                  size="sm"
                  icon={X}
                  onClick={() => rejectMutation.mutate(submission.id)}
                  loading={rejectMutation.isPending}
                >
                  Reject
                </CCButton>
              </div>
            </div>
          </CCCard>
        ))}

        {filteredSubmissions.length === 0 && (
          <CCCard padding="lg">
            <div className="text-center text-[#6B7A94]">
              No pending submissions in this category
            </div>
          </CCCard>
        )}
      </div>
    </div>
  );
}