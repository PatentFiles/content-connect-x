import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCAvatar from '../ui-custom/CCAvatars';
import CCEmpty from '../ui-custom/CCEmpty';
import CCModal from '../ui-custom/CCModal';
import { Users, UserMinus, MessageCircle, CheckCircle } from 'lucide-react';

export default function FriendsList({ userId }) {
  const queryClient = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState(null); // friendship record
  const [removeSuccess, setRemoveSuccess] = useState(false);

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['friendsList', userId],
    queryFn: async () => {
      const friendships = await base44.entities.Friendship.filter({ status: 'ACCEPTED' });
      const relevant = friendships.filter(
        f => f.requester_user_id === userId || f.addressee_user_id === userId
      );

      const friendUserIds = relevant.map(f =>
        f.requester_user_id === userId ? f.addressee_user_id : f.requester_user_id
      );

      const profiles = await Promise.all(
        friendUserIds.map(id => base44.entities.UserProfile.filter({ user_id: id }))
      );

      return relevant.map((f, i) => ({
        ...f,
        friendUserId: friendUserIds[i],
        profile: profiles[i][0],
      }));
    },
    enabled: !!userId,
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendshipId) => base44.entities.Friendship.delete(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendsList', userId] });
      setConfirmRemove(null);
      setRemoveSuccess(true);
    },
    onError: () => {
      toast.error('Failed to remove friend');
    },
  });

  if (isLoading) return null;

  if (friends.length === 0) {
    return (
      <CCEmpty
        icon={Users}
        title="No friends yet"
        description="Start connecting with other members"
      />
    );
  }

  return (
    <>
      <p className="text-sm text-[#9AA6BC] mb-4">{friends.length} connection{friends.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {friends.map(friend => (
          <CCCard key={friend.id} padding="md" hover>
            <div className="flex items-center gap-3">
              <Link to={createPageUrl(`ViewProfile?profileUserId=${friend.friendUserId}`)}>
                <CCAvatar
                  src={friend.profile?.avatar_url}
                  size="md"
                  verified={friend.profile?.verified}
                />
              </Link>
              <Link to={createPageUrl(`ViewProfile?profileUserId=${friend.friendUserId}`)} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#E8EEF9] truncate">
                  {friend.profile?.display_name || 'Unknown User'}
                </p>
                <p className="text-xs text-[#6B7A94] capitalize">
                  {friend.profile?.role_type}
                </p>
              </Link>
              <div className="flex items-center gap-1">
                <Link to={createPageUrl('Messages')}>
                  <CCButton variant="ghost" size="icon" title="Message">
                    <MessageCircle className="w-4 h-4 text-[#4F8CFF]" />
                  </CCButton>
                </Link>
                <CCButton
                  variant="ghost"
                  size="icon"
                  title="Remove Friend"
                  onClick={() => setConfirmRemove(friend)}
                  className="text-[#EF4444] hover:text-[#DC2626]"
                >
                  <UserMinus className="w-4 h-4" />
                </CCButton>
              </div>
            </div>
          </CCCard>
        ))}
      </div>

      {/* Confirm Remove Modal */}
      <CCModal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Friend"
        size="sm"
      >
        <p className="text-[#9AA6BC] mb-6">
          Are you sure you want to remove{' '}
          <span className="text-[#E8EEF9] font-medium">
            {confirmRemove?.profile?.display_name || 'this user'}
          </span>{' '}
          from your friends?
        </p>
        <div className="flex gap-3">
          <CCButton variant="outline" fullWidth onClick={() => setConfirmRemove(null)}>
            Cancel
          </CCButton>
          <CCButton
            variant="danger"
            fullWidth
            onClick={() => removeFriendMutation.mutate(confirmRemove.id)}
            loading={removeFriendMutation.isPending}
          >
            Remove
          </CCButton>
        </div>
      </CCModal>

      {/* Success Modal */}
      <CCModal
        isOpen={removeSuccess}
        onClose={() => setRemoveSuccess(false)}
        title=""
        showClose={false}
        size="sm"
      >
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-[#22C55E]" />
          </div>
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-2">Friend Removed</h2>
          <p className="text-[#9AA6BC] mb-5 text-sm">The connection has been removed.</p>
          <CCButton variant="primary" fullWidth onClick={() => setRemoveSuccess(false)}>
            Done
          </CCButton>
        </div>
      </CCModal>
    </>
  );
}