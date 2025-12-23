import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Briefcase, Building, Trash2, Star, Shield, MessageSquareOff, MessageSquare } from 'lucide-react';
import CCCard, { CCCardHeader, CCCardTitle, CCCardDescription, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';

export default function RepresentationManager({ user, profile }) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const queryClient = useQueryClient();

  // Fetch agent representations
  const { data: agentReps = [] } = useQuery({
    queryKey: ['myAgentReps', user?.email],
    queryFn: () => base44.entities.AgentRepresentation.filter({ creator_user_id: user?.email }),
    enabled: !!user && profile?.role_type === 'creator',
  });

  // Fetch studio rosters
  const { data: studioRosters = [] } = useQuery({
    queryKey: ['myStudioRosters', user?.email],
    queryFn: () => base44.entities.StudioRoster.filter({ creator_user_id: user?.email }),
    enabled: !!user && profile?.role_type === 'creator',
  });

  // Fetch representative profiles
  const agentIds = agentReps.map(r => r.agent_user_id);
  const studioIds = studioRosters.map(r => r.studio_user_id);

  const { data: representativeProfiles = [] } = useQuery({
    queryKey: ['repProfiles', [...agentIds, ...studioIds]],
    queryFn: async () => {
      const allIds = [...agentIds, ...studioIds];
      if (allIds.length === 0) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => allIds.includes(p.user_id));
    },
    enabled: (agentIds.length + studioIds.length) > 0,
  });

  // Delete mutations
  const deleteAgentMutation = useMutation({
    mutationFn: (id) => base44.entities.AgentRepresentation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['myAgentReps']);
      toast.success('Agent representation removed');
      setDeleteModalOpen(false);
      setItemToDelete(null);
    },
  });

  const deleteStudioMutation = useMutation({
    mutationFn: (id) => base44.entities.StudioRoster.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['myStudioRosters']);
      toast.success('Studio relationship removed');
      setDeleteModalOpen(false);
      setItemToDelete(null);
    },
  });

  // Update profile settings
  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.entities.UserProfile.update(profile.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['myProfile']);
      toast.success('Settings updated');
    },
  });

  const handleDelete = () => {
    if (itemToDelete.type === 'agent') {
      deleteAgentMutation.mutate(itemToDelete.id);
    } else {
      deleteStudioMutation.mutate(itemToDelete.id);
    }
  };

  const setPrimaryRepresentation = (repType, repId) => {
    updateProfileMutation.mutate({
      primary_representation_type: repType,
      primary_representation_id: repId,
    });
  };

  const toggleDirectContact = () => {
    updateProfileMutation.mutate({
      allow_direct_contact_while_represented: !profile.allow_direct_contact_while_represented,
    });
  };

  const activeAgentReps = agentReps.filter(r => r.status === 'ACTIVE');
  const activeStudioRosters = studioRosters.filter(r => r.status === 'ACTIVE');
  const hasActiveRepresentation = activeAgentReps.length > 0 || activeStudioRosters.length > 0;

  if (profile?.role_type !== 'creator') {
    return null;
  }

  return (
    <div className="space-y-4">
      <CCCard>
        <CCCardHeader>
          <CCCardTitle>Representation & Contacts</CCCardTitle>
          <CCCardDescription>
            Manage your agent and studio relationships
          </CCCardDescription>
        </CCCardHeader>
        <CCCardContent>
          {/* Contact Settings */}
          {hasActiveRepresentation && (
            <div className="mb-6 p-4 bg-[#0B0F14] rounded-lg border border-[#263248]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {profile.allow_direct_contact_while_represented ? (
                    <MessageSquare className="w-5 h-5 text-[#22C55E]" />
                  ) : (
                    <MessageSquareOff className="w-5 h-5 text-[#EF4444]" />
                  )}
                  <span className="text-sm font-medium text-[#E8EEF9]">
                    Direct Contact
                  </span>
                </div>
                <CCButton
                  variant={profile.allow_direct_contact_while_represented ? 'success' : 'outline'}
                  size="sm"
                  onClick={toggleDirectContact}
                >
                  {profile.allow_direct_contact_while_represented ? 'Enabled' : 'Disabled'}
                </CCButton>
              </div>
              <p className="text-xs text-[#6B7A94]">
                {profile.allow_direct_contact_while_represented
                  ? 'Others can message you directly even while represented'
                  : 'All messages are routed through your representatives'}
              </p>
            </div>
          )}

          {/* Agent Representations */}
          {activeAgentReps.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#E8EEF9] mb-3">Agent Representation</h3>
              <div className="space-y-2">
                {activeAgentReps.map(rep => {
                  const agent = representativeProfiles.find(p => p.user_id === rep.agent_user_id);
                  const isPrimary = profile.primary_representation_id === rep.id;
                  return (
                    <div key={rep.id} className="flex items-center justify-between p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-[#FF2DAA]/20 flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
                        </div>
                        <div className="flex-1">
                          {agent && (
                            <Link to={createPageUrl(`ViewProfile?id=${agent.user_id}`)} className="text-[#E8EEF9] font-medium hover:text-[#4F8CFF]">
                              {agent.display_name}
                            </Link>
                          )}
                          <p className="text-xs text-[#6B7A94]">Agent</p>
                        </div>
                        {isPrimary && (
                          <CCBadge variant="accent" icon={Star} size="sm">Primary</CCBadge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!isPrimary && (
                          <CCButton
                            variant="ghost"
                            size="sm"
                            icon={Star}
                            onClick={() => setPrimaryRepresentation('agent', rep.id)}
                          >
                            Set Primary
                          </CCButton>
                        )}
                        <CCButton
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => {
                            setItemToDelete({ type: 'agent', id: rep.id, name: agent?.display_name });
                            setDeleteModalOpen(true);
                          }}
                          className="text-[#EF4444] hover:bg-[#EF4444]/10"
                        >
                          Remove
                        </CCButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Studio Rosters */}
          {activeStudioRosters.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#E8EEF9] mb-3">Studio Relationships</h3>
              <div className="space-y-2">
                {activeStudioRosters.map(roster => {
                  const studio = representativeProfiles.find(p => p.user_id === roster.studio_user_id);
                  const isPrimary = profile.primary_representation_id === roster.id;
                  return (
                    <div key={roster.id} className="flex items-center justify-between p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                          <Building className="w-5 h-5 text-[#22C55E]" />
                        </div>
                        <div className="flex-1">
                          {studio && (
                            <Link to={createPageUrl(`ViewProfile?id=${studio.user_id}`)} className="text-[#E8EEF9] font-medium hover:text-[#4F8CFF]">
                              {studio.display_name}
                            </Link>
                          )}
                          <p className="text-xs text-[#6B7A94] capitalize">
                            {roster.relationship_type?.replace('_', ' ')}
                          </p>
                        </div>
                        {isPrimary && (
                          <CCBadge variant="success" icon={Star} size="sm">Primary</CCBadge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!isPrimary && (
                          <CCButton
                            variant="ghost"
                            size="sm"
                            icon={Star}
                            onClick={() => setPrimaryRepresentation('studio', roster.id)}
                          >
                            Set Primary
                          </CCButton>
                        )}
                        <CCButton
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => {
                            setItemToDelete({ type: 'studio', id: roster.id, name: studio?.display_name });
                            setDeleteModalOpen(true);
                          }}
                          className="text-[#EF4444] hover:bg-[#EF4444]/10"
                        >
                          Remove
                        </CCButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasActiveRepresentation && (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
              <p className="text-sm text-[#9AA6BC]">
                No active representation. Agents and studios can invite you to their roster.
              </p>
            </div>
          )}
        </CCCardContent>
      </CCCard>

      {/* Delete Confirmation Modal */}
      <CCModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Remove Representation"
        description="Are you sure you want to remove this representation?"
      >
        <div className="space-y-4">
          {itemToDelete && (
            <div className="bg-[#0B0F14] border border-[#263248] rounded-lg p-4">
              <p className="text-[#E8EEF9] font-medium">{itemToDelete.name}</p>
              <p className="text-sm text-[#6B7A94] capitalize">
                {itemToDelete.type === 'agent' ? 'Agent' : 'Studio'}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="danger"
              onClick={handleDelete}
              loading={deleteAgentMutation.isPending || deleteStudioMutation.isPending}
            >
              Remove
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}