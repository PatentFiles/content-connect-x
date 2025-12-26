import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';

export default function SkillsManager({ userId, currentSkills = [] }) {
  const [customValue, setCustomValue] = useState('');
  const queryClient = useQueryClient();

  const { data: catalogItems = [] } = useQuery({
    queryKey: ['catalogItems'],
    queryFn: () => base44.entities.ContentCatalogItem.filter({ status: 'active' }),
  });

  const updateSkillsMutation = useMutation({
    mutationFn: async (skills) => {
      const profiles = await base44.entities.UserProfile.filter({ user_id: userId });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, {
          skills
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Skills updated');
    },
  });

  const addSkill = (skill) => {
    if (!currentSkills.includes(skill)) {
      updateSkillsMutation.mutate([...currentSkills, skill]);
    }
  };

  const removeSkill = (skill) => {
    updateSkillsMutation.mutate(currentSkills.filter(s => s !== skill));
  };

  const handleAddCustom = async () => {
    const value = customValue.trim();
    if (!value) return;

    try {
      await base44.entities.CustomValueSubmission.create({
        submitted_by: userId,
        category: 'niche_tag',
        custom_value: value,
        status: 'pending'
      });
      toast.success('Custom skill submitted for approval');
      setCustomValue('');
    } catch (error) {
      toast.error('Failed to submit custom skill');
    }
  };

  const nicheSkills = catalogItems
    .filter(item => item.category === 'niche_tag')
    .map(item => item.value);

  return (
    <CCCard padding="lg">
      <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Skills & Specialties</h3>

      {/* Current Skills */}
      {currentSkills.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-[#6B7A94] mb-2">Your Skills</p>
          <div className="flex flex-wrap gap-2">
            {currentSkills.map(skill => (
              <CCBadge key={skill} variant="primary">
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="ml-2 hover:text-[#EF4444]"
                >
                  <X className="w-3 h-3" />
                </button>
              </CCBadge>
            ))}
          </div>
        </div>
      )}

      {/* Available Skills */}
      <div className="mb-4">
        <p className="text-sm text-[#6B7A94] mb-2">Available Skills</p>
        <div className="flex flex-wrap gap-2">
          {nicheSkills
            .filter(skill => !currentSkills.includes(skill))
            .map(skill => (
              <CCButton
                key={skill}
                variant="outline"
                size="sm"
                onClick={() => addSkill(skill)}
              >
                {skill}
              </CCButton>
            ))}
        </div>
      </div>

      {/* Add Custom */}
      <div>
        <p className="text-sm text-[#6B7A94] mb-2">Add Custom Skill</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Enter custom skill..."
            className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          />
          <CCButton
            variant="primary"
            icon={Plus}
            onClick={handleAddCustom}
          >
            Add
          </CCButton>
        </div>
        <p className="text-xs text-[#6B7A94] mt-2">
          Custom skills require admin approval before appearing in search
        </p>
      </div>
    </CCCard>
  );
}