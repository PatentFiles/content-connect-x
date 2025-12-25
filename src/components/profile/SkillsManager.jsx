import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, CheckCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';

const SKILL_CATEGORIES = {
  creator: [
    { value: 'scene_pairing', label: 'Scene Pairing Experience', options: [
      'Boy/Girl', 'Girl/Girl', 'Boy/Boy', 'Group', 'Interracial', 'Trans Male', 'Trans Female', 'Solo', 'Threesome', 'Orgy'
    ]},
    { value: 'acts_experience', label: 'Acts Experience', options: [
      'Oral', 'Vaginal', 'Anal', 'Handjob', 'Toys', 'BDSM', 'Fetish', 'Roleplay', 'Squirting', 'Creampie'
    ]},
    { value: 'performance_positioning', label: 'Performance Positioning', options: [
      'Top', 'Bottom', 'Versatile', 'Switch', 'Dominant', 'Submissive', 'Power Bottom', 'Service Top'
    ]},
    { value: 'experience_level', label: 'Experience Level', options: [
      'New (0-1 year)', 'Intermediate (1-3 years)', 'Professional (3-5 years)', 'Veteran (5+ years)', 'Studio-Level'
    ]}
  ],
  photographer: [
    { value: 'shooting_focus', label: 'Shooting Focus', options: [
      'Straight Content', 'Gay Content', 'Lesbian Content', 'Trans Content', 'Bisexual Content', 'Fetish', 'Studio-style', 'Gonzo', 'Cinematic', 'POV'
    ]},
    { value: 'technical_skills', label: 'Technical Skills', options: [
      'Lighting', 'Multi-cam', 'POV', 'Drone', '4K/8K', 'Editing', 'Color Grading', 'Sound Design', 'Motion Graphics'
    ]},
    { value: 'on_set_roles', label: 'On-set Roles', options: [
      'Director', 'Camera Operator', 'Lighting Tech', 'Gaffer', 'Sound Operator', 'Editor', 'Assistant Director'
    ]}
  ],
  videographer: [
    { value: 'shooting_focus', label: 'Shooting Focus', options: [
      'Straight Content', 'Gay Content', 'Lesbian Content', 'Trans Content', 'Bisexual Content', 'Fetish', 'Studio-style', 'Gonzo', 'Cinematic', 'POV', 'Documentary'
    ]},
    { value: 'technical_skills', label: 'Technical Skills', options: [
      'Lighting', 'Multi-cam', 'POV', 'Drone', '4K/8K', 'Editing', 'Color Grading', 'Sound Design', 'Motion Graphics', 'VR'
    ]},
    { value: 'on_set_roles', label: 'On-set Roles', options: [
      'Director', 'Camera Operator', 'DP', 'Gaffer', 'Sound Operator', 'Editor', 'Assistant Director', 'Producer'
    ]}
  ],
  agent: [
    { value: 'management_experience', label: 'Management Experience', options: [
      'Creator Management', 'Negotiation', 'Contract Review', 'Brand Building', 'Crisis Management', 'Content Strategy'
    ]},
    { value: 'genre_specialization', label: 'Genre Specialization', options: [
      'Straight', 'Gay', 'Lesbian', 'Trans', 'Bisexual', 'Fetish', 'Premium', 'Amateur', 'Studio'
    ]}
  ],
  studio: [
    { value: 'management_experience', label: 'Studio Operations', options: [
      'Roster Management', 'Production Management', 'Distribution', 'Marketing', 'Compliance', 'Multi-creator Shoots'
    ]},
    { value: 'genre_specialization', label: 'Content Specialization', options: [
      'Straight', 'Gay', 'Lesbian', 'Trans', 'Bisexual', 'Fetish', 'Premium', 'Amateur', 'Pro-Am'
    ]}
  ]
};

