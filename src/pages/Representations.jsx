import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Users,
  UserPlus,
  CheckCircle,
  Clock,
  Mail,
  Briefcase,
  Lock,
  DollarSign,
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import AgentInviteInbox from '@/components/representation/AgentInviteInbox';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';

export default function Representations() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNotes, setInviteNotes] = useState('');
  const [inviteCommission, setInviteCommission] = useState('');
  const [inviteExclusive, setInviteExclusive] = useState(false);
  const [invitePerms, setInvitePerms] = useState({
    can_negotiate: true,
    can_sign_contracts: false,
    can_message: true,
    can_view_private_gallery: false,
  });
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
  const isAgent = profile?.role_type === 'agent';
  const isCreator = profile?.role_type === 'creator';
  const isAdmin = profile?.is_admin;

  // Agent-side: reps where I am the agent
  const { data: agentReps = [], isLoading: agentRepsLoading } = useQuery({
    queryKey: ['myRepresentations', user?.email],
    queryFn: () => base44.entities.AgentRepresentation.filter({ agent_user_id: user?.email }),
    enabled: !!user?.email && (isAgent || isAdmin),
  });

  // Creator-side: reps where I am the creator
  const { data: creatorReps = [], isLoading: creatorRepsLoading } = useQuery({
    queryKey: ['myCreatorReps', user?.email],
    queryFn: () => base44.entities.AgentRepresentation.filter({ creator_user_id: user?.email }),
    enabled: !!user?.email && (isCreator || isAdmin),
  });

  // Fetch profiles for display
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['allProfilesForReps'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: agentReps.length > 0 || creatorReps.length > 0,
  });

  const { data: allAgentDetails = [] } = useQuery({
    queryKey: ['allAgentDetailsForReps'],
    queryFn: () => base44.entities.AgentDetails.list(),
    enabled: creatorReps.length > 0,
  });

  const getProfile = (userId) => allProfiles.find(p => p.user_id === userId);
  const getAgentDetails = (userId) => allAgentDetails.find(d => d.user_id === userId);

  // Agent sends invite
  const inviteMutation = useMutation({
    mutationFn: async ({ creatorEmail, notes, commission, exclusive, perms }) => {
      const rep = await base44.entities.AgentRepresentation.create({
        agent_user_id: user.email,
        creator_user_id: creatorEmail,
        status: 'INVITED',
        agreement_notes: notes,
        commission_rate: commission ? parseFloat(commission) : undefined,
        exclusivity: exclusive,
        permissions: perms,
      });

      // Notify creator
      await base44.entities.Notification.create({
        user_id: creatorEmail,
        type: 'messages',
        actor_user_id: user.email,
        title: 'New Representation Invite',
        body: `${profile?.display_name || user.email} has sent you a representation invite. Review it on your Representations page.`,
      });

      // Log
      await base44.entities.AdminActionLog.create({
        action_type: 'representation_invite_sent',
        target_user_id: creatorEmail,
        performed_by: user.email,
        details: `Agent sent representation invite. Rep ID: ${rep.id}`,
      }).catch(() => {});

      return rep;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRepresentations'] });
      toast.success('Invite sent! The creator will be notified.');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteNotes('');
      setInviteCommission('');
      setInviteExclusive(false);
      setInvitePerms({ can_negotiate: true, can_sign_contracts: false, can_message: true, can_view_private_gallery: false });
    },
    onError: (e) => toast.error(e.message || 'Failed to send invite'),
  });

  // Agent ends active rep
  const endRepMutation = useMutation({
    mutationFn: async (rep) => {
      await base44.entities.AgentRepresentation.update(rep.id, {
        status: 'ENDED',
        ended_at: new Date().toISOString(),
      });
      // Notify creator
      const creatorProf = getProfile(rep.creator_user_id);
      await base44.entities.Notification.create({
        user_id: rep.creator_user_id,
        type: 'messages',
        actor_user_id: user.email,
        title: 'Representation Ended',
        body: `${profile?.display_name || user.email} has ended your representation arrangement.`,
      });
      await base44.entities.AdminActionLog.create({
        action_type: 'representation_ended',
        target_user_id: rep.creator_user_id,
        performed_by: user.email,
        details: `Representation ended. Rep ID: ${rep.id}`,
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRepresentations'] });
      toast.success('Representation ended.');
    },
  });

  // Creator ends active rep from their side
  const creatorEndRepMutation = useMutation({
    mutationFn: async (rep) => {
      await base44.entities.AgentRepresentation.update(rep.id, {
        status: 'ENDED',
        ended_at: new Date().toISOString(),
      });
      await base44.entities.Notification.create({
        user_id: rep.agent_user_id,
        type: 'messages',
        actor_user_id: user.email,
        title: 'Representation Ended',
        body: `${profile?.display_name || user.email} has ended the representation arrangement.`,
      });
      await base44.entities.AdminActionLog.create({
        action_type: 'representation_ended',
        target_user_id: rep.agent_user_id,
        performed_by: user.email,
        details: `Creator ended representation. Rep ID: ${rep.id}`,
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myCreatorReps'] });
      toast.success('Representation ended.');
    },
  });

  if (userLoading || agentRepsLoading || creatorRepsLoading) {
    return <CCLoadingScreen message="Loading representations..." />;
  }

  // ── CREATOR VIEW ──────────────────────────────────────────────────
  if (isCreator && !isAgent) {
    const activeCreatorReps = creatorReps.filter(r => r.status === 'ACTIVE');
    const endedCreatorReps = creatorReps.filter(r => ['ENDED', 'DECLINED'].includes(r.status));

    return (
      <FeatureRouteGuard flag="representations" requiresSubscription={true}>
        <MobileRefreshPage onRefresh={() => queryClient.invalidateQueries({ queryKey: ['myCreatorReps', user?.email] })}>
        <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">My Representation</h1>
            <p className="text-[#6B7A94]">Manage agents who represent you</p>
          </div>

          {/* Pending Invites */}
          <AgentInviteInbox userId={user?.email} profile={profile} />

          {/* Active Representations */}
          <CCCard padding="lg" className="mb-6">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#22C55E]" />
              Active Representations ({activeCreatorReps.length})
            </h2>
            {activeCreatorReps.length === 0 ? (
              <CCEmpty
                icon={Briefcase}
                title="No active agent representation"
                description="When an agent invites you and you accept, they'll appear here."
              />
            ) : (
              <div className="space-y-3">
                {activeCreatorReps.map(rep => {
                  const agentProf = getProfile(rep.agent_user_id);
                  const agentDet = getAgentDetails(rep.agent_user_id);
                  return (
                    <div key={rep.id} className="flex items-center justify-between p-4 bg-[#151D2B] rounded-xl border border-[#22C55E]/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-[#263248] flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {agentProf?.avatar_url
                            ? <img src={agentProf.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <Briefcase className="w-6 h-6 text-[#6B7A94]" />
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-[#E8EEF9]">{agentProf?.display_name || rep.agent_user_id}</p>
                            {agentDet?.agency_name && <CCBadge variant="accent" size="sm">{agentDet.agency_name}</CCBadge>}
                            {rep.exclusivity && <CCBadge variant="danger" size="sm" icon={Lock}>Exclusive</CCBadge>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {rep.commission_rate != null && (
                              <span className="text-xs text-[#9AA6BC] flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />{rep.commission_rate}% commission
                              </span>
                            )}
                            {rep.started_at && (
                              <span className="text-xs text-[#6B7A94]">
                                Since {format(new Date(rep.started_at), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <CCButton
                        variant="outline"
                        size="sm"
                        onClick={() => creatorEndRepMutation.mutate(rep)}
                        loading={creatorEndRepMutation.isPending}
                      >
                        End
                      </CCButton>
                    </div>
                  );
                })}
              </div>
            )}
          </CCCard>

          {/* History */}
          {endedCreatorReps.length > 0 && (
            <CCCard padding="lg">
              <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#6B7A94]" />
                History
              </h2>
              <div className="space-y-2">
                {endedCreatorReps.map(rep => {
                  const agentProf = getProfile(rep.agent_user_id);
                  return (
                    <div key={rep.id} className="flex items-center justify-between p-3 bg-[#0D1520] rounded-lg">
                      <p className="text-sm text-[#9AA6BC]">{agentProf?.display_name || rep.agent_user_id}</p>
                      <CCBadge variant={rep.status === 'DECLINED' ? 'danger' : 'default'} size="sm">
                        {rep.status}
                      </CCBadge>
                    </div>
                  );
                })}
              </div>
            </CCCard>
          )}
        </div>
        </div>
        </MobileRefreshPage>
        </FeatureRouteGuard>
    );
  }

  // ── AGENT VIEW (original, enhanced) ──────────────────────────────
  const activeReps = agentReps.filter(r => r.status === 'ACTIVE');
  const invitedReps = agentReps.filter(r => r.status === 'INVITED');
  const endedReps = agentReps.filter(r => ['ENDED', 'DECLINED'].includes(r.status));

  return (
    <FeatureRouteGuard flag="representations" requiresSubscription={true}>
    <MobileRefreshPage onRefresh={() => queryClient.invalidateQueries({ queryKey: ['myRepresentations', user?.email] })}>
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
                <p className="text-xs text-[#6B7A94]">Pending</p>
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
                <p className="text-xs text-[#6B7A94]">Ended/Declined</p>
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
                const creatorProfile = getProfile(rep.creator_user_id);
                return (
                  <div key={rep.id} className="flex items-center justify-between p-4 bg-[#151D2B] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#263248] flex items-center justify-center overflow-hidden">
                        {creatorProfile?.avatar_url
                          ? <img src={creatorProfile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          : <span className="text-lg text-[#6B7A94]">{rep.creator_user_id.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[#E8EEF9]">{creatorProfile?.display_name || rep.creator_user_id}</p>
                          {rep.exclusivity && <CCBadge variant="danger" size="sm" icon={Lock}>Exclusive</CCBadge>}
                        </div>
                        <div className="flex gap-3 mt-0.5">
                          {rep.commission_rate != null && (
                            <p className="text-xs text-[#9AA6BC]">{rep.commission_rate}% commission</p>
                          )}
                          {rep.started_at && (
                            <p className="text-xs text-[#6B7A94]">Since {format(new Date(rep.started_at), 'MMM d, yyyy')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <CCButton
                      variant="outline"
                      size="sm"
                      onClick={() => endRepMutation.mutate(rep)}
                      loading={endRepMutation.isPending}
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
          <CCCard padding="lg" className="mb-6">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Pending Invites</h2>
            <div className="space-y-3">
              {invitedReps.map(rep => {
                const creatorProfile = getProfile(rep.creator_user_id);
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
                    <CCBadge variant="warning" size="sm" icon={Clock}>Pending</CCBadge>
                  </div>
                );
              })}
            </div>
          </CCCard>
        )}

        {/* Declined/Ended History */}
        {endedReps.length > 0 && (
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">History</h2>
            <div className="space-y-2">
              {endedReps.map(rep => {
                const creatorProfile = getProfile(rep.creator_user_id);
                return (
                  <div key={rep.id} className="flex items-center justify-between p-3 bg-[#0D1520] rounded-lg">
                    <p className="text-sm text-[#9AA6BC]">{creatorProfile?.display_name || rep.creator_user_id}</p>
                    <div className="flex items-center gap-2">
                      {rep.decline_reason && (
                        <span className="text-xs text-[#6B7A94] italic">"{rep.decline_reason}"</span>
                      )}
                      <CCBadge variant={rep.status === 'DECLINED' ? 'danger' : 'default'} size="sm">
                        {rep.status}
                      </CCBadge>
                    </div>
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
        size="md"
      >
        <div className="space-y-4">
          <CCInput
            label="Creator Email"
            type="email"
            placeholder="creator@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <CCInput
              label="Commission Rate (%)"
              type="number"
              placeholder="e.g. 15"
              value={inviteCommission}
              onChange={(e) => setInviteCommission(e.target.value)}
              hint="Leave blank if not applicable"
            />
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inviteExclusive}
                  onChange={e => setInviteExclusive(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-[#E8EEF9]">Exclusive arrangement</span>
              </label>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <p className="text-sm font-medium text-[#E8EEF9] mb-2">Permissions Requested</p>
            <div className="space-y-2">
              {[
                { key: 'can_negotiate', label: 'Negotiate on creator\'s behalf' },
                { key: 'can_sign_contracts', label: 'Sign contracts' },
                { key: 'can_message', label: 'Message partners directly' },
                { key: 'can_view_private_gallery', label: 'View private gallery' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!invitePerms[key]}
                    onChange={e => setInvitePerms(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[#9AA6BC]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Agreement Notes</label>
            <textarea
              value={inviteNotes}
              onChange={(e) => setInviteNotes(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px] text-sm"
              placeholder="Terms and conditions, expectations..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <CCButton variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</CCButton>
            <CCButton
              variant="primary"
              onClick={() => inviteMutation.mutate({
                creatorEmail: inviteEmail,
                notes: inviteNotes,
                commission: inviteCommission,
                exclusive: inviteExclusive,
                perms: invitePerms,
              })}
              loading={inviteMutation.isPending}
              disabled={!inviteEmail}
            >
              Send Invite
            </CCButton>
          </div>
        </div>
      </CCModal>
      </div>
    </MobileRefreshPage>
    </FeatureRouteGuard>
  );
}