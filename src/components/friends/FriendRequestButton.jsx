import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CCButton from '../ui-custom/CCButton';
import CCModal from '../ui-custom/CCModal';
import CCErrorModal from '../ui-custom/CCErrorModal';
import { UserPlus, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function FriendRequestButton({ targetUserId, size = 'md', variant = 'outline' }) {
  const queryClient = useQueryClient();
  const [eligibility, setEligibility] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState({ title: '', message: '' });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Check friendship status
  const { data: friendshipStatus, isLoading } = useQuery({
    queryKey: ['friendshipStatus', user?.email, targetUserId],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const response = await base44.functions.invoke('isFriends', {
        user_a: user.email,
        user_b: targetUserId
      });

      const data = response.data;
      
      if (!data.are_friends && !data.friendship) {
        return { status: 'none' };
      }
      
      return {
        status: data.friendship?.status || (data.are_friends ? 'ACCEPTED' : 'none'),
        friendship: data.friendship,
        isRequester: data.friendship?.requester_user_id === user.email
      };
    },
    enabled: !!user?.email && !!targetUserId && user.email !== targetUserId,
    refetchOnMount: true,
    refetchOnWindowFocus: true
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
        setErrorMessage({
          title: 'Message First',
          message: 'You need to send a message to this user before sending a friend request.'
        });
        setShowErrorModal(true);
      } else if (errorData?.error === 'NOT_ALLOWED_NO_REPLY') {
        setErrorMessage({
          title: 'Wait for a Reply',
          message: 'You need to wait for a reply to your message before sending a friend request to this user.'
        });
        setShowErrorModal(true);
      } else if (errorData?.error === 'RATE_LIMITED') {
        setErrorMessage({
          title: 'Daily Limit Reached',
          message: 'You have reached your friend request limit for today. Please try again tomorrow.'
        });
        setShowErrorModal(true);
      } else {
        setErrorMessage({
          title: 'Request Failed',
          message: errorData?.details?.message || 'Failed to send friend request. Please try again.'
        });
        setShowErrorModal(true);
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
        setErrorMessage({
          title: 'Message First',
          message: 'You need to send a message to this user before sending a friend request.'
        });
        setShowErrorModal(true);
      } else if (data.reason_code === 'NOT_ALLOWED_NO_REPLY') {
        setErrorMessage({
          title: 'Wait for a Reply',
          message: 'You need to wait for a reply to your message before sending a friend request to this user.'
        });
        setShowErrorModal(true);
      } else if (data.reason_code === 'COOLDOWN_ACTIVE') {
        setErrorMessage({
          title: 'Please Wait',
          message: 'You need to wait before sending another friend request to this user.'
        });
        setShowErrorModal(true);
      } else if (data.reason_code === 'RATE_LIMITED') {
        setErrorMessage({
          title: 'Daily Limit Reached',
          message: 'You have reached your friend request limit for today. Please try again tomorrow.'
        });
        setShowErrorModal(true);
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
                cancelRequestMutation.mutate();
              }}
              variant="ghost"
              fullWidth
            >
              Cancel Request
            </CCButton>
          </div>
        </div>
      </CCModal>

      <CCErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorMessage.title}
        message={errorMessage.message}
      />
    </>
  );
}