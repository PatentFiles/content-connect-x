import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users, Briefcase, Shield, Flag, Activity } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';

export default function ModerationOverview() {
  const { data: collaborations = [] } = useQuery({
    queryKey: ['allCollaborations'],
    queryFn: () => base44.entities.Collaboration.list(),
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['allDisputes'],
    queryFn: () => base44.entities.CollaborationDispute.list(),
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list(),
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ['allRiskScores'],
    queryFn: () => base44.entities.CollaborationRiskScore.list(),
  });

  const { data: adminActions = [] } = useQuery({
    queryKey: ['recentAdminActions'],
    queryFn: () => base44.entities.AdminActionLog.list('-created_date', 10),
  });

  const activeCollaborations = collaborations.filter(c => 
    ['active', 'negotiating', 'agreed', 'contract_sent', 'signed'].includes(c.status)
  );
  
  const flaggedCollaborations = collaborations.filter(c => c.status === 'disputed');
  const openDisputes = disputes.filter(d => ['Open', 'Under Review'].includes(d.status));
  const pendingVerifications = verifications.filter(v => v.status === 'pending');
  const highRiskCollaborations = riskScores.filter(r => r.risk_tier === 'High');

  const stats = [
    {
      label: 'Active Collaborations',
      value: activeCollaborations.length,
      icon: Briefcase,
      variant: 'primary',
    },
    {
      label: 'Flagged for Review',
      value: flaggedCollaborations.length,
      icon: Flag,
      variant: 'warning',
    },
    {
      label: 'Open Disputes',
      value: openDisputes.length,
      icon: AlertTriangle,
      variant: 'danger',
    },
    {
      label: 'Pending Verifications',
      value: pendingVerifications.length,
      icon: Shield,
      variant: 'accent',
    },
    {
      label: 'High Risk',
      value: highRiskCollaborations.length,
      icon: AlertTriangle,
      variant: 'danger',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Moderation Overview</h2>
        <p className="text-sm text-[#6B7A94]">Platform-wide moderation metrics and recent actions</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <CCCard key={stat.label} padding="lg" hover>
              <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-[#4F8CFF]" />
                </div>
                <CCBadge variant={stat.variant}>{stat.value}</CCBadge>
              </div>
              <p className="text-sm font-medium text-[#E8EEF9]">{stat.label}</p>
            </CCCard>
          );
        })}
      </div>

      {/* Recent Admin Actions */}
      <CCCard padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[#4F8CFF]" />
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Recent Admin Actions</h3>
        </div>
        {adminActions.length === 0 ? (
          <p className="text-sm text-[#6B7A94] text-center py-4">No recent actions</p>
        ) : (
          <div className="space-y-2">
            {adminActions.map(action => (
              <div key={action.id} className="flex items-center justify-between py-2 border-b border-[#263248] last:border-0">
                <div className="flex-1">
                  <p className="text-sm text-[#E8EEF9]">{action.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-[#6B7A94]">
                    {action.target_type} • {new Date(action.created_date).toLocaleString()}
                  </p>
                </div>
                <CCBadge variant="outline" size="sm">{action.admin_user_id}</CCBadge>
              </div>
            ))}
          </div>
        )}
      </CCCard>
    </div>
  );
}