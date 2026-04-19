import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Settings, Play, Eye, Clock, Flag, TrendingUp, AlertTriangle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';
import AgentsList from '@/components/agents/AgentsList';
import AgentPermissionsEditor from '@/components/agents/AgentPermissionsEditor';
import AgentRunsList from '@/components/agents/AgentRunsList';
import AgentFlagsList from '@/components/agents/AgentFlagsList';
import AgentRiskScores from '@/components/agents/AgentRiskScores';

export default function AgentManagement() {
  const [activeTab, setActiveTab] = useState('agents');
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles?.[0];

  if (userLoading || profileLoading) {
    return <CCLoadingScreen />;
  }

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-6">
        <CCCard padding="xl" className="max-w-md text-center">
          <Shield className="w-16 h-16 text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#E8EEF9] mb-2">Admin Access Required</h2>
          <p className="text-sm text-[#9AA6BC]">
            You need administrator privileges to access agent management.
          </p>
        </CCCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-24">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#E8EEF9] mb-1">Agent Management</h1>
          <p className="text-xs text-[#6B7A94]">
            Manage AI agents, permissions, runs, flags, and risk scores
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {[
            { value: 'agents', label: 'Agents', icon: Shield },
            { value: 'permissions', label: 'Permissions', icon: Settings },
            { value: 'runs', label: 'Runs', icon: Clock },
            { value: 'flags', label: 'Flags', icon: Flag },
            { value: 'risk_scores', label: 'Risk Scores', icon: TrendingUp },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === value
                  ? 'bg-[#4F8CFF] text-white'
                  : 'bg-[#151D2B] border border-[#263248] text-[#9AA6BC] hover:text-[#E8EEF9] hover:bg-[#1A2438]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        <div>

          <CCTabsContent value="agents" activeTab={activeTab}>
            <AgentsList currentAdmin={user} />
          </CCTabsContent>

          <CCTabsContent value="permissions" activeTab={activeTab}>
            <AgentPermissionsEditor currentAdmin={user} />
          </CCTabsContent>

          <CCTabsContent value="runs" activeTab={activeTab}>
            <AgentRunsList />
          </CCTabsContent>

          <CCTabsContent value="flags" activeTab={activeTab}>
            <AgentFlagsList currentAdmin={user} />
          </CCTabsContent>

          <CCTabsContent value="risk_scores" activeTab={activeTab}>
            <AgentRiskScores />
          </CCTabsContent>
        </div>
      </div>
    </div>
    </FeatureRouteGuard>
  );
}