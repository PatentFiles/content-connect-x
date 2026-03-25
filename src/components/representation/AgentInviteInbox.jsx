/**
 * AgentInviteInbox — Creator-facing component showing pending agent representation invites.
 * Allows creators to accept or decline each invite with full enforcement.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Shield,
  Lock,
  MessageCircle,
  FileSignature,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';

function PermissionRow({ icon: Icon, label, granted }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${granted ? 'text-[#22C55E]' : 'text-[#6B7A94]'}`} />
      <span className={granted ? 'text-[#E8EEF9]' : 'text-[#6B7A94] line-through'}>{label}</span>
    </div>
  );
}

function InviteCard({ rep, agentProfile, agentDetails, onAccept, onDecline, accepting, declining }) {
  const [showDetails, setShowDetails] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  const perms = rep.permissions || {};
  const agentName = agentProfile?.display_name || rep.agent_user_id;
  const agencyName = agentDetails?.agency_name;

  return (
    <>
      <div className="p-4 bg-[#0D1520] border border-[#F59E0B]/30 rounded-xl space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FF2DAA]/20 flex items-center justify-center flex-shrink-0">
            {agentProfile?.avatar_url ? (
              <img src={agentProfile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <Briefcase className="w-6 h-6 text-[#FF2DAA]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[#E8EEF9]">{agentName}</p>
              {agencyName && (
                <CCBadge variant="accent" size="sm">{agencyName}</CCBadge>
              )}
              {rep.exclusivity && (
                <CCBadge variant="danger" size="sm" icon={Lock}>Exclusive</CCBadge>
              )}
            </div>
            <p className="text-xs text-[#6B7A94] mt-0.5">
              Invited {format(new Date(rep.created_date), 'MMM d, yyyy')}
            </p>
          </div>
          <CCBadge variant="warning" size="sm" icon={Clock}>Pending</CCBadge>
        </div>

        {/* Key Terms Row */}
        <div className="flex flex-wrap gap-3 text-sm">
          {rep.commission_rate != null && (
            <div className="flex items-center gap-1.5 text-[#9AA6BC]">
              <DollarSign className="w-4 h-4 text-[#4F8CFF]" />
              <span>{rep.commission_rate}% commission</span>
            </div>
          )}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-[#4F8CFF] hover:underline"
          >
            {showDetails ? 'Hide details' : 'View permissions & terms'}
          </button>
        </div>

        {/* Expanded Details */}
        {showDetails && (
          <div className="bg-[#151D2B] rounded-lg p-3 space-y-3">
            {/* Permissions */}
            <div>
              <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Permissions Requested</p>
              <div className="grid grid-cols-2 gap-1.5">
                <PermissionRow icon={MessageCircle} label="Negotiate on your behalf" granted={perms.can_negotiate !== false} />
                <PermissionRow icon={FileSignature} label="Sign contracts" granted={!!perms.can_sign_contracts} />
                <PermissionRow icon={MessageCircle} label="Message partners" granted={perms.can_message !== false} />
                <PermissionRow icon={Eye} label="View private gallery" granted={!!perms.can_view_private_gallery} />
              </div>
            </div>

            {/* Agreement Notes */}
            {rep.agreement_notes && (
              <div>
                <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-1">Agreement Notes</p>
                <p className="text-xs text-[#9AA6BC] leading-relaxed whitespace-pre-wrap">{rep.agreement_notes}</p>
              </div>
            )}

            {/* Exclusivity Warning */}
            {rep.exclusivity && (
              <div className="flex items-start gap-2 p-2 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#EF4444]">
                  This is an exclusive arrangement. Accepting will prevent you from having other active agent representations.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <CCButton
            variant="success"
            size="sm"
            icon={CheckCircle}
            className="flex-1"
            onClick={() => onAccept(rep)}
            loading={accepting}
            disabled={declining}
          >
            Accept
          </CCButton>
          <CCButton
            variant="danger"
            size="sm"
            icon={XCircle}
            className="flex-1"
            onClick={() => setShowDeclineModal(true)}
            loading={declining}
            disabled={accepting}
          >
            Decline
          </CCButton>
        </div>
      </div>

      {/* Decline Modal */}
      <CCModal
        isOpen={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        title="Decline Representation Invite"
        description={`Decline invite from ${agentName}?`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Reason (optional)</label>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px]"
              placeholder="Let them know why (optional)..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" size="sm" onClick={() => setShowDeclineModal(false)}>Cancel</CCButton>
            <CCButton
              variant="danger"
              size="sm"
              icon={XCircle}
              onClick={() => {
                onDecline(rep, declineReason);
                setShowDeclineModal(false);
              }}
              loading={declining}
            >
              Confirm Decline
            </CCButton>
          </div>
        </div>
      </CCModal>
    </>
  );
}

export default function AgentInviteInbox({ userId, profile }) {
  const queryClient = useQueryClient();
  const [actioningId, setActioningId] = useState(null);
  const [actioningType, setActioningType] = useState(null);

  // Fetch pending invites sent TO this creator
  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['creatorInvites', userId],
    queryFn: () => base44.entities.AgentRepresentation.filter({
      creator_user_id: userId,
      status: 'INVITED',
    }),
    enabled: !!userId,
  });

  // Fetch agent profiles for each invite
  const agentIds = [...new Set(invites.map(i => i.agent_user_id))];
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['agentProfilesForInvites', agentIds],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: agentIds.length > 0,
  });
  const { data: allAgentDetails = [] } = useQuery({
    queryKey: ['agentDetailsForInvites', agentIds],
    queryFn: () => base44.entities.AgentDetails.list(),
    enabled: agentIds.length > 0,
  });

  // Fetch creator's current active reps (for exclusivity conflict check)
  const { data: activeReps = [] } = useQuery({
    queryKey: ['myActiveReps', userId],
    queryFn: () => base44.entities.AgentRepresentation.filter({ creator_user_id: userId, status: 'ACTIVE' }),
    enabled: !!userId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (rep) => {
      // Enforcement: banned/suspended check
      if (profile?.banned || profile?.suspended) {
        throw new Error('Your account is restricted. Cannot accept representations.');
      }

      // Enforcement: exclusivity conflict
      if (activeReps.length > 0 && rep.exclusivity) {
        throw new Error('You already have an active representation. Cannot accept an exclusive invite.');
      }
      // If incoming has no exclusivity but an existing active rep is exclusive
      const existingExclusive = activeReps.find(r => r.exclusivity);
      if (existingExclusive) {
        throw new Error('You have an exclusive representation. You must end it before accepting new invitations.');
      }

      // Accept: INVITED → ACTIVE
      await base44.entities.AgentRepresentation.update(rep.id, {
        status: 'ACTIVE',
        started_at: new Date().toISOString(),
      });

      // Notify agent
      await base44.entities.Notification.create({
        user_id: rep.agent_user_id,
        type: 'messages',
        actor_user_id: userId,
        title: 'Representation Accepted',
        body: `${profile?.display_name || userId} has accepted your representation invite.`,
      });

      // Log audit trail
      await base44.entities.AdminActionLog.create({
        action_type: 'representation_invite_accepted',
        target_user_id: rep.agent_user_id,
        performed_by: userId,
        details: `Creator accepted representation from agent. Rep ID: ${rep.id}`,
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorInvites', userId] });
      queryClient.invalidateQueries({ queryKey: ['myActiveReps', userId] });
      queryClient.invalidateQueries({ queryKey: ['myRepresentations'] });
      toast.success('Representation accepted! The agent has been notified.');
      setActioningId(null);
      setActioningType(null);
    },
    onError: (e) => {
      toast.error(e.message || 'Failed to accept invite');
      setActioningId(null);
      setActioningType(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ rep, reason }) => {
      await base44.entities.AgentRepresentation.update(rep.id, {
        status: 'DECLINED',
        declined_at: new Date().toISOString(),
        decline_reason: reason || '',
      });

      // Notify agent
      await base44.entities.Notification.create({
        user_id: rep.agent_user_id,
        type: 'messages',
        actor_user_id: userId,
        title: 'Representation Invite Declined',
        body: `${profile?.display_name || userId} has declined your representation invite.${reason ? ` Reason: ${reason}` : ''}`,
      });

      // Log audit trail
      await base44.entities.AdminActionLog.create({
        action_type: 'representation_invite_declined',
        target_user_id: rep.agent_user_id,
        performed_by: userId,
        details: `Creator declined representation invite. Rep ID: ${rep.id}${reason ? `. Reason: ${reason}` : ''}`,
      }).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorInvites', userId] });
      toast.success('Invite declined.');
      setActioningId(null);
      setActioningType(null);
    },
    onError: (e) => {
      toast.error(e.message || 'Failed to decline invite');
      setActioningId(null);
      setActioningType(null);
    },
  });

  if (isLoading || invites.length === 0) return null;

  const getAgentProfile = (id) => allProfiles.find(p => p.user_id === id);
  const getAgentDetails = (id) => allAgentDetails.find(d => d.user_id === id);

  return (
    <CCCard padding="lg" className="mb-6 border-[#F59E0B]/30">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
          <Briefcase className="w-4 h-4 text-[#F59E0B]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[#E8EEF9]">Agent Representation Invites</h2>
          <p className="text-xs text-[#6B7A94]">{invites.length} pending invite{invites.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="space-y-3">
        {invites.map(rep => (
          <InviteCard
            key={rep.id}
            rep={rep}
            agentProfile={getAgentProfile(rep.agent_user_id)}
            agentDetails={getAgentDetails(rep.agent_user_id)}
            onAccept={(r) => {
              setActioningId(r.id);
              setActioningType('accept');
              acceptMutation.mutate(r);
            }}
            onDecline={(r, reason) => {
              setActioningId(r.id);
              setActioningType('decline');
              declineMutation.mutate({ rep: r, reason });
            }}
            accepting={actioningId === rep.id && actioningType === 'accept' && acceptMutation.isPending}
            declining={actioningId === rep.id && actioningType === 'decline' && declineMutation.isPending}
          />
        ))}
      </div>
    </CCCard>
  );
}