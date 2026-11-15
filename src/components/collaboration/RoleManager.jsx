import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Eye, Edit, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';

const roleConfig = {
  admin: {
    label: 'Admin',
    icon: Shield,
    variant: 'danger',
    description: 'Full control over collaboration',
    permissions: {
      manage_tasks: true,
      manage_files: true,
      manage_calendar: true,
      manage_contracts: true,
      manage_members: true,
      edit_details: true,
    }
  },
  editor: {
    label: 'Editor',
    icon: Edit,
    variant: 'primary',
    description: 'Can edit and manage content',
    permissions: {
      manage_tasks: true,
      manage_files: true,
      manage_calendar: true,
      manage_contracts: false,
      manage_members: false,
      edit_details: true,
    }
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    variant: 'default',
    description: 'View-only access',
    permissions: {
      manage_tasks: false,
      manage_files: false,
      manage_calendar: false,
      manage_contracts: false,
      manage_members: false,
      edit_details: false,
    }
  },
};

export default function RoleManager({ dealRoomId, participants, currentUserRole }) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');
  const queryClient = useQueryClient();

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', dealRoomId],
    queryFn: () => base44.entities.CollaborationRole.filter({ deal_room_id: dealRoomId }),
    enabled: !!dealRoomId,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const canManageMembers = currentUserRole?.permissions?.manage_members || currentUserRole?.role === 'admin';

  const assignRoleMutation = useMutation({
    mutationFn: (data) => {
      const existingRole = roles.find(r => r.user_id === data.user_id);
      if (existingRole) {
        return base44.entities.CollaborationRole.update(existingRole.id, {
          role: data.role,
          permissions: roleConfig[data.role].permissions,
        });
      }
      return base44.entities.CollaborationRole.create({
        deal_room_id: dealRoomId,
        user_id: data.user_id,
        role: data.role,
        permissions: roleConfig[data.role].permissions,
        assigned_by: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', dealRoomId] });
      toast.success('Role assigned');
      setAssignModalOpen(false);
      setSelectedUser('');
      setSelectedRole('viewer');
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: (id) => base44.entities.CollaborationRole.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', dealRoomId] });
      toast.success('Role removed');
    },
  });

  const getUserRole = (userId) => {
    return roles.find(r => r.user_id === userId);
  };

  const handleAssignRole = () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }
    assignRoleMutation.mutate({
      user_id: selectedUser,
      role: selectedRole,
    });
  };

  return (
    <div className="space-y-4">
      {canManageMembers && (
        <CCButton
          variant="primary"
          icon={Plus}
          onClick={() => setAssignModalOpen(true)}
          fullWidth
        >
          Assign Role
        </CCButton>
      )}

      <div className="space-y-3">
        {participants?.map(participant => {
          const role = getUserRole(participant.user_id);
          const config = role ? roleConfig[role.role] : roleConfig.viewer;
          const Icon = config.icon;

          return (
            <CCCard key={participant.user_id} padding="md">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#4F8CFF]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-[#E8EEF9]">
                        {participant.display_name || participant.user_id}
                      </p>
                      <CCBadge variant={config.variant}>{config.label}</CCBadge>
                    </div>
                    <p className="text-xs text-[#6B7A94] mb-2">{config.description}</p>
                    
                    {role && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(role.permissions).filter(([_, v]) => v).map(([key]) => (
                          <CCBadge key={key} size="sm" variant="outline">
                            {key.replace('manage_', '').replace('_', ' ')}
                          </CCBadge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {canManageMembers && role && participant.user_id !== user?.email && (
                  <div className="flex gap-2">
                    <CCButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(participant.user_id);
                        setSelectedRole(role.role);
                        setAssignModalOpen(true);
                      }}
                    >
                      Edit
                    </CCButton>
                    <button
                      onClick={() => removeRoleMutation.mutate(role.id)}
                      className="text-[#6B7A94] hover:text-[#EF4444] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </CCCard>
          );
        })}
      </div>

      <CCModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedUser('');
          setSelectedRole('viewer');
        }}
        title="Assign Role"
        description="Set user role and permissions"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
              Select User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg text-[#E8EEF9] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            >
              <option value="">Choose a user...</option>
              {participants?.filter(p => p.user_id !== user?.email).map(p => (
                <option key={p.user_id} value={p.user_id}>
                  {p.display_name || p.user_id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-3">
              Select Role
            </label>
            <div className="space-y-2">
              {Object.entries(roleConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedRole(key)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedRole === key
                        ? 'border-[#4F8CFF] bg-[#4F8CFF]/10'
                        : 'border-[#263248] hover:border-[#3A4A6B]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-[#4F8CFF] mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-[#E8EEF9]">{config.label}</p>
                        <p className="text-xs text-[#6B7A94] mt-1">{config.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(config.permissions).filter(([_, v]) => v).map(([perm]) => (
                            <CCBadge key={perm} size="sm" variant="outline">
                              {perm.replace('manage_', '').replace('_', ' ')}
                            </CCBadge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <CCButton
              variant="outline"
              onClick={() => {
                setAssignModalOpen(false);
                setSelectedUser('');
                setSelectedRole('viewer');
              }}
            >
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={handleAssignRole}
              loading={assignRoleMutation.isPending}
            >
              Assign Role
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}