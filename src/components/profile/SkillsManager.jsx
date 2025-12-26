import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';

const SKILL_TAXONOMY = {
  creator: {
    SCENE_PAIRING: {
      label: 'Scene Pairings',
      options: [
        'Boy / Girl', 'Girl / Girl', 'Boy / Boy',
        'Trans Male / Trans Male', 'Trans Female / Trans Female', 'Trans Male / Trans Female',
        'Trans Female / Boy', 'Trans Female / Girl', 'Trans Male / Boy', 'Trans Male / Girl',
        'Trans Female / Trans Male', 'Non-Binary / Boy', 'Non-Binary / Girl',
        'Non-Binary / Trans Male', 'Non-Binary / Trans Female', 'Non-Binary / Non-Binary',
        'Boy / Boy / Girl', 'Boy / Girl / Girl', 'Boy / Boy / Boy', 'Girl / Girl / Girl',
        'Trans Male / Trans Male / Trans Male', 'Trans Female / Trans Female / Trans Female',
        'Trans Male / Trans Male / Girl', 'Trans Female / Trans Female / Boy',
        'Trans Male / Boy / Girl', 'Trans Female / Boy / Girl',
        'Trans Male / Girl / Girl', 'Trans Female / Boy / Boy',
        'Trans Male / Trans Female / Boy', 'Trans Male / Trans Female / Girl',
        'Trans Female / Trans Male / Girl', 'Trans Female / Trans Male / Boy',
        'Non-Binary / Boy / Girl', 'Non-Binary / Trans Male / Trans Female',
        'Non-Binary / Girl / Girl', 'Non-Binary / Boy / Boy',
        'Non-Binary / Non-Binary / Boy', 'Non-Binary / Non-Binary / Girl',
        'Boy / Girl / Boy / Girl', 'Boy / Boy / Girl / Girl',
        'Boy / Boy / Boy / Girl', 'Girl / Girl / Girl / Boy',
        'Trans Mixed Group', 'Trans Male Group', 'Trans Female Group', 'Non-Binary Mixed Group',
        'Boy / Boy / Boy / Boy', 'Girl / Girl / Girl / Girl',
        'Trans Male / Trans Male / Trans Male / Trans Male',
        'Trans Female / Trans Female / Trans Female / Trans Female',
        'Trans Male / Trans Female / Boy / Girl',
        'Group', 'Orgy', 'Trans Male Group', 'Trans Female Group',
        'Trans Male Orgy', 'Trans Female Orgy', 'Non-Binary Group', 'Non-Binary Orgy',
        'Interracial'
      ]
    },
    STANDARD_ACT: {
      label: 'Standard Acts',
      options: [
        'Solo', 'Group', 'Oral', 'Anal', 'Facial', 'Creampie', 'Swallowing',
        'Prints / Stills', 'Interracial', 'Orgy', 'Handjob', 'Footjob', 'Blowjob',
        'Cunnilingus', 'Anilingus', 'Outdoor Sex', 'Car Sex', 'Kissing', 'Edging',
        'Masturbation', 'Threesome', 'Foursome', 'Double Penetration', 'Triple Penetration',
        'Squirting', 'Prostate Massage', 'Pegging', 'StrapOn', 'Toy Play', 'Bukkake', 'Gloryhole'
      ]
    },
    FETISH_ACT: {
      label: 'Fetish Acts',
      options: [
        'Roleplay', 'Power Dynamics', 'Sensory Focus', 'Toy Use', 'Latex / Rubber',
        'Leather', 'Chastity', 'Cuckolding', 'Hotwifing', 'Voyeurism', 'Exhibitionism',
        'CFNM (Clothed Female Naked Male)', 'CMNF (Clothed Male Naked Female)', 'Age Gap'
      ]
    },
    KINK_EDGE_ACT: {
      label: 'Kink/Edge Acts',
      options: [
        'Bondage', 'Dominant', 'Submissive', 'Power Exchange', 'Strap-On', 'Pegging',
        'Swinger', 'Hotwife', 'Cuckold', 'Impact Play', 'Sensory Deprivation', 'Breath Play'
      ]
    },
    PERFORMANCE_POSITIONING: {
      label: 'Performance Positioning',
      options: ['Top', 'Bottom', 'Versatile', 'Switch', 'Dominant', 'Submissive'],
      conditional: 'gay_bi_male' // Only for gay/bi male creators
    },
    NICHE_TAG: {
      label: 'Niche Tags',
      options: [
        'Petite', 'Slim', 'Athletic', 'Curvy', 'Thick', 'PAWG', 'BBW', 'Fit', 'Muscular',
        'Tall', 'Short', 'Bear', 'Otter', 'Teen (18+)', 'MILF', 'DILF', 'GILF', 'Cougar',
        'Twink', 'Age Gap', 'Daddy', 'Sissy', 'Tomboy', 'Femme', 'Butch', 'Androgyne',
        'Genderqueer', 'Non-Binary', 'Drag Queen', 'Drag King', 'Crossdresser', 'Femboy',
        'Shemale', 'Ladyboy', 'Trans Top', 'Trans Bottom', 'Trans Versatile',
        'Intersex Fantasy', 'Dominant', 'Submissive', 'Switch', 'Top', 'Bottom', 'Versatile',
        'Master', 'Slave', 'Mistress', 'Brat', 'Goth', 'Punk', 'Emo', 'Interracial', 'BBC', 'BWC'
      ]
    }
  },
  photographer: {
    CREATOR_TYPES_SERVED: {
      label: 'Creator Types Served',
      options: ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Trans Male', 'Trans Female']
    },
    SHOOT_STYLE: {
      label: 'Shoot Style',
      options: ['Cinematic', 'BTS', 'Social', 'Promo', 'Editorial', 'POV', 'Studio-style', 'Gonzo']
    },
    TECHNICAL_SKILL: {
      label: 'Technical Skills',
      options: ['Lighting', 'Multi-cam', 'Editing', 'Color Grading', 'Sound Design', 'Motion Graphics', '4K/8K', 'Drone']
    }
  },
  videographer: {
    CREATOR_TYPES_SERVED: {
      label: 'Creator Types Served',
      options: ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Trans Male', 'Trans Female']
    },
    SHOOT_STYLE: {
      label: 'Shoot Style',
      options: ['Cinematic', 'BTS', 'Social', 'Promo', 'Editorial', 'POV', 'Studio-style', 'Gonzo', 'Documentary']
    },
    TECHNICAL_SKILL: {
      label: 'Technical Skills',
      options: ['Lighting', 'Multi-cam', 'Editing', 'Color Grading', 'Sound Design', 'Motion Graphics', '4K/8K', 'Drone', 'VR']
    }
  },
  agent: {
    GENRES_MANAGED: {
      label: 'Genres Managed',
      options: ['Straight', 'Gay', 'Lesbian', 'Trans', 'Bisexual', 'Fetish', 'Premium', 'Amateur', 'Studio']
    },
    JURISDICTIONS_OPERATED: {
      label: 'Jurisdictions Operated',
      options: ['US - California', 'US - Nevada', 'US - Florida', 'US - Other', 'Canada', 'UK', 'EU - General', 'Australia']
    }
  },
  studio: {
    GENRES_MANAGED: {
      label: 'Content Specialization',
      options: ['Straight', 'Gay', 'Lesbian', 'Trans', 'Bisexual', 'Fetish', 'Premium', 'Amateur', 'Pro-Am']
    },
    JURISDICTIONS_OPERATED: {
      label: 'Jurisdictions Operated',
      options: ['US - California', 'US - Nevada', 'US - Florida', 'US - Other', 'Canada', 'UK', 'EU - General', 'Australia']
    }
  }
};

