import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, RefreshCw } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCCard from '@/components/ui-custom/CCCard';
import { toast } from 'sonner';

export default function BioGenerator({ onSelectBio, currentBio }) {
  const [generating, setGenerating] = useState(false);
  const [inputs, setInputs] = useState({
    roleType: 'creator',
    collaborationTypes: '',
    personalityTraits: '',
    specialties: '',
  });
  const [suggestions, setSuggestions] = useState([]);

  const generateBio = async () => {
    if (!inputs.roleType) {
      toast.error('Please select your role type');
      return;
    }

    setGenerating(true);
    try {
      const prompt = `Generate 3 compelling, professional profile bio/description variations for an adult content ${inputs.roleType}.

User Details:
- Role: ${inputs.roleType}
${inputs.collaborationTypes ? `- Looking for: ${inputs.collaborationTypes}` : ''}
${inputs.personalityTraits ? `- Personality: ${inputs.personalityTraits}` : ''}
${inputs.specialties ? `- Specialties: ${inputs.specialties}` : ''}

Requirements:
- Professional yet approachable tone
- 2-3 sentences each
- Highlight unique value and collaboration interests
- Be authentic and engaging
- Each variation should have a different style (professional, friendly, creative)

Return as JSON array of objects with "style" and "text" fields.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            bios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  style: { type: 'string' },
                  text: { type: 'string' }
                }
              }
            }
          }
        }
      });

      setSuggestions(result.bios || []);
      toast.success('Bio suggestions generated!');
    } catch (error) {
      toast.error('Failed to generate bio suggestions');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <CCCard className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#FF2DAA]" />
        <h3 className="text-lg font-semibold text-[#E8EEF9]">AI Bio Generator</h3>
      </div>

      <div className="space-y-3 mb-4">
        <CCSelect
          label="Role Type"
          value={inputs.roleType}
          onChange={(e) => setInputs({ ...inputs, roleType: e.target.value })}
          required
        >
          <option value="creator">Creator</option>
          <option value="photographer">Photographer</option>
          <option value="videographer">Videographer</option>
          <option value="agent">Agent</option>
          <option value="studio">Studio</option>
        </CCSelect>

        <CCInput
          label="Collaboration Types"
          placeholder="e.g., B/G, G/G, solo, fetish content"
          value={inputs.collaborationTypes}
          onChange={(e) => setInputs({ ...inputs, collaborationTypes: e.target.value })}
          hint="What types of collaborations are you interested in?"
        />

        <CCInput
          label="Personality Traits"
          placeholder="e.g., professional, creative, adventurous"
          value={inputs.personalityTraits}
          onChange={(e) => setInputs({ ...inputs, personalityTraits: e.target.value })}
          hint="Describe your personality or working style"
        />

        <CCInput
          label="Specialties"
          placeholder="e.g., high-energy scenes, artistic photography"
          value={inputs.specialties}
          onChange={(e) => setInputs({ ...inputs, specialties: e.target.value })}
          hint="What makes you unique?"
        />
      </div>

      <CCButton
        variant="primary"
        icon={generating ? RefreshCw : Sparkles}
        loading={generating}
        onClick={generateBio}
        fullWidth
      >
        Generate Bio Suggestions
      </CCButton>

      {suggestions.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-[#9AA6BC]">Select a bio:</p>
          {suggestions.map((bio, idx) => (
            <div
              key={idx}
              className="bg-[#0B0F14] border border-[#263248] rounded-lg p-3 hover:border-[#4F8CFF] transition-all cursor-pointer"
              onClick={() => onSelectBio(bio.text)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#4F8CFF] uppercase">{bio.style}</span>
                <CCButton variant="ghost" size="sm" onClick={() => onSelectBio(bio.text)}>
                  Use This
                </CCButton>
              </div>
              <p className="text-sm text-[#E8EEF9]">{bio.text}</p>
            </div>
          ))}
        </div>
      )}
    </CCCard>
  );
}