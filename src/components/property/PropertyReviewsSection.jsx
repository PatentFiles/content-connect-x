import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Star, MessageSquare, ShieldCheck } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { format } from 'date-fns';

export default function PropertyReviewsSection({ propertyId }) {
  const { data: reviews = [] } = useQuery({
    queryKey: ['propertyReviews', propertyId],
    queryFn: () =>
      base44.entities.PropertyReview.filter({
        property_id: propertyId,
        status: 'active',
      }, '-created_date', 50),
    enabled: !!propertyId,
  });

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-[#9AA6BC]">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#6B7A94]" />
        <p className="text-sm">No reviews yet</p>
      </div>
    );
  }

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[#E8EEF9]">
            {averageRating}
          </span>
          <span className="text-sm text-[#6B7A94]">out of 5</span>
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((num) => (
            <Star
              key={num}
              className={`w-4 h-4 ${
                num <= Math.round(averageRating)
                  ? 'fill-[#F59E0B] text-[#F59E0B]'
                  : 'text-[#263248]'
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-[#9AA6BC] ml-auto">
          {reviews.length} review{reviews.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Reviews List */}
       <div className="space-y-3 mt-6">
         {reviews.map((review) => (
           <CCCard key={review.id} padding="md" className="border-l-2 border-[#4F8CFF]">
             <div className="flex items-start justify-between mb-2">
               <div className="flex items-center gap-2 flex-1">
                 <div className="flex gap-0.5">
                   {[1, 2, 3, 4, 5].map((num) => (
                     <Star
                       key={num}
                       className={`w-3 h-3 ${
                         num <= review.rating
                           ? 'fill-[#F59E0B] text-[#F59E0B]'
                           : 'text-[#263248]'
                       }`}
                     />
                   ))}
                 </div>
                 <span className="text-xs text-[#6B7A94]">
                   {format(new Date(review.created_at), 'MMM d, yyyy')}
                 </span>
               </div>
             </div>

             {/* Verified Booking Badge */}
             <div className="flex items-center gap-2 mb-2">
               <CCBadge variant="success" size="sm" icon={ShieldCheck}>
                 Verified Booking
               </CCBadge>
               {review.reviewer_role_type && (
                 <CCBadge variant="outline" size="sm">
                   {review.reviewer_role_type.replace(/_/g, ' ')}
                 </CCBadge>
               )}
             </div>

             {review.review_text && (
               <p className="text-sm text-[#E8EEF9]">{review.review_text}</p>
             )}
           </CCCard>
         ))}
       </div>
    </div>
  );
}