export default function SkillsManager({ userId, roleType }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [proficiency, setProficiency] = useState('intermediate');
  const [visibility, setVisibility] = useState('public');
  const queryClient = useQueryClient();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['profileSkills', userId],
    queryFn: () => base44.entities.ProfileSkill.filter({ user_id: userId }),
    enabled: !!userId
  });

  const addSkillMutation = useMutation({
    mutationFn: (skillData) => base44.entities.ProfileSkill.create(skillData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profileSkills', userId] });
      toast.success('Skill added successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to add skill')
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (skillId) => base44.entities.ProfileSkill.delete(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profileSkills', userId] });
      toast.success('Skill removed');
    },
    onError: () => toast.error('Failed to remove skill')
  });

  const resetForm = () => {
    setAddModalOpen(false);
    setSelectedCategory('');
    setSelectedSkill('');
    setYearsExp('');
    setProficiency('intermediate');
    setVisibility('public');
  };

  const handleAddSkill = () => {
    if (!selectedCategory || !selectedSkill) {
      toast.error('Please select category and skill');
      return;
    }

    addSkillMutation.mutate({
      user_id: userId,
      role_type: roleType,
      skill_category: selectedCategory,
      skill_value: selectedSkill,
      years_experience: yearsExp ? parseInt(yearsExp) : 0,
      proficiency_level: proficiency,
      visibility
    });
  };

  const categories = SKILL_CATEGORIES[roleType] || [];

  const groupedSkills = skills.reduce((acc, skill) => {
    const category = skill.skill_category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {});

  return (
    <CCCard>
      <CCCardHeader>
        <div className="flex items-center justify-between">
          <CCCardTitle>Skills & Experience</CCCardTitle>
          <CCButton variant="primary" size="sm" icon={Plus} onClick={() => setAddModalOpen(true)}>
            Add Skill
          </CCButton>
        </div>
      </CCCardHeader>
      <CCCardContent>
        {isLoading ? (
          <p className="text-sm text-[#9AA6BC]">Loading skills...</p>
        ) : skills.length === 0 ? (
          <p className="text-sm text-[#9AA6BC]">No skills added yet. Add your skills to improve match suggestions.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSkills).map(([category, categorySkills]) => {
              const categoryConfig = categories.find(c => c.value === category);
              return (
                <div key={category}>
                  <p className="text-xs text-[#6B7A94] font-medium mb-2">
                    {categoryConfig?.label || category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categorySkills.map(skill => (
                      <div key={skill.id} className="group relative">
                        <CCBadge 
                          variant={skill.verified ? 'success' : 'default'}
                          icon={skill.verified ? CheckCircle : null}
                        >
                          {skill.skill_value}
                          {skill.years_experience > 0 && ` (${skill.years_experience}y)`}
                        </CCBadge>
                        <button
                          onClick={() => deleteSkillMutation.mutate(skill.id)}
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
        title="Add Skill"
        description="Add a new skill to your profile"
      >
        <div className="space-y-4">
          <CCSelect
            label="Skill Category"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedSkill('');
            }}
            options={[
              { value: '', label: 'Select category...' },
              ...categories.map(c => ({ value: c.value, label: c.label }))
            ]}
          />

          {selectedCategory && (
            <CCSelect
              label="Skill"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              options={[
                { value: '', label: 'Select skill...' },
                ...(categories.find(c => c.value === selectedCategory)?.options || []).map(opt => ({
                  value: opt,
                  label: opt
                }))
              ]}
            />
          )}

          <CCInput
            type="number"
            label="Years of Experience (optional)"
            value={yearsExp}
            onChange={(e) => setYearsExp(e.target.value)}
            placeholder="0"
          />

          <CCSelect
            label="Proficiency Level"
            value={proficiency}
            onChange={(e) => setProficiency(e.target.value)}
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
              { value: 'expert', label: 'Expert' }
            ]}
          />

          <CCSelect
            label="Visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            options={[
              { value: 'public', label: 'Public' },
              { value: 'verified_only', label: 'Verified Members Only' },
              { value: 'private', label: 'Private' }
            ]}
          />

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={resetForm}>Cancel</CCButton>
            <CCButton 
              variant="primary" 
              onClick={handleAddSkill}
              loading={addSkillMutation.isPending}
            >
              Add Skill
            </CCButton>
          </div>
        </div>
      </CCModal>
    </CCCard>
  );
}