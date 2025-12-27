import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Building, Plus, X, Edit, Users } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function RepresentationManager() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [representationType, setRepresentationType] = useState('agent'); // 'agent' or 'studio'
  const [formData, setFormData] = useState({
    creator_user_id: '',
    agent_user_id: '',
    studio_id: '',
    representation_type: 'Non-Exclusive',
    revenue_share_percentage: 10,
    applies_to: 'all_collaborations',
  });
  const queryClient = useQueryClient();

  // Fetch representations
  const { data: agentReps = [] } = useQuery({
    queryKey: ['allAgentRepresentations'],
    queryFn: () => base44.entities.AgentRepresentation.list(),
  });

  const { data: studioReps = [] } = useQuery({
    queryKey: ['allStudioRepresentations'],
    queryFn: () => base44.entities.StudioRepresentation.list(),
  });

  // Fetch all profiles for display
  const { data: profiles = [] } = useQuery({
    queryKey: ['allProfilesForReps'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  // Create agent representation
  const createAgentRepMutation = useMutation({
    mutationFn: (data) => base44.entities.AgentRepresentation.create({
      agent_user_id: data.agent_user_id,
      creator_user_id: data.creator_user_id,
      status: 'ACTIVE',
      started_at: new Date().toISOString(),
      agreement_notes: 'Created by admin'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAgentRepresentations']);
      toast.success('Agent representation created');
      setShowCreateModal(false);
      resetForm();
    },
  });

  // Create studio representation
  const createStudioRepMutation = useMutation({
    mutationFn: (data) => base44.entities.StudioRepresentation.create({
      studio_id: data.studio_id,
      creator_user_id: data.creator_user_id,
      representation_type: data.representation_type,
      revenue_share_percentage: data.revenue_share_percentage,
      applies_to: data.applies_to,
      effective_date: new Date().toISOString().split('T')[0],
      active: true,
      terms_acknowledged: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allStudioRepresentations']);
      toast.success('Studio representation created');
      setShowCreateModal(false);
      resetForm();
    },
  });

  // Disable representation
  const disableAgentRepMutation = useMutation({
    mutationFn: (id) => base44.entities.AgentRepresentation.update(id, {
      status: 'ENDED',
      ended_at: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allAgentRepresentations']);
      toast.success('Agent representation ended');
    },
  });

  const disableStudioRepMutation = useMutation({
    mutationFn: (id) => base44.entities.StudioRepresentation.update(id, { active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allStudioRepresentations']);
      toast.success('Studio representation disabled');
    },
  });

  const resetForm = () => {
    setFormData({
      creator_user_id: '',
      agent_user_id: '',
      studio_id: '',
      representation_type: 'Non-Exclusive',
      revenue_share_percentage: 10,
      applies_to: 'all_collaborations',
    });
  };

  const handleCreate = () => {
    if (representationType === 'agent') {
      if (!formData.agent_user_id || !formData.creator_user_id) {
        toast.error('Please fill all required fields');
        return;
      }
      createAgentRepMutation.mutate(formData);
    } else {
      if (!formData.studio_id || !formData.creator_user_id) {
        toast.error('Please fill all required fields');
        return;
      }
      createStudioRepMutation.mutate(formData);
    }
  };

  const creators = profiles.filter(p => p.role_type === 'creator');
  const agents = profiles.filter(p => p.role_type === 'agent');
  const studios = profiles.filter(p => p.role_type === 'studio');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#E8EEF9]">Representation Management</h2>
        <CCButton variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
          Add Representation
        </CCButton>
      </div>

      {/* Agent Representations */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          Agent Representations ({agentReps.filter(r => r.status === 'ACTIVE').length} active)
        </h3>
        <div className="space-y-3">
          {agentReps.map(rep => {
            const creator = profiles.find(p => p.user_id === rep.creator_user_id);
            const agent = profiles.find(p => p.user_id === rep.agent_user_id);
            return (
              <div key={rep.id} className="flex items-center justify-between p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#FF2DAA]" />
                  <div>
                    <p className="text-sm text-[#E8EEF9]">
                      <span className="font-medium">{creator?.display_name || rep.creator_user_id}</span>
                      {' → '}
                      <span className="font-medium">{agent?.display_name || rep.agent_user_id}</span>
                    </p>
                    <p className="text-xs text-[#6B7A94]">
                      Started {rep.started_at && format(new Date(rep.started_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CCBadge variant={rep.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                    {rep.status}
                  </CCBadge>
                  {rep.status === 'ACTIVE' && (
                    <CCButton
                      variant="danger"
                      size="sm"
                      icon={X}
                      onClick={() => disableAgentRepMutation.mutate(rep.id)}
                    >
                      End
                    </CCButton>
                  )}
                </div>
              </div>
            );
          })}
          {agentReps.length === 0 && (
            <p className="text-sm text-[#6B7A94] text-center py-4">No agent representations</p>
          )}
        </div>
      </CCCard>

      {/* Studio Representations */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
          <Building className="w-5 h-5" />
          Studio Representations ({studioReps.filter(r => r.active).length} active)
        </h3>
        <div className="space-y-3">
          {studioReps.map(rep => {
            const creator = profiles.find(p => p.user_id === rep.creator_user_id);
            const studio = profiles.find(p => p.user_id === rep.studio_id);
            return (
              <div key={rep.id} className="flex items-center justify-between p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                <div className="flex items-center gap-3 flex-1">
                  <Building className="w-5 h-5 text-[#22C55E]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-[#E8EEF9]">
                        <span className="font-medium">{creator?.display_name || rep.creator_user_id}</span>
                        {' → '}
                        <span className="font-medium">{studio?.display_name || rep.studio_id}</span>
                      </p>
                      {rep.representation_type === 'Exclusive' && (
                        <CCBadge variant="warning" size="sm">Exclusive</CCBadge>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A94]">
                      {rep.revenue_share_percentage}% revenue share • {rep.applies_to.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CCBadge variant={rep.active ? 'success' : 'default'} size="sm">
                    {rep.active ? 'Active' : 'Inactive'}
                  </CCBadge>
                  {rep.active && (
                    <CCButton
                      variant="danger"
                      size="sm"
                      icon={X}
                      onClick={() => disableStudioRepMutation.mutate(rep.id)}
                    >
                      Disable
                    </CCButton>
                  )}
                </div>
              </div>
            );
          })}
          {studioReps.length === 0 && (
            <p className="text-sm text-[#6B7A94] text-center py-4">No studio representations</p>
          )}
        </div>
      </CCCard>

      {/* Create Modal */}
      <CCModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Representation"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <CCButton
              variant={representationType === 'agent' ? 'primary' : 'outline'}
              fullWidth
              onClick={() => setRepresentationType('agent')}
            >
              Agent
            </CCButton>
            <CCButton
              variant={representationType === 'studio' ? 'primary' : 'outline'}
              fullWidth
              onClick={() => setRepresentationType('studio')}
            >
              Studio
            </CCButton>
          </div>

          <CCSelect
            label="Creator *"
            value={formData.creator_user_id}
            onChange={(e) => setFormData({ ...formData, creator_user_id: e.target.value })}
          >
            <option value="">Select Creator</option>
            {creators.map(c => (
              <option key={c.user_id} value={c.user_id}>{c.display_name} ({c.user_id})</option>
            ))}
          </CCSelect>

          {representationType === 'agent' ? (
            <CCSelect
              label="Agent *"
              value={formData.agent_user_id}
              onChange={(e) => setFormData({ ...formData, agent_user_id: e.target.value })}
            >
              <option value="">Select Agent</option>
              {agents.map(a => (
                <option key={a.user_id} value={a.user_id}>{a.display_name} ({a.user_id})</option>
              ))}
            </CCSelect>
          ) : (
            <>
              <CCSelect
                label="Studio *"
                value={formData.studio_id}
                onChange={(e) => setFormData({ ...formData, studio_id: e.target.value })}
              >
                <option value="">Select Studio</option>
                {studios.map(s => (
                  <option key={s.user_id} value={s.user_id}>{s.display_name} ({s.user_id})</option>
                ))}
              </CCSelect>

              <CCSelect
                label="Representation Type"
                value={formData.representation_type}
                onChange={(e) => setFormData({ ...formData, representation_type: e.target.value })}
              >
                <option value="Exclusive">Exclusive</option>
                <option value="Non-Exclusive">Non-Exclusive</option>
                <option value="Revenue-Share Affiliate">Revenue-Share Affiliate</option>
              </CCSelect>

              <CCInput
                label="Revenue Share %"
                type="number"
                min="0"
                max="100"
                value={formData.revenue_share_percentage}
                onChange={(e) => setFormData({ ...formData, revenue_share_percentage: parseFloat(e.target.value) })}
              />

              <CCSelect
                label="Applies To"
                value={formData.applies_to}
                onChange={(e) => setFormData({ ...formData, applies_to: e.target.value })}
              >
                <option value="all_collaborations">All Collaborations</option>
                <option value="off_studio_only">Off-Studio Only</option>
                <option value="specific_types">Specific Types</option>
              </CCSelect>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <CCButton variant="outline" fullWidth onClick={() => setShowCreateModal(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              fullWidth
              onClick={handleCreate}
              loading={createAgentRepMutation.isPending || createStudioRepMutation.isPending}
            >
              Create
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}