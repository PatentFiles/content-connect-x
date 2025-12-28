import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCCard from '../ui-custom/CCCard';
import CCAvatars from '../ui-custom/CCAvatars';
import CCEmpty from '../ui-custom/CCEmpty';
import CCBadge from '../ui-custom/CCBadge';
import { Users, MessageCircle } from 'lucide-react';

export default function FriendsList({ userId }) {
  // Fetch friends
  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['friendsList', userId],
    queryFn: async () => {
      const friendships = await base44.entities.Friendship.filter({
        status: 'ACCEPTED',
        $or: [
          { requester_user_id: userId },
          { addressee_user_id: userId }
        ]
      });
      
      // Get friend user IDs
      const friendUserIds = friendships.map(f => 
        f.requester_user_id === userId ? f.addressee_user_id : f.requester_user_id
      );
      
      // Fetch friend profiles
      const profiles = await Promise.all(
        friendUserIds.map(id => 
          base44.entities.UserProfile.filter({ user_id: id })
        )
      );
      
      return friendships.map((f, i) => ({
        ...f,
        friendUserId: friendUserIds[i],
        profile: profiles[i][0]
      }));
    },
    enabled: !!userId,
  });

  if (isLoading) return null;

  if (friends.length === 0) {
    return (
      <CCEmpty
        icon={Users}
        title="No friends yet"
        description="Start connecting with people"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {friends.map(friend => (
        <CCCard key={friend.id} padding="md" hover>
          <Link to={createPageUrl(`ViewProfile?profileUserId=${friend.friendUserId}`)}>
            <div className="flex items-center gap-3">
              <CCAvatars
                src={friend.profile?.avatar_url}
                size="md"
                verified={friend.profile?.verified}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#E8EEF9]">
                  {friend.profile?.display_name || 'Unknown User'}
                </p>
                <p className="text-xs text-[#6B7A94]">
                  {friend.profile?.role_type}
                </p>
              </div>
              <CCBadge variant="default" size="sm" icon={MessageCircle} />
            </div>
          </Link>
        </CCCard>
      ))}
    </div>
  );
}