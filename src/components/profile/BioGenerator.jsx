import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BioGenerator({ onSelectBio, currentBio }) {
  const [generating, setGenerating] = useState(false);
  const [inputs, setInputs] = useState({
    roleType: 'creator',
    sexuality: '',
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
${inputs.sexuality ? `- Sexuality: ${inputs.sexuality}` : ''}
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
    <div className="bg-[#151D2B] border border-[#263248] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#FF2DAA]" />
        <h3 className="text-lg font-semibold text-[#E8EEF9]">AI Bio Generator</h3>
      </div>

      <div className="space-y-3 mb-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#E8EEF9]">
            Role Type<span className="text-[#FF2DAA] ml-1">*</span>
          </label>
          <select
            value={inputs.roleType}
            onChange={(e) => setInputs({ ...inputs, roleType: e.target.value })}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
          >
            <option value="creator">Creator</option>
            <option value="photographer">Photographer</option>
            <option value="videographer">Videographer</option>
            <option value="agent">Agent</option>
            <option value="studio">Studio</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#E8EEF9]">Sexuality</label>
          <select
            value={inputs.sexuality}
            onChange={(e) => setInputs({ ...inputs, sexuality: e.target.value })}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
          >
            <option value="">Select sexuality...</option>
            <option value="straight">Straight</option>
            <option value="gay">Gay</option>
            <option value="lesbian">Lesbian</option>
            <option value="bisexual">Bisexual</option>
            <option value="pansexual">Pansexual</option>
            <option value="fluid">Fluid</option>
          </select>
          <p className="text-xs text-[#6B7A94]">Your sexual orientation</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#E8EEF9]">Collaboration Types</label>
          <input
            type="text"
            placeholder="e.g., B/G, G/G, solo, fetish content"
            value={inputs.collaborationTypes}
            onChange={(e) => setInputs({ ...inputs, collaborationTypes: e.target.value })}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
          />
          <p className="text-xs text-[#6B7A94]">What types of collaborations are you interested in?</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#E8EEF9]">Personality Traits</label>
          <input
            type="text"
            placeholder="e.g., professional, creative, adventurous"
            value={inputs.personalityTraits}
            onChange={(e) => setInputs({ ...inputs, personalityTraits: e.target.value })}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
          />
          <p className="text-xs text-[#6B7A94]">Describe your personality or working style</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#E8EEF9]">Specialties</label>
          <input
            type="text"
            placeholder="e.g., high-energy scenes, artistic photography"
            value={inputs.specialties}
            onChange={(e) => setInputs({ ...inputs, specialties: e.target.value })}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
          />
          <p className="text-xs text-[#6B7A94]">What makes you unique?</p>
        </div>
      </div>

      <button
        onClick={generateBio}
        disabled={generating}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 px-4 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:ring-offset-2 focus:ring-offset-[#0B0F14]',
          'bg-[#4F8CFF] hover:bg-[#3A7AEE] text-white shadow-lg hover:shadow-[0_0_20px_rgba(79,140,255,0.3)]',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Bio Suggestions
          </>
        )}
      </button>

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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBio(bio.text);
                  }}
                  className="px-3 py-1 text-xs bg-transparent hover:bg-[#151D2B] text-[#9AA6BC] hover:text-[#E8EEF9] rounded-lg transition-all"
                >
                  Use This
                </button>
              </div>
              <p className="text-sm text-[#E8EEF9]">{bio.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}