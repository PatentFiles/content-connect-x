import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CCButton from '../ui-custom/CCButton';
import CCModal from '../ui-custom/CCModal';
import { UserPlus, Check, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

export default function FriendRequestButton({ targetUserId, size = 'md', variant = 'outline' }) {
  const queryClient = useQueryClient();
  const [eligibility, setEligibility] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Check friendship status
  const { data: friendshipStatus, isLoading } = useQuery({
    queryKey: ['friendshipStatus', user?.email, targetUserId],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const friendships = await base44.entities.Friendship.filter({
        $or: [
          { requester_user_id: user.email, addressee_user_id: targetUserId },
          { requester_user_id: targetUserId, addressee_user_id: user.email }
        ]
      });

      if (friendships.length === 0) return { status: 'none' };
      
      const friendship = friendships[0];
      return {
        status: friendship.status,
        friendship,
        isRequester: friendship.requester_user_id === user.email
      };
    },
    enabled: !!user?.email && !!targetUserId && user.email !== targetUserId,
  });

  // Send friend request
  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('sendFriendRequest', {
        target_id: targetUserId
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus'] });
      queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
      setShowSuccessModal(true);
    },
    onError: (error) => {
      const errorData = error.response?.data;
      if (errorData?.error === 'NOT_ALLOWED_NO_DM') {
        toast.error('Send a message first before requesting');
      } else if (errorData?.error === 'NOT_ALLOWED_NO_REPLY') {
        toast.error('Wait for a reply before sending friend request');
      } else if (errorData?.error === 'RATE_LIMITED') {
        toast.error('Daily friend request limit reached');
      } else {
        toast.error(errorData?.details?.message || 'Failed to send friend request');
      }
    },
  });

  // Cancel friend request
  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('cancelFriendRequest', {
        friendship_id: friendshipStatus.friendship.id
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus'] });
      queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests'] });
      toast.success('Friend request cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel request');
    },
  });

  // Check eligibility
  const checkEligibility = async () => {
    const { data } = await base44.functions.invoke('validateFriendRequestEligibility', {
      requester_id: user.email,
      target_id: targetUserId
    });
    setEligibility(data);
    if (!data.eligible) {
      if (data.reason_code === 'NOT_ALLOWED_NO_DM') {
        toast.error('Send a message first');
      } else if (data.reason_code === 'NOT_ALLOWED_NO_REPLY') {
        toast.error('Wait for a reply before requesting');
      } else if (data.reason_code === 'COOLDOWN_ACTIVE') {
        toast.error('Must wait before sending another request');
      } else if (data.reason_code === 'RATE_LIMITED') {
        toast.error('Daily request limit reached');
      }
    }
  };

  if (!user || user.email === targetUserId) return null;
  if (isLoading) return null;

  const status = friendshipStatus?.status || 'none';

  if (status === 'ACCEPTED') {
    return (
      <CCButton variant="ghost" size={size} icon={Check} disabled>
        Friends
      </CCButton>
    );
  }

  if (status === 'PENDING') {
    if (friendshipStatus.isRequester) {
      return (
        <CCButton
          variant="outline"
          size={size}
          icon={Clock}
          onClick={() => cancelRequestMutation.mutate()}
          loading={cancelRequestMutation.isPending}
        >
          Friend Request Sent
        </CCButton>
      );
    } else {
      return (
        <CCButton variant="ghost" size={size} icon={Clock} disabled>
          Pending
        </CCButton>
      );
    }
  }

  return (
    <>
      <CCButton
        variant={variant}
        size={size}
        icon={UserPlus}
        onClick={async () => {
          await checkEligibility();
          if (!eligibility || eligibility.eligible) {
            sendRequestMutation.mutate();
          }
        }}
        loading={sendRequestMutation.isPending}
      >
        Add Friend
      </CCButton>

      <CCModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Friend Request Sent"
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-[#4F8CFF]" />
          </div>
          <p className="text-[#9AA6BC] mb-6">
            Your friend request has been sent successfully. You'll be notified when they respond.
          </p>
          <div className="flex gap-3">
            <CCButton onClick={() => setShowSuccessModal(false)} variant="outline" fullWidth>
              Close
            </CCButton>
            <CCButton
              onClick={() => {
                setShowSuccessModal(false);
                setTimeout(() => {
                  if (window.confirm('Cancel this friend request?')) {
                    cancelRequestMutation.mutate();
                  }
                }, 300);
              }}
              variant="ghost"
              fullWidth
            >
              Cancel Request
            </CCButton>
          </div>
        </div>
      </CCModal>
    </>
  );
}