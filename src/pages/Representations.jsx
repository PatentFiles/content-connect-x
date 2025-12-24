import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  UserPlus, 
  CheckCircle, 
  XCircle,
  Clock,
  Mail
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import AccessGate from '@/components/auth/AccessGate';

export default function Representations() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNotes, setInviteNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles[0];

  const { data: representations = [], isLoading: repsLoading } = useQuery({
    queryKey: ['myRepresentations', user?.email],
    queryFn: () => base44.entities.AgentRepresentation.filter({ agent_user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: creatorProfiles = [] } = useQuery({
    queryKey: ['representedCreators'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: representations.length > 0,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ creatorEmail, notes }) => base44.entities.AgentRepresentation.create({
      agent_user_id: user.email,
      creator_user_id: creatorEmail,
      status: 'INVITED',
      agreement_notes: notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myRepresentations']);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteNotes('');
    },
  });

  const endRepMutation = useMutation({
    mutationFn: (id) => base44.entities.AgentRepresentation.update(id, {
      status: 'ENDED',
      ended_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myRepresentations']);
    },
  });

  if (userLoading || repsLoading) {
    return <CCLoadingScreen message="Loading representations..." />;
  }

  // Allow admins to view this page regardless of role
  if (!profile?.is_admin && profile?.role_type !== 'agent') {
    return <AccessGate type="both" />;
  }

  const getCreatorProfile = (userId) => creatorProfiles.find(p => p.user_id === userId);
  const activeReps = representations.filter(r => r.status === 'ACTIVE');
  const invitedReps = representations.filter(r => r.status === 'INVITED');
  const endedReps = representations.filter(r => r.status === 'ENDED');

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">Representations</h1>
            <p className="text-[#6B7A94]">Manage your creator relationships</p>
          </div>
          <CCButton variant="primary" icon={UserPlus} onClick={() => setShowInviteModal(true)}>
            Invite Creator
          </CCButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{activeReps.length}</p>
                <p className="text-xs text-[#6B7A94]">Active</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{invitedReps.length}</p>
                <p className="text-xs text-[#6B7A94]">Invited</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6B7A94]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#6B7A94]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{endedReps.length}</p>
                <p className="text-xs text-[#6B7A94]">Ended</p>
              </div>
            </div>
          </CCCard>
        </div>

        {/* Active Representations */}
        <CCCard padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Active Representations</h2>
          {activeReps.length === 0 ? (
            <CCEmpty
              icon={Users}
              title="No active representations"
              description="Invite creators to represent them"
              action={() => setShowInviteModal(true)}
              actionLabel="Invite Creator"
            />
          ) : (
            <div className="space-y-3">
              {activeReps.map(rep => {
                const creatorProfile = getCreatorProfile(rep.creator_user_id);
                return (
                  <div key={rep.id} className="flex items-center justify-between p-4 bg-[#151D2B] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#263248] flex items-center justify-center">
                        {creatorProfile?.avatar_url ? (
                          <img src={creatorProfile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-lg text-[#6B7A94]">{rep.creator_user_id.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[#E8EEF9]">{creatorProfile?.display_name || rep.creator_user_id}</p>
                        <p className="text-sm text-[#6B7A94]">{rep.creator_user_id}</p>
                        {rep.started_at && (
                          <p className="text-xs text-[#6B7A94]">
                            Since {new Date(rep.started_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <CCButton 
                      variant="outline" 
                      size="sm"
                      onClick={() => endRepMutation.mutate(rep.id)}
                    >
                      End
                    </CCButton>
                  </div>
                );
              })}
            </div>
          )}
        </CCCard>

        {/* Pending Invites */}
        {invitedReps.length > 0 && (
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Pending Invites</h2>
            <div className="space-y-3">
              {invitedReps.map(rep => {
                const creatorProfile = getCreatorProfile(rep.creator_user_id);
                return (
                  <div key={rep.id} className="flex items-center justify-between p-4 bg-[#151D2B] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#263248] flex items-center justify-center">
                        <Mail className="w-5 h-5 text-[#6B7A94]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#E8EEF9]">{creatorProfile?.display_name || rep.creator_user_id}</p>
                        <p className="text-xs text-[#6B7A94]">Awaiting response</p>
                      </div>
                    </div>
                    <CCBadge variant="warning" size="sm" icon={Clock}>
                      Pending
                    </CCBadge>
                  </div>
                );
              })}
            </div>
          </CCCard>
        )}
      </div>

      {/* Invite Modal */}
      <CCModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Creator to Representation"
      >
        <div className="space-y-4">
          <CCInput
            label="Creator Email"
            type="email"
            placeholder="creator@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Agreement Notes</label>
            <textarea
              value={inviteNotes}
              onChange={(e) => setInviteNotes(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px]"
              placeholder="Terms and conditions..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary"
              onClick={() => inviteMutation.mutate({ creatorEmail: inviteEmail, notes: inviteNotes })}
              loading={inviteMutation.isPending}
              disabled={!inviteEmail}
            >
              Send Invite
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}