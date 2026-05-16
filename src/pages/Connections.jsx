import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import FriendRequestsList from '@/components/friends/FriendRequestsList';
import FriendsList from '@/components/friends/FriendsList';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';
import { useQueryClient } from '@tanstack/react-query';

export default function Connections() {
  const [activeTab, setActiveTab] = useState('friends');
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pendingFriendRequests', user?.email],
    queryFn: () => base44.entities.Friendship.filter({
      addressee_user_id: user?.email,
      status: 'PENDING'
    }),
    enabled: !!user?.email,
  });

  if (userLoading) {
    return <CCLoadingScreen message="Loading connections..." />;
  }

  const tabs = [
    { value: 'friends', label: 'Friends', icon: Users },
    { value: 'requests', label: `Requests ${pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}`, icon: UserPlus },
  ];

  return (
    <FeatureRouteGuard flag="connections" requiresSubscription={true}>
      <div className="min-h-screen bg-[var(--cc-bg)] pb-20 md:pb-8">
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#4F8CFF]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#E8EEF9]">Friends</h1>
              <p className="text-xs text-[#6B7A94]">Manage your friend connections</p>
            </div>
          </div>
        </div>
      </div>

      <MobileRefreshPage onRefresh={() => {
        queryClient.invalidateQueries({ queryKey: ['friends', user?.email] });
        queryClient.invalidateQueries({ queryKey: ['pendingFriendRequests', user?.email] });
      }}>
      <div className="max-w-4xl mx-auto px-4 py-6 md:pl-64">
        <CCTabsList tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        <CCTabsContent value="friends" activeTab={activeTab}>
          <FriendsList userId={user?.email} />
        </CCTabsContent>

        <CCTabsContent value="requests" activeTab={activeTab}>
          <FriendRequestsList userId={user?.email} />
        </CCTabsContent>
      </div>
      </MobileRefreshPage>
      </div>
    </FeatureRouteGuard>
  );
}