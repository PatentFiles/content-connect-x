import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import CCButton from '@/components/ui-custom/CCButton';
import { Sparkles, Copy, Check } from 'lucide-react';

export default function BioGenerator({ profile, details, onSelectBio }) {
    const [generating, setGenerating] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [copiedIndex, setCopiedIndex] = useState(null);
    
    const generateBio = async () => {
        setGenerating(true);
        setSuggestions([]);
        
        try {
            const prompt = `You are a professional bio writer specializing in adult content creator profiles.

Create 3 different professional, engaging bio options for this creator profile:
- Display Name: ${profile?.display_name || 'not specified'}
- Age: ${profile?.age || 'not specified'}
- Ethnicity: ${profile?.ethnicity || 'not specified'}
- Gender: ${details?.gender_identity?.replace('_', ' ') || 'not specified'}
- Sexual Orientation: ${details?.orientation_category?.replace('_', ' ') || 'not specified'}
- Collaboration Types: ${details?.collab_types?.join(', ') || 'not specified'}
- Personality/Specialties: ${details?.tags?.join(', ') || 'not specified'}
- Location: ${profile?.base_location?.city ? `${profile.base_location.city}, ${profile.base_location.state || ''}` : 'not specified'}

Requirements:
- Each bio should be 2-3 sentences
- Professional but authentic tone
- Highlight what makes them unique
- Include collaboration preferences naturally
- Avoid generic clichés
- Be engaging and memorable
- Keep it concise and impactful

Return ONLY a JSON object with this structure:
{
    "suggestions": [
        "First bio option here...",
        "Second bio option here...",
        "Third bio option here..."
    ]
}`;

            const response = await base44.integrations.Core.InvokeLLM({
                prompt: prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        suggestions: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                }
            });
            
            setSuggestions(response.suggestions || []);
        } catch (error) {
            console.error('Error generating bio:', error);
        } finally {
            setGenerating(false);
        }
    };
    
    const copyToClipboard = async (text, index) => {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="border border-[#263248] rounded-xl p-4 bg-[#121824]">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#4F8CFF]" />
                    <h4 className="text-sm font-semibold text-[#E8EEF9]">AI Bio Generator</h4>
                </div>
                <CCButton
                    variant="primary"
                    icon={Sparkles}
                    onClick={generateBio}
                    loading={generating}
                    size="sm"
                >
                    Generate
                </CCButton>
            </div>
            
            {suggestions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-[#9AA6BC] mb-2">Choose a bio:</p>
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={index}
                            className="p-3 bg-[#0B0F14] border border-[#263248] rounded-lg hover:border-[#4F8CFF]/50 transition-colors"
                        >
                            <p className="text-sm text-[#E8EEF9] mb-2">{suggestion}</p>
                            <div className="flex gap-2">
                                <CCButton
                                    variant="primary"
                                    size="sm"
                                    onClick={() => onSelectBio(suggestion)}
                                >
                                    Use This Bio
                                </CCButton>
                                <CCButton
                                    variant="ghost"
                                    size="sm"
                                    icon={copiedIndex === index ? Check : Copy}
                                    onClick={() => copyToClipboard(suggestion, index)}
                                >
                                    {copiedIndex === index ? 'Copied!' : 'Copy'}
                                </CCButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}