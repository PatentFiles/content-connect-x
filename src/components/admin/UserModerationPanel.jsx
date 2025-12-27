import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserX, UserCheck, Flag, StickyNote, Eye, ChevronDown, ChevronUp, Shield, ShieldOff, RefreshCw, Ban, MapPin, Calendar } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import { CCSelect } from '@/components/ui-custom/CCSelect';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function UserModerationPanel({ currentAdmin }) {
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

  const adminActionMutation = useMutation({
    mutationFn: async ({ action, userId, reason, notes, updateData }) => {
      // Log the action
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'User',
        target_id: userId,
        action,
        reason,
        notes,
        metadata_json: { timestamp: new Date().toISOString() }
      });

      // If there's update data, apply it to the profile
      if (updateData) {
        const profile = profiles.find(p => p.user_id === userId);
        if (profile) {
          await base44.entities.UserProfile.update(profile.id, updateData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['allVerifications'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('Action completed successfully');
      setActionModalOpen(false);
      setSelectedUser(null);
      setActionReason('');
      setActionNotes('');
    },
    onError: (error) => {
      toast.error('Failed to complete action');
      console.error(error);
    }
  });

  const resetVerificationMutation = useMutation({
    mutationFn: async (userId) => {
      const verification = verifications.find(v => v.user_id === userId);
      if (verification) {
        await base44.entities.VerificationRecord.update(verification.id, {
          status: 'pending',
          verified_at: null,
          expires_at: null,
          rejection_reason: null
        });
      }
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'User',
        target_id: userId,
        action: 'reset_verification',
        reason: 'Manual reset by admin',
        metadata_json: { timestamp: new Date().toISOString() }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allVerifications'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('Verification reset to pending');
    },
    onError: () => toast.error('Failed to reset verification')
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }) => {
      const profile = profiles.find(p => p.user_id === userId);
      if (profile) {
        await base44.entities.UserProfile.update(profile.id, { 
          is_admin: !isAdmin 
        });
      }
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'User',
        target_id: userId,
        action: isAdmin ? 'demote_admin' : 'promote_admin',
        reason: isAdmin ? 'Removed admin privileges' : 'Granted admin privileges',
        metadata_json: { timestamp: new Date().toISOString() }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('Admin status updated');
    },
    onError: () => toast.error('Failed to update admin status')
  });

  const handleAction = (action, user) => {
    setActionType(action);
    setSelectedUser(user);
    setActionModalOpen(true);
  };

  const confirmAction = () => {
    if (!actionReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    adminActionMutation.mutate({
      action: actionType,
      userId: selectedUser.user_id,
      reason: actionReason,
      notes: actionNotes
    });
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = searchTerm === '' || 
      profile.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.user_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || profile.role_type === roleFilter;
    
    const userVerification = verifications.find(v => v.user_id === profile.user_id);
    const matchesVerification = verificationFilter === 'all' || 
      (verificationFilter === 'verified' && userVerification?.status === 'approved') ||
      (verificationFilter === 'pending' && userVerification?.status === 'pending') ||
      (verificationFilter === 'unverified' && !userVerification);

    const userSubscription = subscriptions.find(s => s.user_id === profile.user_id);
    const matchesSubscription = subscriptionFilter === 'all' ||
      (subscriptionFilter === 'active' && userSubscription?.status === 'active') ||
      (subscriptionFilter === 'trial' && userSubscription?.status === 'trial') ||
      (subscriptionFilter === 'none' && !userSubscription);

    const locationString = `${profile.base_location?.city || ''} ${profile.base_location?.state || ''} ${profile.base_location?.country || ''}`.toLowerCase();
    const matchesLocation = locationFilter === '' || locationString.includes(locationFilter.toLowerCase());
    
    return matchesSearch && matchesRole && matchesVerification && matchesSubscription && matchesLocation;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">User Moderation</h2>
        <p className="text-sm text-[#6B7A94]">Search, filter, and moderate user accounts</p>
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
                      <CCBadge variant="outline" size="sm">{profile.role_type}</CCBadge>
                      {userSubscription?.status === 'active' && (
                        <CCBadge variant="primary" size="sm">{userSubscription.plan_id}</CCBadge>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A94]">{profile.user_id}</p>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-[#6B7A94]" /> : <ChevronDown className="w-5 h-5 text-[#6B7A94]" />}
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
                      {/* Full Profile Info */}
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
                        {userSubscription && (
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

                      {/* Admin Actions */}
                      <div className="flex gap-2 flex-wrap pt-3 border-t border-[#263248]">
                        <CCButton
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => window.open(`/ViewProfile?id=${profile.user_id}`, '_blank')}
                        >
                          View Profile
                        </CCButton>
                        <CCButton
                          variant="outline"
                          size="sm"
                          icon={UserX}
                          onClick={() => handleAction('suspend_account', profile)}
                        >
                          Suspend
                        </CCButton>
                        <CCButton
                          variant="outline"
                          size="sm"
                          icon={UserCheck}
                          onClick={() => handleAction('unsuspend_account', profile)}
                        >
                          Unsuspend
                        </CCButton>
                        <CCButton
                          variant="danger"
                          size="sm"
                          icon={Ban}
                          onClick={() => handleAction('ban_account', profile)}
                        >
                          Ban
                        </CCButton>
                        {userVerification && (
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
                        <CCButton
                          variant={profile.is_admin ? 'warning' : 'primary'}
                          size="sm"
                          icon={profile.is_admin ? ShieldOff : Shield}
                          onClick={() => toggleAdminMutation.mutate({ 
                            userId: profile.user_id, 
                            isAdmin: profile.is_admin 
                          })}
                          loading={toggleAdminMutation.isPending}
                        >
                          {profile.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </CCButton>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CCCard>
          );
        })}
      </div>

      {/* Action Modal */}
      <CCModal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={`${actionType.replace(/_/g, ' ')} - ${selectedUser?.display_name}`}
        description="Provide a reason for this administrative action"
      >
        <div className="space-y-4">
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
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setActionModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="danger" 
              onClick={confirmAction}
              loading={adminActionMutation.isPending}
            >
              Confirm Action
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}