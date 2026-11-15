import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';

export function calculateRiskScore(collaboration, verifications, disputes, confirmations) {
  let score = 0;
  const factors = {};

  // Unverified participants (+20 per unverified)
  const unverifiedCount = collaboration.participant_ids?.filter(id => {
    const verification = verifications.find(v => v.user_id === id);
    return !verification || verification.status !== 'approved';
  }).length || 0;
  
  if (unverifiedCount > 0) {
    const penalty = unverifiedCount * 20;
    score += penalty;
    factors.unverified_participants = { count: unverifiedCount, penalty };
  }

  // Recent verification lapses (+15)
  const hasExpiredVerifications = collaboration.participant_ids?.some(id => {
    const verification = verifications.find(v => v.user_id === id);
    if (!verification?.expires_at) return false;
    return new Date(verification.expires_at) < new Date();
  });
  
  if (hasExpiredVerifications) {
    score += 15;
    factors.expired_verifications = { penalty: 15 };
  }

  // High-risk acts (+10)
  const highRiskActs = ['Gangbang', 'DP', 'DVP', 'DAP', 'Impact Play', 'Wax Play'];
  const hasHighRiskActs = collaboration.acts_selected?.some(act => 
    highRiskActs.some(risk => act.includes(risk))
  );
  
  if (hasHighRiskActs) {
    score += 10;
    factors.high_risk_acts = { penalty: 10 };
  }

  // History of disputes (+25 per open dispute)
  const collabDisputes = disputes.filter(d => 
    d.collaboration_id === collaboration.id && 
    ['Open', 'Under Review'].includes(d.status)
  );
  
  if (collabDisputes.length > 0) {
    const penalty = collabDisputes.length * 25;
    score += penalty;
    factors.active_disputes = { count: collabDisputes.length, penalty };
  }

  // Agent-created with unrepresented creators (+10)
  if (collaboration.created_by_role === 'agent') {
    score += 10;
    factors.agent_created = { penalty: 10 };
  }

  // Missing confirmations after completion (+20)
  if (collaboration.status === 'completed') {
    const requiredConfirmations = collaboration.participant_ids?.length || 0;
    const receivedConfirmations = confirmations.filter(c => 
      c.collaboration_id === collaboration.id
    ).length;
    
    if (receivedConfirmations < requiredConfirmations) {
      score += 20;
      factors.missing_confirmations = { 
        required: requiredConfirmations, 
        received: receivedConfirmations, 
        penalty: 20 
      };
    }
  }

  // Cap at 100
  score = Math.min(100, score);

  const risk_tier = score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low';

  return { score, risk_tier, factors };
}

export default function RiskScoringDisplay({ collaborationId }) {
  const { data: collaboration } = useQuery({
    queryKey: ['collaboration', collaborationId],
    queryFn: async () => {
      const collabs = await base44.entities.Collaboration.filter({ id: collaborationId });
      return collabs[0];
    },
    enabled: !!collaborationId,
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list(),
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['collaborationDisputes', collaborationId],
    queryFn: () => base44.entities.CollaborationDispute.filter({ collaboration_id: collaborationId }),
    enabled: !!collaborationId,
  });

  const { data: confirmations = [] } = useQuery({
    queryKey: ['confirmations', collaborationId],
    queryFn: () => base44.entities.CollaborationConfirmation.filter({ collaboration_id: collaborationId }),
    enabled: !!collaborationId,
  });

  if (!collaboration) return null;

  const riskData = calculateRiskScore(collaboration, verifications, disputes, confirmations);

  const tierColors = {
    'Low': 'success',
    'Medium': 'warning',
    'High': 'danger'
  };

  return (
    <CCCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${
            riskData.risk_tier === 'High' ? 'text-[#EF4444]' :
            riskData.risk_tier === 'Medium' ? 'text-[#F59E0B]' :
            'text-[#22C55E]'
          }`} />
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Risk Assessment</h3>
        </div>
        <CCBadge variant={tierColors[riskData.risk_tier]} size="lg">
          {riskData.risk_tier} Risk - {riskData.score}/100
        </CCBadge>
      </div>

      {Object.keys(riskData.factors).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[#6B7A94] mb-2">Risk Factors:</p>
          {Object.entries(riskData.factors).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between bg-[#151D2B] rounded-lg px-3 py-2">
              <span className="text-sm text-[#E8EEF9] capitalize">{key.replace(/_/g, ' ')}</span>
              <CCBadge variant="danger" size="sm">+{value.penalty}</CCBadge>
            </div>
          ))}
        </div>
      )}

      {riskData.risk_tier === 'High' && (
        <div className="mt-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
          <p className="text-xs text-[#EF4444] font-medium">⚠️ High Risk Alert</p>
          <p className="text-xs text-[#9AA6BC] mt-1">
            This collaboration requires additional admin review before proceeding.
          </p>
        </div>
      )}
    </CCCard>
  );
}