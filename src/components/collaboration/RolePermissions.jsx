import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, UserCheck, Eye, AlertCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';

const roleConfig = {
  Admin: {
    icon: Shield,
    variant: 'accent',
    description: 'Full control - can edit, manage, and finalize'
  },
  Member: {
    icon: UserCheck,
    variant: 'primary',
    description: 'Participate, comment, upload (if allowed)'
  },
  Viewer: {
    icon: Eye,
    variant: 'outline',
    description: 'Read-only access to collaboration'
  }
};

export default function RolePermissions({ collaborationId, currentUser, currentUserRole }) {
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('Member');
  const queryClient = useQueryClient();

  const { data: participantRoles = [] } = useQuery({
    queryKey: ['participantRoles', collaborationId],
    queryFn: () => base44.entities.CollaborationParticipantRole.filter({
      collaboration_id: collaborationId
    }),
    enabled: !!collaborationId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['roleProfiles', participantRoles],
    queryFn: async () => {
      const userIds = [...new Set(participantRoles.map(r => r.user_id))];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: participantRoles.length > 0,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, role }) => {
      await base44.entities.CollaborationParticipantRole.update(roleId, { role });
      
      // Log activity
      const userProfile = profiles.find(p => p.user_id === selectedUser.user_id);
      await base44.entities.CollaborationActivityLog.create({
        collaboration_id: collaborationId,
        actor_user_id: currentUser.email,
        actor_role: currentUserRole,
        action_type: 'role_changed',
        description: `${currentUser.full_name} changed ${userProfile?.display_name}'s role to ${role}`,
        metadata_json: { user_id: selectedUser.user_id, old_role: selectedUser.role, new_role: role }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participantRoles'] });
      queryClient.invalidateQueries({ queryKey: ['collaborationActivity'] });
      toast.success('Role updated');
      setShowManageModal(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast.error('Failed to update role');
    }
  });

  const handleChangeRole = () => {
    if (!selectedUser) return;
    
    updateRoleMutation.mutate({
      roleId: selectedUser.id,
      role: newRole
    });
  };

  const canManageRoles = currentUserRole === 'Admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-1">Participant Roles</h3>
        <p className="text-xs text-[#6B7A94]">
          Role-based permissions control access and actions
        </p>
      </div>

      {/* Roles List */}
      <div className="space-y-2">
        {participantRoles.map(roleEntry => {
          const profile = profiles.find(p => p.user_id === roleEntry.user_id);
          const config = roleConfig[roleEntry.role] || roleConfig.Member;
          const Icon = config.icon;
          const isCurrentUser = roleEntry.user_id === currentUser.email;

          return (
            <CCCard key={roleEntry.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {profile?.avatar_url && (
                    <img 
                      src={profile.avatar_url} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover" 
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#E8EEF9]">
                        {profile?.display_name || 'User'}
                      </p>
                      {isCurrentUser && (
                        <CCBadge size="sm" variant="outline">You</CCBadge>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A94] capitalize">
                      {profile?.role_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CCBadge variant={config.variant} icon={Icon}>
                      {roleEntry.role}
                    </CCBadge>
                    {!roleEntry.approved && (
                      <CCBadge variant="warning" size="sm">
                        Pending Approval
                      </CCBadge>
                    )}
                  </div>
                </div>
                {canManageRoles && !isCurrentUser && (
                  <CCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(roleEntry);
                      setNewRole(roleEntry.role);
                      setShowManageModal(true);
                    }}
                  >
                    Change
                  </CCButton>
                )}
              </div>
            </CCCard>
          );
        })}
      </div>

      {/* Role Descriptions */}
      <CCCard padding="md">
        <div className="space-y-3">
          <p className="text-sm font-medium text-[#E8EEF9]">Role Permissions</p>
          {Object.entries(roleConfig).map(([roleName, config]) => {
            const Icon = config.icon;
            return (
              <div key={roleName} className="flex items-start gap-2">
                <Icon className="w-4 h-4 text-[#9AA6BC] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-[#E8EEF9] font-medium">{roleName}</p>
                  <p className="text-xs text-[#6B7A94]">{config.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CCCard>

      {/* Change Role Modal */}
      {selectedUser && (
        <CCModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
          title="Change Role"
          description={`Change role for ${profiles.find(p => p.user_id === selectedUser.user_id)?.display_name}`}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              {Object.entries(roleConfig).map(([roleName, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={roleName}
                    onClick={() => setNewRole(roleName)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      newRole === roleName
                        ? 'bg-[#4F8CFF]/20 border-[#4F8CFF] text-[#E8EEF9]'
                        : 'bg-[#151D2B] border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
                    }`}
                  >
                    <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium">{roleName}</p>
                      <p className="text-xs opacity-80">{config.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 justify-end">
              <CCButton variant="outline" onClick={() => setShowManageModal(false)}>
                Cancel
              </CCButton>
              <CCButton 
                variant="primary" 
                onClick={handleChangeRole}
                loading={updateRoleMutation.isPending}
              >
                Change Role
              </CCButton>
            </div>
          </div>
        </CCModal>
      )}
    </div>
  );
}