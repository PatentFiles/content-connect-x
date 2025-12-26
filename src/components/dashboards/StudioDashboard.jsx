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
  Camera,
  Clock,
  MessageCircle
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';
import StudioEarningsDashboard from '../studio/StudioEarningsDashboard';

export default function StudioDashboard({ user, profile }) {
  const { data: roster = [] } = useQuery({
    queryKey: ['studioRoster', user?.email],
    queryFn: () => base44.entities.StudioRoster.filter({ studio_user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['studioCollaborations', user?.email],
    queryFn: () => base44.entities.Collaboration.filter({ 
      participant_ids: { $in: [user.email] }
    }),
    enabled: !!user?.email,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['studioContracts', user?.email],
    queryFn: () => base44.entities.Contract.list(),
    enabled: !!user?.email,
  });

  const activeRoster = roster.filter(r => r.status === 'ACTIVE' && r.relationship_type === 'ROSTER');
  const workedWith = roster.filter(r => r.status === 'ACTIVE' && r.relationship_type === 'WORKED_WITH');
  const pendingApprovals = roster.filter(r => r.status === 'PENDING');
  const activeCollaborations = collaborations.filter(d => ['negotiating', 'agreed', 'contract_sent'].includes(d.status));

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">
            Studio Dashboard
          </h1>
          <p className="text-[#6B7A94]">Manage your roster and productions</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{activeRoster.length}</p>
                <p className="text-xs text-[#6B7A94]">Active Roster</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{workedWith.length}</p>
                <p className="text-xs text-[#6B7A94]">Worked With</p>
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
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{pendingApprovals.length}</p>
                <p className="text-xs text-[#6B7A94]">Pending</p>
              </div>
            </div>
          </CCCard>
        </div>

        {/* Studio Earnings Dashboard */}
        <StudioEarningsDashboard studioUserId={user?.email} />

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Roster & Portfolio */}
          <CCCard padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#E8EEF9]">Roster & Portfolio</h2>
              <Link to={createPageUrl('RosterPortfolio')}>
                <CCButton variant="primary" size="sm" icon={Plus}>Add Creator</CCButton>
              </Link>
            </div>
            {activeRoster.length === 0 ? (
              <CCEmpty
                icon={Users}
                title="No roster members yet"
                description="Add creators to your roster"
              />
            ) : (
              <div className="space-y-2">
                {activeRoster.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2 bg-[#151D2B] rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-[#263248] flex items-center justify-center text-xs text-[#6B7A94]">
                      {r.creator_user_id.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#E8EEF9]">{r.creator_user_id}</p>
                      <p className="text-xs text-[#6B7A94] capitalize">{r.relationship_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CCCard>

          {/* Production Pipeline */}
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Production Pipeline</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg">
                <div>
                  <p className="text-sm text-[#E8EEF9]">Upcoming Shoots</p>
                  <p className="text-xs text-[#6B7A94]">Scheduled collaborations</p>
                </div>
                <p className="text-xl font-bold text-[#4F8CFF]">
                  {collaborations.filter(d => d.status === 'agreed').length}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg">
                <div>
                  <p className="text-sm text-[#E8EEF9]">In Negotiation</p>
                  <p className="text-xs text-[#6B7A94]">Active discussions</p>
                </div>
                <p className="text-xl font-bold text-[#F59E0B]">
                  {collaborations.filter(d => d.status === 'negotiating').length}
                </p>
              </div>
            </div>
            <Link to={createPageUrl('Collaborations')} className="block mt-4">
              <CCButton variant="outline" size="sm" fullWidth>
                View All Collaborations
              </CCButton>
            </Link>
          </CCCard>
        </div>

        {/* Quick Actions */}
        <CCCard padding="lg" className="mt-6">
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link to={createPageUrl('RosterPortfolio')}>
              <CCButton variant="primary" size="sm" fullWidth icon={Users}>
                Add to Roster
              </CCButton>
            </Link>
            <Link to={createPageUrl('CreateCollaboration')}>
              <CCButton variant="outline" size="sm" fullWidth icon={Briefcase}>
                Create Collaboration
              </CCButton>
            </Link>
            <Link to={createPageUrl('Messages')}>
              <CCButton variant="outline" size="sm" fullWidth icon={MessageCircle}>
                Messages
              </CCButton>
            </Link>
          </div>
        </CCCard>
      </div>
    </div>
  );
}