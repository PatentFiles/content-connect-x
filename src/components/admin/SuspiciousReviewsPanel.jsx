import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ShieldAlert, Star, Eye, EyeOff, RefreshCw } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { format } from 'date-fns';

export default function SuspiciousReviewsPanel() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['suspiciousReviews'],
    queryFn: () => base44.functions.invoke('managePropertyReview', { action: 'list_suspicious' }),
  });

  const reviews = data?.data?.reviews || [];

  // Fetch properties for display
  const propertyIds = [...new Set(reviews.map(r => r.property_id).filter(Boolean))];
  const { data: properties = [] } = useQuery({
    queryKey: ['suspiciousReviewProperties', propertyIds],
    queryFn: async () => {
      if (!propertyIds.length) return [];
      const all = await base44.entities.Property.list();
      return all.filter(p => propertyIds.includes(p.id));
    },
    enabled: propertyIds.length > 0,
  });

  const getProperty = (pid) => properties.find(p => p.id === pid);

  const moderate = async (reviewId, action) => {
    setLoading(reviewId + action);
    try {
      const status = action === 'hide' ? 'hidden' : 'active';
      await base44.functions.invoke('managePropertyReview', {
        action: 'moderate',
        review_id: reviewId,
        status,
      });
      toast.success(action === 'hide' ? 'Review hidden' : 'Review restored');
      queryClient.invalidateQueries({ queryKey: ['suspiciousReviews'] });
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  if (isLoading) {
    return <div className="text-[#6B7A94] text-sm py-6 text-center">Loading suspicious reviews...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#E8EEF9] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#F59E0B]" />
            Suspicious Reviews
          </h2>
          <p className="text-sm text-[#9AA6BC] mt-1">
            Reviews with low integrity scores or manipulation flags. Review and hide or restore.
          </p>
        </div>
        <CCButton variant="outline" size="sm" icon={RefreshCw} onClick={() => refetch()}>
          Refresh
        </CCButton>
      </div>

      {reviews.length === 0 ? (
        <CCEmpty
          icon={ShieldAlert}
          title="No suspicious reviews"
          description="All reviews have full integrity scores."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map(review => {
            const property = getProperty(review.property_id);
            const integrityScore = review.review_integrity_score ?? 1.0;
            const isHidden = review.status === 'hidden';

            return (
              <CCCard key={review.id} padding="md" className={isHidden ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= review.rating ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#263248]'}`} />
                        ))}
                      </div>
                      <CCBadge
                        variant={integrityScore < 0.3 ? 'danger' : integrityScore < 0.7 ? 'warning' : 'outline'}
                        size="sm"
                      >
                        Integrity: {(integrityScore * 100).toFixed(0)}%
                      </CCBadge>
                      {isHidden && <CCBadge variant="outline" size="sm">Hidden</CCBadge>}
                      {review.status === 'active' && <CCBadge variant="success" size="sm">Active</CCBadge>}
                    </div>

                    {/* Flags */}
                    {review.integrity_flags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {review.integrity_flags.map(flag => (
                          <CCBadge key={flag} variant="warning" size="sm">
                            {flag.replace(/_/g, ' ')}
                          </CCBadge>
                        ))}
                      </div>
                    )}

                    {/* Content */}
                    {review.review_text && (
                      <p className="text-sm text-[#E8EEF9] line-clamp-2">{review.review_text}</p>
                    )}

                    {/* Meta */}
                    <div className="text-xs text-[#6B7A94] space-y-0.5">
                      <p>Reviewer: <span className="text-[#9AA6BC]">{review.reviewer_user_id}</span></p>
                      {property && <p>Property: <span className="text-[#9AA6BC]">{property.title}</span></p>}
                      {review.created_at && (
                        <p>Created: <span className="text-[#9AA6BC]">{format(new Date(review.created_at), 'MMM d, yyyy')}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!isHidden ? (
                      <CCButton
                        variant="warning"
                        size="sm"
                        icon={EyeOff}
                        loading={loading === review.id + 'hide'}
                        onClick={() => moderate(review.id, 'hide')}
                      >
                        Hide
                      </CCButton>
                    ) : (
                      <CCButton
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        loading={loading === review.id + 'restore'}
                        onClick={() => moderate(review.id, 'restore')}
                      >
                        Restore
                      </CCButton>
                    )}
                  </div>
                </div>
              </CCCard>
            );
          })}
        </div>
      )}
    </div>
  );
}