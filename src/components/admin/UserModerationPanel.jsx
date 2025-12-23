import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserX, UserCheck, Flag, StickyNote, Eye } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import { toast } from 'sonner';

export default function UserModerationPanel({ currentAdmin }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
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

  const adminActionMutation = useMutation({
    mutationFn: async ({ action, userId, reason, notes }) => {
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'User',
        target_id: userId,
        action,
        reason,
        notes,
        metadata_json: { timestamp: new Date().toISOString() }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('Action logged successfully');
      setActionModalOpen(false);
      setSelectedUser(null);
      setActionReason('');
      setActionNotes('');
    },
    onError: () => {
      toast.error('Failed to log action');
    }
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
    
    return matchesSearch && matchesRole && matchesVerification;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">User Moderation</h2>
        <p className="text-sm text-[#6B7A94]">Search, filter, and moderate user accounts</p>
      </div>

      {/* Filters */}
      <CCCard padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <option value="all">All Verification Status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </CCCard>

      {/* Users List */}
      <div className="space-y-3">
        {filteredProfiles.map(profile => {
          const userVerification = verifications.find(v => v.user_id === profile.user_id);
          const isVerified = userVerification?.status === 'approved';
          
          return (
            <CCCard key={profile.user_id} padding="lg" hover>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {profile.avatar_url && (
                    <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-[#E8EEF9]">{profile.display_name}</p>
                      {isVerified && <CCBadge variant="success" size="sm">Verified</CCBadge>}
                      <CCBadge variant="outline" size="sm">{profile.role_type}</CCBadge>
                    </div>
                    <p className="text-xs text-[#6B7A94]">{profile.user_id}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <CCButton
                    variant="ghost"
                    size="sm"
                    icon={Eye}
                    onClick={() => window.open(`/ViewProfile?id=${profile.user_id}`, '_blank')}
                  >
                    View
                  </CCButton>
                  <CCButton
                    variant="ghost"
                    size="sm"
                    icon={Flag}
                    onClick={() => handleAction('flag_user', profile)}
                  >
                    Flag
                  </CCButton>
                  <CCButton
                    variant="ghost"
                    size="sm"
                    icon={UserX}
                    onClick={() => handleAction('suspend_account', profile)}
                    className="text-[#EF4444] hover:bg-[#EF4444]/10"
                  >
                    Suspend
                  </CCButton>
                </div>
              </div>
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