import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, TrendingUp, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AIRiskPrediction({ collaborationId, currentUser }) {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: predictions = [] } = useQuery({
    queryKey: ['aiRiskPredictions', collaborationId],
    queryFn: () => base44.entities.AIRiskPrediction.filter({ collaboration_id: collaborationId }, '-generated_at'),
    enabled: !!collaborationId,
  });

  const { data: collaboration } = useQuery({
    queryKey: ['collaboration', collaborationId],
    queryFn: async () => {
      const collabs = await base44.entities.Collaboration.filter({ id: collaborationId });
      return collabs[0];
    },
    enabled: !!collaborationId,
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['historicalDisputes'],
    queryFn: () => base44.entities.CollaborationDispute.list('-created_date', 100),
  });

  const { data: revocations = [] } = useQuery({
    queryKey: ['historicalRevocations'],
    queryFn: () => base44.entities.ConsentRevocation.list('-created_date', 100),
  });

  const generatePredictionMutation = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      
      try {
        // Use LLM to analyze risk
        const prompt = `Analyze the following collaboration for potential risks:

Collaboration Details:
- Status: ${collaboration?.status}
- Participants: ${collaboration?.participant_ids?.length}
- Scene Type: ${collaboration?.scene_type}
- Acts: ${collaboration?.acts_selected?.join(', ')}
- Created by: ${collaboration?.created_by_role}
- Agent-created: ${collaboration?.created_by_role === 'agent'}

Historical Context:
- Total disputes in platform: ${disputes.length}
- Total consent revocations: ${revocations.length}

Predict the risk level (Low/Medium/High) and provide:
1. Risk level
2. Key risk factors
3. Confidence score (0-1)
4. Explanation`;

        const result = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              risk_level: { type: 'string', enum: ['Low', 'Medium', 'High'] },
              factors: {
                type: 'array',
                items: { type: 'string' }
              },
              confidence: { type: 'number' },
              explanation: { type: 'string' }
            }
          }
        });

        const prediction = await base44.entities.AIRiskPrediction.create({
          collaboration_id: collaborationId,
          predicted_risk_level: result.risk_level,
          factors_json: { factors: result.factors },
          confidence_score: result.confidence,
          explanation: result.explanation,
          model_version: 'gpt-4o',
          generated_at: new Date().toISOString(),
          referenced_by_admin: false
        });

        return prediction;
      } finally {
        setGenerating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiRiskPredictions'] });
      toast.success('AI risk prediction generated');
    },
    onError: () => {
      setGenerating(false);
      toast.error('Prediction failed');
    }
  });

  const markReferencedMutation = useMutation({
    mutationFn: (id) => base44.entities.AIRiskPrediction.update(id, { 
      referenced_by_admin: true 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiRiskPredictions'] });
    }
  });

  const latestPrediction = predictions[0];

  return (
    <CCCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#FF2DAA]" />
          <h3 className="text-lg font-semibold text-[#E8EEF9]">AI Risk Prediction</h3>
          <CCBadge variant="accent" size="sm">Advisory Only</CCBadge>
        </div>
        <CCButton
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={() => generatePredictionMutation.mutate()}
          loading={generating}
        >
          Generate
        </CCButton>
      </div>

      {!latestPrediction ? (
        <div className="text-center py-6">
          <Sparkles className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-sm text-[#9AA6BC] mb-3">No AI prediction generated yet</p>
          <CCButton
            variant="primary"
            size="sm"
            icon={Sparkles}
            onClick={() => generatePredictionMutation.mutate()}
            loading={generating}
          >
            Generate AI Prediction
          </CCButton>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <CCBadge 
              variant={
                latestPrediction.predicted_risk_level === 'High' ? 'danger' :
                latestPrediction.predicted_risk_level === 'Medium' ? 'warning' :
                'success'
              } 
              size="lg"
            >
              {latestPrediction.predicted_risk_level} Risk Predicted
            </CCBadge>
            <div className="text-xs text-[#6B7A94]">
              Confidence: {(latestPrediction.confidence_score * 100).toFixed(0)}%
            </div>
          </div>

          {latestPrediction.explanation && (
            <div className="bg-[#151D2B] rounded-lg p-3">
              <p className="text-sm text-[#E8EEF9]">{latestPrediction.explanation}</p>
            </div>
          )}

          {latestPrediction.factors_json?.factors && (
            <div>
              <p className="text-xs text-[#6B7A94] mb-2">Identified Factors:</p>
              <div className="space-y-1">
                {latestPrediction.factors_json.factors.map((factor, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#9AA6BC]">
                    <div className="w-1 h-1 rounded-full bg-[#4F8CFF]" />
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-[#4F8CFF] mt-0.5" />
              <div>
                <p className="text-xs text-[#4F8CFF] font-medium">Advisory Only</p>
                <p className="text-xs text-[#9AA6BC] mt-1">
                  AI predictions assist admin review but do not trigger automated enforcement. Generated {format(new Date(latestPrediction.generated_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          </div>

          {!latestPrediction.referenced_by_admin && (
            <CCButton
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => markReferencedMutation.mutate(latestPrediction.id)}
            >
              Mark as Reviewed
            </CCButton>
          )}
        </div>
      )}
    </CCCard>
  );
}