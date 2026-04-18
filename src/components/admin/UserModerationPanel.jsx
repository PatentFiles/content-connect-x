import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserX, UserCheck, Eye, ChevronDown, ChevronUp, Shield, ShieldOff, RefreshCw, Ban, MapPin } from 'lucide-react';
import { SuspensionStatusBadge, SuspensionActionButtons } from '@/components/admin/SuspensionManager';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Helper: call the secure server-side moderation function ─────────────────
async function callModerationAction({ action, targetUserId, reason }) {
  const res = await base44.functions.invoke('adminModerationAction', { action, targetUserId, reason });

  console.log('ADMIN RESPONSE:', res);

  if (!res.data || res.data.success === false) {
    throw new Error(res.data?.error || 'Admin action failed');
  }
  return res.data;
}

export default function UserModerationPanel({ currentAdmin }) {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'deleted'
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
    queryClient.invalidateQueries({ queryKey: ['allVerifications'] });
    queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
  };

  const closeModal = () => {
    setActionModalOpen(false);
    setSelectedUser(null);
    setActionReason('');
    setActionNotes('');
  };

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: profiles = [] } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list(),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => base44.entities.Subscription.list(),
  });

  const { data: agentReps = [] } = useQuery({
    queryKey: ['allAgentReps'],
    queryFn: () => base44.entities.AgentRepresentation.list(),
  });

  const { data: studioReps = [] } = useQuery({
    queryKey: ['allStudioReps'],
    queryFn: () => base44.entities.StudioRepresentation.list(),
  });

  // ── Secure moderation mutation (routes through backend function) ─────────────
  const moderationMutation = useMutation({
    mutationFn: callModerationAction,
    onSuccess: () => {
      invalidateAll();
      toast.success('Action completed successfully');
      closeModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to complete action');
      console.error('Moderation error:', err);
    },
  });

  // ── Toggle admin via secure backend ─────────────────────────────────────────
  const toggleAdminMutation = useMutation({
    mutationFn: ({ userId, isAdmin }) =>
      callModerationAction({
        action: isAdmin ? 'remove_admin' : 'make_admin',
        targetUserId: userId,
        reason: isAdmin ? 'Removed admin privileges' : 'Granted admin privileges',
      }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Admin status updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update admin status');
      console.error('toggleAdmin error:', err);
    },
  });

  // ── Reset verification (VerificationRecord — admin can update own RLS allows admin role) ─
  const resetVerificationMutation = useMutation({
    mutationFn: async (userId) => {
      const verification = verifications.find(v => v.user_id === userId);
      if (verification) {
        await base44.entities.VerificationRecord.update(verification.id, {
          status: 'pending',
          verified_at: null,
          expires_at: null,
          rejection_reason: null,
        });
      }
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'User',
        target_id: userId,
        action: 'reset_verification',
        reason: 'Manual reset by admin',
        metadata_json: { timestamp: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Verification reset to pending');
    },
    onError: () => toast.error('Failed to reset verification'),
  });

  // ── Delete account — direct service-role–backed entity writes (admin-only entity RLS) ──
  const deleteAccountMutation = useMutation({
    mutationFn: async (userId) => {
      const profile = profiles.find(p => p.user_id === userId);
      if (!profile) throw new Error('Profile not found');
      const now = new Date().toISOString();
      await base44.entities.UserProfile.update(profile.id, {
        display_name: '[Deleted User]',
        real_name: null,
        bio: null,
        avatar_url: null,
        cover_url: null,
        base_location: null,
        travel_enabled: false,
        profile_complete: false,
        account_deactivated: true,
        deleted_at: now,
        deletion_status: 'anonymized',
        banned: false,
        suspended: false,
      });
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'User',
        target_id: userId,
        action: 'delete_account',
        reason: actionReason || 'Admin-initiated account deletion',
        notes: `Account deleted by admin at ${now}`,
        metadata_json: { timestamp: now },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      toast.success('Account deleted successfully');
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Failed to delete account'),
  });

  // ── Action handlers ──────────────────────────────────────────────────────────
  const handleAction = (action, user) => {
    setActionType(action);
    setSelectedUser(user);
    setActionModalOpen(true);
  };

  const confirmAction = () => {
    if (actionType === 'delete_account') {
      deleteAccountMutation.mutate(selectedUser.user_id);
      return;
    }

    if (!actionReason.trim()) {
      toast.error('Reason is required');
      return;
    }

    // Map modal action types to backend function action names
    const actionMap = {
      ban_account: 'ban',
      unsuspend_account: 'unban',
    };

    const mappedAction = actionMap[actionType];
    if (!mappedAction) {
      toast.error(`Unknown action: ${actionType}`);
      return;
    }

    moderationMutation.mutate({
      action: mappedAction,
      targetUserId: selectedUser.user_id,
      reason: actionReason,
    });
  };

  // ── Filter logic ─────────────────────────────────────────────────────────────
  const isDeleted = (p) => p.account_deactivated || p.deletion_status === 'anonymized' || p.deletion_status === 'completed';

  const filteredProfiles = profiles.filter(profile => {
    // Tab segregation
    if (activeTab === 'deleted' && !isDeleted(profile)) return false;
    if (activeTab === 'active' && isDeleted(profile)) return false;

    const matchesSearch =
      searchTerm === '' ||
      profile.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.user_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || profile.role_type === roleFilter;

    const userVerification = verifications.find(v => v.user_id === profile.user_id);
    const matchesVerification =
      verificationFilter === 'all' ||
      (verificationFilter === 'verified' && userVerification?.status === 'approved') ||
      (verificationFilter === 'pending' && userVerification?.status === 'pending') ||
      (verificationFilter === 'unverified' && !userVerification);

    const userSubscription = subscriptions.find(s => s.user_id === profile.user_id);
    const matchesSubscription =
      subscriptionFilter === 'all' ||
      (subscriptionFilter === 'active' && userSubscription?.status === 'active') ||
      (subscriptionFilter === 'trial' && userSubscription?.status === 'trial') ||
      (subscriptionFilter === 'none' && !userSubscription);

    const locationString = `${profile.base_location?.city || ''} ${profile.base_location?.state || ''} ${profile.base_location?.country || ''}`.toLowerCase();
    const matchesLocation = locationFilter === '' || locationString.includes(locationFilter.toLowerCase());

    return matchesSearch && matchesRole && matchesVerification && matchesSubscription && matchesLocation;
  });

  const isPending = moderationMutation.isPending || deleteAccountMutation.isPending;

  const deletedCount = profiles.filter(isDeleted).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">User Moderation</h2>
        <p className="text-sm text-[#6B7A94]">Search, filter, and moderate user accounts</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'active'
              ? 'bg-[#4F8CFF] text-white'
              : 'bg-[#151D2B] border border-[#263248] text-[#9AA6BC] hover:text-[#E8EEF9]'
          }`}
        >
          Active Users
        </button>
        <button
          onClick={() => setActiveTab('deleted')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'deleted'
              ? 'bg-[#6B7A94] text-white'
              : 'bg-[#151D2B] border border-[#263248] text-[#9AA6BC] hover:text-[#E8EEF9]'
          }`}
        >
          Deleted Accounts
          {deletedCount > 0 && (
            <span className="bg-[#263248] text-[#9AA6BC] text-xs px-1.5 py-0.5 rounded-full">{deletedCount}</span>
          )}
        </button>
      </div>

      {/* Filters */}
      <CCCard padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          >
            <option value="all">All Roles</option>
            <option value="creator">Creator</option>
            <option value="agent">Agent</option>
            <option value="studio">Studio</option>
            <option value="photographer">Photographer</option>
            <option value="videographer">Videographer</option>
            <option value="video_editor">Video Editor</option>
          </select>
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unverified">Unverified</option>
          </select>
          <select
            value={subscriptionFilter}
            onChange={(e) => setSubscriptionFilter(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          >
            <option value="all">All Subscriptions</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="none">No Subscription</option>
          </select>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
            <input
              type="text"
              placeholder="Filter by location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
        </div>
      </CCCard>

      {/* Users List */}
      <div className="space-y-3">
        {filteredProfiles.map(profile => {
          const userVerification = verifications.find(v => v.user_id === profile.user_id);
          const userSubscription = subscriptions.find(s => s.user_id === profile.user_id);
          const userAgentRep = agentReps.find(r => r.creator_id === profile.user_id);
          const userStudioRep = studioReps.find(r => r.creator_id === profile.user_id);
          const isVerified = userVerification?.status === 'approved';
          const isExpanded = expandedUserId === profile.user_id;

          return (
            <CCCard key={profile.user_id} padding="lg" hover>
              {/* Collapsed View */}
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-4 flex-1 cursor-pointer"
                  onClick={() => setExpandedUserId(isExpanded ? null : profile.user_id)}
                >
                  {profile.avatar_url && (
                    <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-medium text-[#E8EEF9]">{profile.display_name}</p>
                      {profile.is_admin && <CCBadge variant="warning" size="sm" icon={Shield}>Admin</CCBadge>}
                      {isVerified && <CCBadge variant="success" size="sm">Verified</CCBadge>}
                      {profile.role_type && profile.role_type !== 'admin' && (
                        <CCBadge variant="outline" size="sm">{profile.role_type}</CCBadge>
                      )}
                      {userSubscription?.status === 'active' && userSubscription.plan_id !== 'admin_access' && (
                        <CCBadge variant="primary" size="sm">{userSubscription.plan_id}</CCBadge>
                      )}
                      {isDeleted(profile) && <CCBadge variant="default" size="sm">Deleted</CCBadge>}
                      {!isDeleted(profile) && <SuspensionStatusBadge profile={profile} />}
                    </div>
                    <p className="text-xs text-[#6B7A94]">{profile.user_id}</p>
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    {isExpanded
                      ? <ChevronUp className="w-5 h-5 text-[#6B7A94]" />
                      : <ChevronDown className="w-5 h-5 text-[#6B7A94]" />}
                  </motion.div>
                </div>
              </div>

              {/* Expanded View */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 pt-4 border-t border-[#263248]"
                  >
                    <div className="space-y-4">
                      {/* Profile Info */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {profile.real_name && (
                          <div>
                            <p className="text-[#6B7A94] mb-1">Real Name (Admin Only)</p>
                            <p className="text-[#E8EEF9]">{profile.real_name}</p>
                          </div>
                        )}
                        {profile.age && (
                          <div>
                            <p className="text-[#6B7A94] mb-1">Age</p>
                            <p className="text-[#E8EEF9]">{profile.age}</p>
                          </div>
                        )}
                        {profile.base_location && (
                          <div>
                            <p className="text-[#6B7A94] mb-1">Location</p>
                            <p className="text-[#E8EEF9]">
                              {profile.base_location.city && `${profile.base_location.city}, `}
                              {profile.base_location.state || profile.base_location.country}
                            </p>
                          </div>
                        )}
                        {profile.created_date && (
                          <div>
                            <p className="text-[#6B7A94] mb-1">Joined</p>
                            <p className="text-[#E8EEF9]">{new Date(profile.created_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        {userVerification && (
                          <div>
                            <p className="text-[#6B7A94] mb-1">Verification Status</p>
                            <p className="text-[#E8EEF9] capitalize">{userVerification.status}</p>
                          </div>
                        )}
                        {userSubscription && userSubscription.plan_id !== 'admin_access' && (
                          <div>
                            <p className="text-[#6B7A94] mb-1">Subscription</p>
                            <p className="text-[#E8EEF9] capitalize">{userSubscription.status} - {userSubscription.plan_id}</p>
                          </div>
                        )}
                      </div>

                      {/* Representation Info */}
                      {(userAgentRep || userStudioRep) && (
                        <div className="border-t border-[#263248] pt-3">
                          <p className="text-sm text-[#6B7A94] mb-2">Representation</p>
                          <div className="flex gap-2 flex-wrap">
                            {userAgentRep && (
                              <CCBadge variant="accent">
                                Agent: {profiles.find(p => p.user_id === userAgentRep.agent_id)?.display_name || userAgentRep.agent_id}
                                {userAgentRep.exclusive && ' (Exclusive)'}
                              </CCBadge>
                            )}
                            {userStudioRep && (
                              <CCBadge variant="success">
                                Studio: {profiles.find(p => p.user_id === userStudioRep.studio_id)?.display_name || userStudioRep.studio_id}
                                {userStudioRep.exclusive && ' (Exclusive)'}
                              </CCBadge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Admin Action Buttons */}
                      <div className="flex gap-2 flex-wrap pt-3 border-t border-[#263248]">
                        <CCButton
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => window.open(`/ViewProfile?id=${profile.user_id}`, '_blank')}
                        >
                          View Profile
                        </CCButton>
                        {/* Suspension / Ban controls via SuspensionActionButtons */}
                        <SuspensionActionButtons profile={profile} onActionComplete={invalidateAll} />
                        {/* Permanent ban (separate from suspension) */}
                        {!profile.banned && !profile.suspended && (
                          <CCButton
                            variant="danger"
                            size="sm"
                            icon={Ban}
                            onClick={() => handleAction('ban_account', profile)}
                          >
                            Perm Ban
                          </CCButton>
                        )}
                        {profile.banned && (
                          <CCButton
                            variant="success"
                            size="sm"
                            icon={UserCheck}
                            onClick={() => handleAction('unsuspend_account', profile)}
                          >
                            Unban
                          </CCButton>
                        )}
                        {!isDeleted(profile) && userVerification && (
                          <CCButton
                            variant="outline"
                            size="sm"
                            icon={RefreshCw}
                            onClick={() => resetVerificationMutation.mutate(profile.user_id)}
                            loading={resetVerificationMutation.isPending}
                          >
                            Reset Verification
                          </CCButton>
                        )}
                        {!isDeleted(profile) && (
                          <CCButton
                            variant={profile.is_admin ? 'warning' : 'primary'}
                            size="sm"
                            icon={profile.is_admin ? ShieldOff : Shield}
                            onClick={() => toggleAdminMutation.mutate({
                              userId: profile.user_id,
                              isAdmin: profile.is_admin,
                            })}
                            loading={toggleAdminMutation.isPending}
                          >
                            {profile.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </CCButton>
                        )}
                        {!profile.is_admin && !isDeleted(profile) && (
                          <CCButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleAction('delete_account', profile)}
                          >
                            Delete Account
                          </CCButton>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CCCard>
          );
        })}
      </div>

      {/* Action Confirmation Modal */}
      <CCModal
        isOpen={actionModalOpen}
        onClose={closeModal}
        title={`${actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — ${selectedUser?.display_name}`}
        description={
          actionType === 'delete_account'
            ? 'This will permanently deactivate and anonymize the account.'
            : 'Provide a reason for this administrative action'
        }
      >
        <div className="space-y-4">
          {actionType === 'delete_account' ? (
            <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-sm text-[#EF4444]">
              Are you sure you want to delete <strong>{selectedUser?.display_name}</strong>'s account? This will
              anonymize their profile, remove their personal data, and deactivate their account. Safety records and
              collaboration history will be preserved.
            </div>
          ) : (
            <>
              <CCInput
                label="Reason *"
                placeholder="Why is this action being taken?"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                required
              />
              <div>
                <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Internal Notes</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Additional context (visible to admins only)"
                  rows={3}
                  className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
              </div>
            </>
          )}
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={closeModal}>
              Cancel
            </CCButton>
            <CCButton
              variant="danger"
              onClick={confirmAction}
              loading={isPending}
            >
              {actionType === 'delete_account' ? 'Delete Account' : 'Confirm Action'}
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}