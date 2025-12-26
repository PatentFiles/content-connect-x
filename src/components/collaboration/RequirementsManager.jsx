import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';

const REQUIREMENT_TAXONOMY = {
  REQUIRED_ROLE: {
    label: 'Required Role',
    options: ['creator', 'photographer', 'videographer', 'agent']
  },
  REQUIRED_SCENE_PAIRING: {
    label: 'Required Scene Pairing',
    options: [
      'Boy / Girl', 'Girl / Girl', 'Boy / Boy', 'Trans Male / Trans Male', 'Trans Female / Trans Female',
      'Group', 'Orgy', 'Interracial'
    ]
  },
  REQUIRED_STANDARD_ACT: {
    label: 'Required Standard Act',
    options: ['Oral', 'Anal', 'Toy Play', 'Threesome', 'Double Penetration', 'Squirting']
  },
  REQUIRED_FETISH_ACT: {
    label: 'Required Fetish Act',
    options: ['Roleplay', 'Power Dynamics', 'Latex / Rubber', 'Leather', 'Voyeurism', 'Exhibitionism']
  },
  REQUIRED_KINK_EDGE_ACT: {
    label: 'Required Kink/Edge Act',
    options: ['Bondage', 'Dominant', 'Submissive', 'Power Exchange', 'Impact Play', 'Sensory Deprivation']
  },
  REQUIRED_POSITIONING: {
    label: 'Required Positioning',
    options: ['Top', 'Bottom', 'Versatile', 'Dominant', 'Submissive']
  },
  REQUIRED_VERIFICATION: {
    label: 'Verification Required',
    options: ['Yes'],
    locked: true
  },
  REQUIRED_TESTING_VISIBILITY: {
    label: 'Testing Visibility',
    options: ['Private', 'Collaboration Room Only', 'Verified Collaborators']
  },
  REQUIRED_JURISDICTION: {
    label: 'Jurisdiction',
    options: ['US - California', 'US - Nevada', 'US - Florida', 'Canada', 'UK', 'EU - General']
  },
  REQUIRED_INSURANCE: {
    label: 'Insurance Required',
    options: ['Yes', 'No']
  },
  REPRESENTATION_COMPATIBILITY: {
    label: 'Representation Type',
    options: ['Independent Only', 'Agent-Represented Allowed', 'Studio-Represented Allowed', 'Any']
  },
  STUDIO_EXCLUSIVITY_COMPATIBILITY: {
    label: 'Studio Exclusivity',
    options: ['Respect Exclusivity', 'Non-Exclusive Only']
  }
};

export default function RequirementsManager({ collaborationId }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const queryClient = useQueryClient();

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['collaborationRequirements', collaborationId],
    queryFn: () => base44.entities.CollaborationRequirement.filter({ collaboration_id: collaborationId }),
    enabled: !!collaborationId
  });

  const addRequirementMutation = useMutation({
    mutationFn: (reqData) => base44.entities.CollaborationRequirement.create(reqData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborationRequirements', collaborationId] });
      toast.success('Requirement added');
      resetForm();
    },
    onError: () => toast.error('Failed to add requirement')
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: (reqId) => base44.entities.CollaborationRequirement.delete(reqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborationRequirements', collaborationId] });
      toast.success('Requirement removed');
    },
    onError: () => toast.error('Failed to remove requirement')
  });

  const resetForm = () => {
    setAddModalOpen(false);
    setSelectedType('');
    setSelectedValue('');
    setIsRequired(true);
  };

  const handleAddRequirement = () => {
    if (!selectedType || !selectedValue) {
      toast.error('Please select type and value');
      return;
    }

    addRequirementMutation.mutate({
      collaboration_id: collaborationId,
      requirement_type: selectedType,
      requirement_value: selectedValue,
      required: isRequired
    });
  };

  const hasVerificationRequirement = requirements.some(r => r.requirement_type === 'REQUIRED_VERIFICATION');

  const groupedRequirements = requirements.reduce((acc, req) => {
    const type = req.requirement_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(req);
    return acc;
  }, {});

  return (
    <CCCard>
      <CCCardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CCCardTitle>Collaboration Requirements</CCCardTitle>
            <p className="text-xs text-[#6B7A94] mt-1">Define participant requirements for AI matching</p>
          </div>
          <CCButton variant="primary" size="sm" icon={Plus} onClick={() => setAddModalOpen(true)}>
            Add
          </CCButton>
        </div>
      </CCCardHeader>
      <CCCardContent>
        {!hasVerificationRequirement && (
          <div className="flex items-start gap-2 p-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-lg mb-4">
            <Shield className="w-4 h-4 text-[#4F8CFF] mt-0.5" />
            <p className="text-sm text-[#9AA6BC]">Verification is always enforced. Add REQUIRED_VERIFICATION to make it explicit.</p>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-[#9AA6BC]">Loading requirements...</p>
        ) : requirements.length === 0 ? (
          <div className="flex items-start gap-2 p-3 bg-[#263248]/50 border border-[#263248] rounded-lg">
            <AlertCircle className="w-4 h-4 text-[#6B7A94] mt-0.5" />
            <p className="text-sm text-[#9AA6BC]">No requirements set. Add requirements to enable AI participant matching.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedRequirements).map(([type, reqs]) => {
              const config = REQUIREMENT_TAXONOMY[type];
              return (
                <div key={type}>
                  <p className="text-xs text-[#6B7A94] font-medium mb-2">{config?.label || type}</p>
                  <div className="flex flex-wrap gap-2">
                    {reqs.map(req => (
                      <div key={req.id} className="group relative">
                        <CCBadge variant={req.required ? 'danger' : 'primary'}>
                          {req.requirement_value}
                          {!req.required && ' (Preferred)'}
                        </CCBadge>
                        {!config?.locked && (
                          <button
                            onClick={() => deleteRequirementMutation.mutate(req.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CCCardContent>

      <CCModal isOpen={addModalOpen} onClose={resetForm} title="Add Requirement">
        <div className="space-y-4">
          <CCSelect
            label="Requirement Type"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedValue('');
            }}
            options={[
              { value: '', label: 'Select type...' },
              ...Object.entries(REQUIREMENT_TAXONOMY).map(([type, config]) => ({ value: type, label: config.label }))
            ]}
          />

          {selectedType && (
            <div>
              <label className="block text-sm text-[#E8EEF9] mb-2">{REQUIREMENT_TAXONOMY[selectedType]?.label}</label>
              <select
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              >
                <option value="">Select value...</option>
                {REQUIREMENT_TAXONOMY[selectedType]?.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            <label htmlFor="required" className="text-sm text-[#E8EEF9]">
              Mandatory (hard requirement)
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={resetForm}>Cancel</CCButton>
            <CCButton variant="primary" onClick={handleAddRequirement} loading={addRequirementMutation.isPending}>
              Add Requirement
            </CCButton>
          </div>
        </div>
      </CCModal>
    </CCCard>
  );
}