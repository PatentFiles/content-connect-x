import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Eye, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCAvatarGroup } from '@/components/ui-custom/CCAvatars';

export default function MatchSuggestions({ sourceType, sourceId, title = "AI Match Suggestions" }) {
  const [expandedSuggestion, setExpandedSuggestion] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['matchSuggestions', sourceType, sourceId],
    queryFn: async () => {
      const allSuggestions = await base44.entities.AIMatchSuggestion.filter({
        source_type: sourceType,
        source_id: sourceId,
        status: 'pending'
      });
      return allSuggestions.filter(s => {
        if (!s.expires_at) return true;
        return new Date(s.expires_at) > new Date();
      });
    },
    enabled: !!sourceId
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['suggestionProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: suggestions.length > 0
  });

  const markViewedMutation = useMutation({
    mutationFn: (suggestionId) => 
      base44.entities.AIMatchSuggestion.update(suggestionId, { 
        viewed: true, 
        viewed_at: new Date().toISOString() 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchSuggestions', sourceType, sourceId] });
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (suggestionId) => 
      base44.entities.AIMatchSuggestion.update(suggestionId, { status: 'dismissed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matchSuggestions', sourceType, sourceId] });
      queryClient.invalidateQueries({ queryKey: ['matchSuggestionsCount'] });
    }
  });

  const generateMatches = async () => {
    setIsGenerating(true);
    try {
      await base44.functions.invoke('generateMatches', {
        source_type: sourceType,
        source_id: sourceId,
        limit: 10
      });
      queryClient.invalidateQueries({ queryKey: ['matchSuggestions', sourceType, sourceId] });
      queryClient.invalidateQueries({ queryKey: ['matchSuggestionsCount'] });
    } catch (error) {
      console.error('Failed to generate matches:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewSuggestion = (suggestion) => {
    if (!suggestion.viewed) {
      markViewedMutation.mutate(suggestion.id);
    }
    setExpandedSuggestion(expandedSuggestion === suggestion.id ? null : suggestion.id);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-[#22C55E]';
    if (score >= 60) return 'text-[#4F8CFF]';
    if (score >= 40) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  };

  return (
    <CCCard>
      <CCCardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#4F8CFF]" />
            <CCCardTitle>{title}</CCCardTitle>
          </div>
          <CCButton 
            variant="primary" 
            size="sm" 
            onClick={generateMatches}
            loading={isGenerating}
            icon={Sparkles}
          >
            Generate Matches
          </CCButton>
        </div>
      </CCCardHeader>
      <CCCardContent>
        {isLoading ? (
          <p className="text-sm text-[#9AA6BC]">Loading suggestions...</p>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-[#6B7A94] mx-auto mb-3 opacity-50" />
            <p className="text-sm text-[#9AA6BC] mb-3">No AI suggestions yet</p>
            <p className="text-xs text-[#6B7A94] mb-4">Generate personalized match suggestions based on your profile and preferences</p>
            <CCButton variant="outline" size="sm" onClick={generateMatches} loading={isGenerating}>
              Generate Suggestions
            </CCButton>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map(suggestion => {
              const targetProfile = suggestion.target_type === 'user' 
                ? profiles.find(p => p.user_id === suggestion.target_id)
                : null;
              
              const isExpanded = expandedSuggestion === suggestion.id;

              return (
                <div 
                  key={suggestion.id}
                  className="border border-[#263248] rounded-lg p-3 hover:bg-[#121824] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-[#E8EEF9]">
                          {targetProfile?.display_name || suggestion.target_id}
                        </p>
                        <CCBadge 
                          variant={suggestion.match_score >= 70 ? 'success' : 'primary'}
                          className={getScoreColor(suggestion.match_score)}
                        >
                          {suggestion.match_score}% Match
                        </CCBadge>
                        {suggestion.requires_review && (
                          <CCBadge variant="warning" icon={AlertTriangle} size="sm">
                            Needs Review
                          </CCBadge>
                        )}
                      </div>
                      <p className="text-xs text-[#9AA6BC] mb-2">{suggestion.explanation}</p>
                      
                      {suggestion.risk_flags?.length > 0 && (
                        <div className="flex gap-1 mb-2">
                          {suggestion.risk_flags.map((flag, idx) => (
                            <CCBadge key={idx} variant="danger" size="sm" icon={AlertTriangle}>
                              {flag}
                            </CCBadge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <CCButton
                        variant="ghost"
                        size="sm"
                        icon={isExpanded ? ChevronUp : ChevronDown}
                        onClick={() => handleViewSuggestion(suggestion)}
                      />
                      <CCButton
                        variant="ghost"
                        size="sm"
                        icon={X}
                        onClick={() => dismissMutation.mutate(suggestion.id)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#263248] space-y-2">
                      <p className="text-xs text-[#6B7A94] font-medium">Match Factors:</p>
                      {suggestion.match_factors?.map((factor, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-[#9AA6BC]">{factor.factor}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-[#263248] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#4F8CFF]"
                                style={{ width: `${factor.score}%` }}
                              />
                            </div>
                            <span className="text-[#E8EEF9] w-8 text-right">{factor.score}%</span>
                          </div>
                        </div>
                      ))}
                      
                      {suggestion.requires_review && (
                        <div className="mt-3 p-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded">
                          <p className="text-xs text-[#F59E0B]">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            Review Required: {suggestion.review_reason}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        {suggestion.target_type === 'user' && targetProfile && (
                          <Link to={createPageUrl(`ViewProfile?id=${targetProfile.user_id}`)}>
                            <CCButton variant="primary" size="sm" icon={Eye}>
                              View Profile
                            </CCButton>
                          </Link>
                        )}
                        {suggestion.target_type === 'collaboration' && (
                          <Link to={createPageUrl(`CollaborationDetail?id=${suggestion.target_id}`)}>
                            <CCButton variant="primary" size="sm" icon={Eye}>
                              View Collaboration
                            </CCButton>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CCCardContent>
    </CCCard>
  );
}