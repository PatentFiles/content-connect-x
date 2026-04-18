import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Star } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';

export default function PropertyReviewPromptModal({
  isOpen,
  onClose,
  sessionId,
  propertyId,
  propertyTitle,
}) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const queryClient = useQueryClient();

  const createReviewMutation = useMutation({
    mutationFn: async () => {
      await base44.functions.invoke('managePropertyReview', {
        action: 'create',
        session_id: sessionId,
        property_id: propertyId,
        rating,
        review_text: reviewText,
      });
    },
    onSuccess: () => {
      toast.success('Review submitted!');
      queryClient.invalidateQueries({ queryKey: ['propertyReviews'] });
      onClose();
      setRating(5);
      setReviewText('');
    },
    onError: () => {
      toast.error('Failed to submit review');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="fixed inset-0" onClick={onClose} />
      <CCCard padding="none" className="relative w-full max-w-md">
        <div className="sticky top-0 bg-[#151D2B] border-b border-[#263248] p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#E8EEF9]">Leave a Review</h2>
          <button
            onClick={onClose}
            className="text-[#6B7A94] hover:text-[#E8EEF9]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[#9AA6BC]">
            How was your experience at <strong>{propertyTitle}</strong>?
          </p>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
              Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setRating(num)}
                  className="transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      num <= rating
                        ? 'fill-[#F59E0B] text-[#F59E0B]'
                        : 'text-[#263248]'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Review Text */}
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
              Your Review (optional)
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience..."
              maxLength={500}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-3 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px] resize-none"
            />
            <p className="text-xs text-[#6B7A94] mt-1">
              {reviewText.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <CCButton variant="outline" fullWidth onClick={onClose}>
              Skip
            </CCButton>
            <CCButton
              variant="primary"
              fullWidth
              onClick={() => createReviewMutation.mutate()}
              loading={createReviewMutation.isPending}
            >
              Submit Review
            </CCButton>
          </div>
        </div>
      </CCCard>
    </div>
  );
}