export default function SkillsManager({ userId, roleType, creatorOrientation }) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const queryClient = useQueryClient();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['profileSkills', userId],
    queryFn: () => base44.entities.ProfileSkill.filter({ user_id: userId, role_scope: roleType }),
    enabled: !!userId && !!roleType
  });

  const addSkillMutation = useMutation({
    mutationFn: (skillData) => base44.entities.ProfileSkill.create(skillData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profileSkills', userId] });
      toast.success('Skill added');
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
    setSelectedType('');
    setSelectedSkill('');
    setVisibility('PUBLIC');
  };

  const handleAddSkill = () => {
    if (!selectedType || !selectedSkill) {
      toast.error('Please select category and skill');
      return;
    }

    addSkillMutation.mutate({
      user_id: userId,
      role_scope: roleType,
      skill_type: selectedType,
      skill_value: selectedSkill,
      visibility
    });
  };

  const taxonomy = SKILL_TAXONOMY[roleType] || {};
  
  // Filter positioning for gay/bi males only
  const availableSkillTypes = Object.entries(taxonomy).filter(([type, config]) => {
    if (type === 'PERFORMANCE_POSITIONING' && config.conditional === 'gay_bi_male') {
      return creatorOrientation === 'gay' || creatorOrientation === 'bisexual';
    }
    return true;
  });

  const groupedSkills = skills.reduce((acc, skill) => {
    const type = skill.skill_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(skill);
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
          <p className="text-sm text-[#9AA6BC]">No skills added. Add your skills to improve AI match suggestions.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSkills).map(([type, typeSkills]) => {
              const config = taxonomy[type];
              return (
                <div key={type}>
                  <p className="text-xs text-[#6B7A94] font-medium mb-2">{config?.label || type}</p>
                  <div className="flex flex-wrap gap-2">
                    {typeSkills.map(skill => (
                      <div key={skill.id} className="group relative">
                        <CCBadge variant={skill.verified ? 'success' : 'default'} icon={skill.verified ? CheckCircle : null}>
                          {skill.skill_value}
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

      <CCModal isOpen={addModalOpen} onClose={resetForm} title="Add Skill">
        <div className="space-y-4">
          <CCSelect
            label="Skill Category"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedSkill('');
            }}
            options={[
              { value: '', label: 'Select category...' },
              ...availableSkillTypes.map(([type, config]) => ({ value: type, label: config.label }))
            ]}
          />

          {selectedType && (
            <div>
              <label className="block text-sm text-[#E8EEF9] mb-2">{taxonomy[selectedType]?.label}</label>
              <select
                value={selectedSkill}
                onChange={(e) => setSelectedSkill(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              >
                <option value="">Select skill...</option>
                {taxonomy[selectedType]?.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          <CCSelect
            label="Visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            options={[
              { value: 'PUBLIC', label: 'Public' },
              { value: 'VERIFIED_ONLY', label: 'Verified Members Only' },
              { value: 'COLLABORATION_ONLY', label: 'Collaboration Rooms Only' },
              { value: 'PRIVATE', label: 'Private' }
            ]}
          />

          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={resetForm}>Cancel</CCButton>
            <CCButton variant="primary" onClick={handleAddSkill} loading={addSkillMutation.isPending}>
              Add Skill
            </CCButton>
          </div>
        </div>
      </CCModal>
    </CCCard>
  );
}