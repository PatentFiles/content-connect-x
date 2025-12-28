import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCAvatars from '../ui-custom/CCAvatars';
import CCEmpty from '../ui-custom/CCEmpty';
import { UserPlus, Check, X, Flag } from 'lucide-react';
import { toast } from 'sonner';
import ReportModal from '../moderation/ReportModal';

export default function FriendRequestsList({ userId }) {
  const queryClient = useQueryClient();
  const [reportingUser, setReportingUser] = React.useState(null);

  // Fetch pending requests
  const { data: pendingRequests = [], isLoading } = useQuery({
    queryKey: ['pendingFriendRequests', userId],
    queryFn: async () => {
      const requests = await base44.entities.Friendship.filter({
        addressee_user_id: userId,
        status: 'PENDING'
      });
      
      // Fetch requester profiles
      const profiles = await Promise.all(
        requests.map(r => 
          base44.entities.UserProfile.filter({ user_id: r.requester_user_id })
        )
      );
      
      return requests.map((r, i) => ({
        ...r,
        profile: profiles[i][0]
      }));
    },
    enabled: !!userId,
  });

  // Respond to request
  const respondMutation = useMutation({
    mutationFn: async ({ friendship_id, response }) => {
      const { data } = await base44.functions.invoke('respondToFriendRequest', {
        friendship_id,
        response
      });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['pendingFriendRequests']);
      queryClient.invalidateQueries(['friendshipStatus']);
      queryClient.invalidateQueries(['friendsList']);
      toast.success(variables.response === 'ACCEPT' ? 'Friend request accepted' : 'Friend request declined');
    },
    onError: () => {
      toast.error('Failed to respond to request');
    },
  });

  if (isLoading) return null;

  if (pendingRequests.length === 0) {
    return (
      <CCEmpty
        icon={UserPlus}
        title="No pending requests"
        description="Friend requests will appear here"
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {pendingRequests.map(request => (
          <CCCard key={request.id} padding="md">
            <div className="flex items-center justify-between gap-4">
              <Link to={createPageUrl(`ViewProfile?profileUserId=${request.requester_user_id}`)}>
                <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <CCAvatars
                    src={request.profile?.avatar_url}
                    size="md"
                    verified={request.profile?.verified}
                  />
                  <div>
                    <p className="text-sm font-medium text-[#E8EEF9]">
                      {request.profile?.display_name || 'Unknown User'}
                    </p>
                    <p className="text-xs text-[#6B7A94]">
                      {new Date(request.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
              
              <div className="flex items-center gap-2">
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={Flag}
                  onClick={() => setReportingUser(request.requester_user_id)}
                />
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={X}
                  onClick={() => respondMutation.mutate({
                    friendship_id: request.id,
                    response: 'DECLINE'
                  })}
                  loading={respondMutation.isPending}
                />
                <CCButton
                  variant="primary"
                  size="sm"
                  icon={Check}
                  onClick={() => respondMutation.mutate({
                    friendship_id: request.id,
                    response: 'ACCEPT'
                  })}
                  loading={respondMutation.isPending}
                />
              </div>
            </div>
          </CCCard>
        ))}
      </div>

      {reportingUser && (
        <ReportModal
          isOpen={!!reportingUser}
          onClose={() => setReportingUser(null)}
          reportedUserId={reportingUser}
          reportType="FRIEND_REQUEST_ABUSE"
        />
      )}
    </>
  );
}