import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';

const REQUIREMENT_TYPES = [
  { value: 'required_role', label: 'Required Role', options: ['creator', 'photographer', 'videographer', 'agent'] },
  { value: 'experience_level', label: 'Experience Level', options: ['New (0-1 year)', 'Intermediate (1-3 years)', 'Professional (3-5 years)', 'Veteran (5+ years)'] },
  { value: 'scene_pairing', label: 'Scene Pairing', options: ['Boy/Girl', 'Girl/Girl', 'Boy/Boy', 'Group', 'Interracial', 'Trans Male', 'Trans Female', 'Solo'] },
  { value: 'acts_experience', label: 'Acts Experience', options: ['Oral', 'Vaginal', 'Anal', 'Toys', 'BDSM', 'Fetish', 'Roleplay'] },
  { value: 'performance_positioning', label: 'Performance Positioning', options: ['Top', 'Bottom', 'Versatile', 'Dominant', 'Submissive'] },
  { value: 'shooting_focus', label: 'Shooting Focus', options: ['Straight Content', 'Gay Content', 'Lesbian Content', 'Trans Content', 'Fetish', 'POV', 'Studio-style'] },
  { value: 'technical_skills', label: 'Technical Skills', options: ['Lighting', 'Multi-cam', 'Editing', 'Color Grading', 'Sound Design'] },
  { value: 'jurisdiction', label: 'Jurisdiction', options: ['US - California', 'US - Nevada', 'US - Florida', 'Canada', 'UK', 'EU'] },
  { value: 'representation_type', label: 'Representation Type', options: ['Independent Only', 'Agent-Represented Allowed', 'Studio-Represented Allowed', 'Any'] },
  { value: 'verification_required', label: 'Verification Required', options: ['Yes', 'No'] },
  { value: 'insurance_required', label: 'Insurance Required', options: ['Yes', 'No'] },
  { value: 'minimum_collaborations', label: 'Minimum Collaborations', options: ['0', '1', '3', '5', '10+'] },
  { value: 'dispute_free_history', label: 'Dispute-Free History', options: ['Required', 'Preferred', 'Not Required'] }
];

export default function RequirementsManager({ collaborationId, onRequirementsChange }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [isMandatory, setIsMandatory] = useState(true);
  const [priority, setPriority] = useState('5');
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
      onRequirementsChange?.();
      resetForm();
    },
    onError: () => toast.error('Failed to add requirement')
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: (reqId) => base44.entities.CollaborationRequirement.delete(reqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborationRequirements', collaborationId] });
      toast.success('Requirement removed');
      onRequirementsChange?.();
    },
    onError: () => toast.error('Failed to remove requirement')
  });

  const resetForm = () => {
    setAddModalOpen(false);
    setSelectedType('');
    setSelectedValue('');
    setIsMandatory(true);
    setPriority('5');
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
      is_mandatory: isMandatory,
      priority: parseInt(priority),
      ai_weight: isMandatory ? 2.0 : 1.0
    });
  };

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
            <p className="text-xs text-[#6B7A94] mt-1">Define who can participate in this collaboration</p>
          </div>
          <CCButton variant="primary" size="sm" icon={Plus} onClick={() => setAddModalOpen(true)}>
            Add Requirement
          </CCButton>
        </div>
      </CCCardHeader>
      <CCCardContent>
        {isLoading ? (
          <p className="text-sm text-[#9AA6BC]">Loading requirements...</p>
        ) : requirements.length === 0 ? (
          <div className="flex items-start gap-2 p-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-[#4F8CFF] mt-0.5" />
            <p className="text-sm text-[#9AA6BC]">No requirements set. Add requirements to enable AI-assisted participant matching.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedRequirements).map(([type, reqs]) => {
              const typeConfig = REQUIREMENT_TYPES.find(t => t.value === type);
              return (
                <div key={type}>
                  <p className="text-xs text-[#6B7A94] font-medium mb-2">
                    {typeConfig?.label || type}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {reqs.map(req => (
                      <div key={req.id} className="group relative">
                        <CCBadge variant={req.is_mandatory ? 'danger' : 'primary'}>
                          {req.requirement_value}
                          {!req.is_mandatory && ' (Preferred)'}
                        </CCBadge>
                        <button
                          onClick={() => deleteRequirementMutation.mutate(req.id)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CCCardContent>

      <CCModal
        isOpen={addModalOpen}
        onClose={resetForm}
        title="Add Requirement"
        description="Add a requirement for collaboration participants"
      >
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
              ...REQUIREMENT_TYPES.map(t => ({ value: t.value, label: t.label }))
            ]}
          />

          {selectedType && (
            <CCSelect
              label="Value"
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              options={[
                { value: '', label: 'Select value...' },
                ...(REQUIREMENT_TYPES.find(t => t.value === selectedType)?.options || []).map(opt => ({
                  value: opt,
                  label: opt
                }))
              ]}
            />
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mandatory"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
            />
            <label htmlFor="mandatory" className="text-sm text-[#E8EEF9]">
              Mandatory (hard requirement)
            </label>
          </div>

          <CCInput
            type="number"
            label="Priority (1-10)"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            min="1"
            max="10"
          />

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={resetForm}>Cancel</CCButton>
            <CCButton 
              variant="primary" 
              onClick={handleAddRequirement}
              loading={addRequirementMutation.isPending}
            >
              Add Requirement
            </CCButton>
          </div>
        </div>
      </CCModal>
    </CCCard>
  );
}