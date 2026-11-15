import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Settings, Clock, Flag, TrendingUp } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import { CCTabsContent } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';
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
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--cc-bg)' }}>
        <CCCard padding="xl" className="max-w-md text-center">
          <Shield className="w-16 h-16 text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--cc-text-primary)' }}>Admin Access Required</h2>
          <p className="text-sm" style={{ color: 'var(--cc-text-secondary)' }}>
            You need administrator privileges to access agent management.
          </p>
        </CCCard>
      </div>
    );
  }

  return (
    <MobileRefreshPage>
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--cc-bg)' }}>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--cc-text-primary)' }}>Agent Management</h1>
          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
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
              style={{
                backgroundColor: activeTab === value ? 'var(--cc-blue)' : 'var(--cc-surface)',
                border: `1px solid ${activeTab === value ? 'var(--cc-blue)' : 'var(--cc-border)'}`,
                color: activeTab === value ? '#fff' : 'var(--cc-text-secondary)',
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
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
    </MobileRefreshPage>
  );
}