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
  CheckCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';
import CCAvatar from '../ui-custom/CCAvatars';
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
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">
            Agent Dashboard
          </h1>
          <p className="text-[#6B7A94]">Manage your creator representations</p>
        </div>

        {onboardingChecklist}

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{activeReps.length}</p>
                <p className="text-xs text-[#6B7A94]">Active Reps</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{pendingInvites.length}</p>
                <p className="text-xs text-[#6B7A94]">Pending Invites</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2DAA]/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{activeCollaborations.length}</p>
                <p className="text-xs text-[#6B7A94]">Active Collaborations</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{pendingSignatures}</p>
                <p className="text-xs text-[#6B7A94]">Pending Sigs</p>
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
              <h2 className="text-lg font-semibold text-[#E8EEF9]">Awaiting Completion ({awaitingCompletion.length})</h2>
            </div>
            <p className="text-xs text-[#9AA6BC] mb-3">These collaborations are signed and ready for completion. Completion triggers commission calculation.</p>
            <div className="space-y-2">
              {awaitingCompletion.map(collab => (
                <Link key={collab.id} to={createPageUrl(`CollaborationDetail?id=${collab.id}`)}>
                  <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg hover:bg-[#1A2438] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-[#E8EEF9]">{collab.collaboration_name || 'Untitled'}</p>
                      <p className="text-xs text-[#6B7A94]">{collab.participant_ids?.length || 0} participants</p>
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
              <h2 className="text-lg font-semibold text-[#E8EEF9]">Representations</h2>
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
                  <div key={rep.id} className="flex items-center gap-3 p-2 bg-[#151D2B] rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-[#263248] flex items-center justify-center text-xs text-[#6B7A94]">
                      {rep.creator_user_id.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#E8EEF9] truncate">{rep.creator_user_id}</p>
                      <p className="text-xs text-[#6B7A94]">Active</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CCCard>

          {/* Pipeline */}
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Pipeline</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg">
                <div>
                  <p className="text-sm text-[#E8EEF9]">In Negotiation</p>
                  <p className="text-xs text-[#6B7A94]">Active discussions</p>
                </div>
                <p className="text-xl font-bold text-[#4F8CFF]">
                  {collaborations.filter(d => d.status === 'negotiating').length}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg">
                <div>
                  <p className="text-sm text-[#E8EEF9]">Contract Ready</p>
                  <p className="text-xs text-[#6B7A94]">Awaiting signature</p>
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