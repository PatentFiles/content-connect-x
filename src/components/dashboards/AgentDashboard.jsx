import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Users, 
  Briefcase, 
  FileText, 
  Plus,
  Clock,
  AlertCircle
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';
import AgentEarningsWidget from '../earnings/AgentEarningsWidget';

export default function AgentDashboard({ user, profile, onboardingChecklist }) {
  const { data: representations = [] } = useQuery({
    queryKey: ['myRepresentations', user?.email],
    queryFn: () => base44.entities.AgentRepresentation.filter({ agent_user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['agentCollaborations', user?.email],
    queryFn: () => base44.entities.Collaboration.filter({ 
      participant_ids: { $in: [user.email] }
    }),
    enabled: !!user?.email,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['agentContracts', user?.email],
    queryFn: () => base44.entities.Contract.list(),
    enabled: !!user?.email,
  });

  const activeReps = representations.filter(r => r.status === 'ACTIVE');
  const pendingInvites = representations.filter(r => r.status === 'INVITED');
  const activeCollaborations = collaborations.filter(d => ['negotiating', 'agreed', 'contract_sent'].includes(d.status));
  const awaitingCompletion = collaborations.filter(d => ['signed', 'active'].includes(d.status));
  const pendingSignatures = contracts.filter(c => c.status === 'sent').length;

  return (
    <div className="min-h-screen pb-20 md:pb-8" style={{ backgroundColor: 'var(--cc-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--cc-text-primary)' }}>
            Agent Dashboard
          </h1>
          <p style={{ color: 'var(--cc-text-muted)' }}>Manage your creator representations</p>
        </div>

        {onboardingChecklist}

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--cc-blue) 20%, transparent)' }}>
                <Users className="w-5 h-5" style={{ color: 'var(--cc-blue)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{activeReps.length}</p>
                <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Active Reps</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{pendingInvites.length}</p>
                <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Pending Invites</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--cc-pink) 20%, transparent)' }}>
                <Briefcase className="w-5 h-5" style={{ color: 'var(--cc-pink)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{activeCollaborations.length}</p>
                <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Active Collaborations</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
                <FileText className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{pendingSignatures}</p>
                <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Pending Sigs</p>
              </div>
            </div>
          </CCCard>
        </div>

        {/* Agent Commission Earnings */}
        <div className="mb-6">
          <AgentEarningsWidget agentUserId={user?.email} />
        </div>

        {/* Awaiting Completion */}
        {awaitingCompletion.length > 0 && (
          <CCCard padding="lg" className="mb-6 border-l-4 border-l-[#F59E0B]">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--cc-text-primary)' }}>Awaiting Completion ({awaitingCompletion.length})</h2>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--cc-text-secondary)' }}>These collaborations are signed and ready for completion. Completion triggers commission calculation.</p>
            <div className="space-y-2">
              {awaitingCompletion.map(collab => (
                <Link key={collab.id} to={createPageUrl(`CollaborationDetail?id=${collab.id}`)}>
                  <div className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ backgroundColor: 'var(--cc-surface-hover)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cc-border)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>{collab.collaboration_name || 'Untitled'}</p>
                      <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{collab.participant_ids?.length || 0} participants</p>
                    </div>
                    <CCBadge variant="warning" size="sm" icon={Clock}>Signed</CCBadge>
                  </div>
                </Link>
              ))}
            </div>
          </CCCard>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Representations */}
          <CCCard padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--cc-text-primary)' }}>Representations</h2>
              <Link to={createPageUrl('Representations')}>
                <CCButton variant="primary" size="sm" icon={Plus}>Invite</CCButton>
              </Link>
            </div>
            {activeReps.length === 0 ? (
              <CCEmpty
                icon={Users}
                title="No active representations"
                description="Invite creators to represent"
              />
            ) : (
              <div className="space-y-2">
                {activeReps.slice(0, 5).map(rep => (
                  <div key={rep.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--cc-surface-hover)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--cc-border)', color: 'var(--cc-text-secondary)' }}>
                      {rep.creator_user_id.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--cc-text-primary)' }}>{rep.creator_user_id}</p>
                      <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Active</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CCCard>

          {/* Pipeline */}
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--cc-text-primary)' }}>Pipeline</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--cc-surface-hover)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--cc-text-primary)' }}>In Negotiation</p>
                  <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Active discussions</p>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--cc-blue)' }}>
                  {collaborations.filter(d => d.status === 'negotiating').length}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--cc-surface-hover)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--cc-text-primary)' }}>Contract Ready</p>
                  <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Awaiting signature</p>
                </div>
                <p className="text-xl font-bold text-[#22C55E]">
                  {collaborations.filter(d => d.status === 'contract_sent').length}
                </p>
              </div>
            </div>
          </CCCard>
        </div>
      </div>
    </div>
  );
}