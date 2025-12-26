import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Save, Plus, Trash2 } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCSelect from '@/components/ui-custom/CCSelect';
import { toast } from 'sonner';

const SCOPES = [
  'PROFILES', 'COLLABORATIONS', 'CONTRACTS', 'MESSAGES', 
  'AUDIT_LOGS', 'VERIFICATION', 'TESTING', 'REPRESENTATION', 'COMPLIANCE'
];

const ACCESS_LEVELS = ['NONE', 'READ_METADATA_ONLY', 'READ_ONLY'];
const PII_LEVELS = ['NONE', 'STANDARD', 'STRICT'];

export default function AgentPermissionsEditor({ currentAdmin }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery({
    queryKey: ['agentProfiles'],
    queryFn: () => base44.entities.AgentProfile.list(),
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['agentPermissions', selectedAgentId],
    queryFn: () => base44.entities.AgentPermissionPolicy.filter({ agent_id: selectedAgentId }),
    enabled: !!selectedAgentId,
  });

  const createPermissionMutation = useMutation({
    mutationFn: (data) => base44.entities.AgentPermissionPolicy.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentPermissions'] });
      toast.success('Permission created');
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AgentPermissionPolicy.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentPermissions'] });
      toast.success('Permission updated');
    },
  });

  const deletePermissionMutation = useMutation({
    mutationFn: (id) => base44.entities.AgentPermissionPolicy.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentPermissions'] });
      toast.success('Permission deleted');
    },
  });

  const handleAddScope = () => {
    if (!selectedAgentId) {
      toast.error('Select an agent first');
      return;
    }
    createPermissionMutation.mutate({
      agent_id: selectedAgentId,
      scope: 'PROFILES',
      access_level: 'READ_ONLY',
      pii_redaction_level: 'STANDARD',
    });
  };

  const handleUpdate = (permissionId, field, value) => {
    updatePermissionMutation.mutate({
      id: permissionId,
      data: { [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Agent Selection */}
      <CCCard padding="lg">
        <CCSelect
          label="Select Agent"
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          options={[
            { value: '', label: 'Choose an agent...' },
            ...((agents || []).map(a => ({ value: a.id, label: a.name })))
          ]}
        />
      </CCCard>

      {selectedAgentId && (
        <>
          {/* Add Scope Button */}
          <div className="flex justify-end">
            <CCButton
              variant="primary"
              icon={Plus}
              onClick={handleAddScope}
              loading={createPermissionMutation.isPending}
            >
              Add Scope
            </CCButton>
          </div>

          {/* Permissions List */}
          <div className="space-y-4">
            {(permissions || []).map((perm) => (
              <CCCard key={perm.id} padding="lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <CCBadge variant="primary" size="lg">{perm.scope}</CCBadge>
                    <CCButton
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => deletePermissionMutation.mutate(perm.id)}
                      className="text-[#EF4444] hover:bg-[#EF4444]/10"
                    >
                      Delete
                    </CCButton>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <CCSelect
                     label="Access Level"
                     value={perm.access_level}
                     onChange={(e) => handleUpdate(perm.id, 'access_level', e.target.value)}
                     options={ACCESS_LEVELS.map(l => ({ value: l, label: l }))}
                   />
                   <CCSelect
                     label="PII Redaction"
                     value={perm.pii_redaction_level}
                     onChange={(e) => handleUpdate(perm.id, 'pii_redaction_level', e.target.value)}
                     options={PII_LEVELS.map(l => ({ value: l, label: l }))}
                   />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="flex items-center gap-2 text-sm text-[#E8EEF9]">
                      <input
                        type="checkbox"
                        checked={perm.can_generate_reports}
                        onChange={(e) => handleUpdate(perm.id, 'can_generate_reports', e.target.checked)}
                      />
                      Generate Reports
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#E8EEF9]">
                      <input
                        type="checkbox"
                        checked={perm.can_generate_risk_scores}
                        onChange={(e) => handleUpdate(perm.id, 'can_generate_risk_scores', e.target.checked)}
                      />
                      Generate Risk Scores
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#E8EEF9]">
                      <input
                        type="checkbox"
                        checked={perm.can_create_flags}
                        onChange={(e) => handleUpdate(perm.id, 'can_create_flags', e.target.checked)}
                      />
                      Create Flags
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#E8EEF9]">
                      <input
                        type="checkbox"
                        checked={perm.can_recommend_actions}
                        onChange={(e) => handleUpdate(perm.id, 'can_recommend_actions', e.target.checked)}
                      />
                      Recommend Actions
                    </label>
                  </div>
                </div>
              </CCCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}