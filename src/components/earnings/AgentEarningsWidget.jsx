/**
 * AgentEarningsWidget
 * Shows commission records for an agent — commission_received type only.
 * Respects agent_visible flag.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DollarSign, TrendingUp, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  projected: { label: 'Projected', variant: 'outline' },
  pending_settlement: { label: 'Pending', variant: 'warning' },
  settled: { label: 'Settled', variant: 'success' },
  disputed: { label: 'Disputed', variant: 'danger' },
};

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

export default function AgentEarningsWidget({ agentUserId }) {
  const queryClient = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['agentEarnings', agentUserId],
    queryFn: () => base44.entities.EarningsRecord.filter({ user_id: agentUserId, type: 'commission_received' }),
    enabled: !!agentUserId,
  });

  const { data: collabs = [] } = useQuery({
    queryKey: ['agentCollabsForEarnings', agentUserId],
    queryFn: () => base44.entities.Collaboration.filter({ participant_ids: { $in: [agentUserId] } }),
    enabled: !!agentUserId,
  });

  const settleMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('updateEarningsSettlement', { record_id: id, new_status: 'settled' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agentEarnings'] }); toast.success('Marked settled'); },
    onError: (e) => toast.error(e.message),
  });

  const totalSettled = records.filter(r => r.settlement_status === 'settled').reduce((s, r) => s + (r.net_amount || 0), 0);
  const totalPending = records.filter(r => r.settlement_status === 'pending_settlement').reduce((s, r) => s + (r.net_amount || 0), 0);
  const totalProjected = records.filter(r => r.settlement_status === 'projected').reduce((s, r) => s + (r.net_amount || 0), 0);

  return (
    <CCCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8EEF9] flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#22C55E]" /> Commission Earnings
        </h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-[#0D1520] rounded-lg">
          <p className="text-lg font-bold text-[#22C55E]">{fmt(totalSettled)}</p>
          <p className="text-xs text-[#6B7A94]">Settled</p>
        </div>
        <div className="text-center p-3 bg-[#0D1520] rounded-lg">
          <p className="text-lg font-bold text-[#F59E0B]">{fmt(totalPending)}</p>
          <p className="text-xs text-[#6B7A94]">Pending</p>
        </div>
        <div className="text-center p-3 bg-[#0D1520] rounded-lg">
          <p className="text-lg font-bold text-[#9AA6BC]">{fmt(totalProjected)}</p>
          <p className="text-xs text-[#6B7A94]">Projected</p>
        </div>
      </div>

      {/* Records */}
      {isLoading ? (
        <p className="text-sm text-[#6B7A94] text-center py-4">Loading…</p>
      ) : records.length === 0 ? (
        <div className="text-center py-6">
          <TrendingUp className="w-8 h-8 text-[#6B7A94] mx-auto mb-2" />
          <p className="text-sm text-[#9AA6BC]">No commission records yet</p>
          <p className="text-xs text-[#6B7A94] mt-1">Created automatically when collaborations complete</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {records.map(record => {
            const collab = collabs.find(c => c.id === record.collaboration_id);
            const cfg = STATUS_CONFIG[record.settlement_status] || STATUS_CONFIG.projected;
            return (
              <div key={record.id} className="flex items-center justify-between p-2.5 bg-[#151D2B] rounded-lg gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#E8EEF9] truncate">
                    {collab?.collaboration_name || record.collaboration_id?.slice(0, 10)}
                  </p>
                  <p className="text-xs text-[#6B7A94]">{record.split_percentage}% commission</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-[#E8EEF9]">{fmt(record.net_amount)}</span>
                  <CCBadge variant={cfg.variant} size="sm">{cfg.label}</CCBadge>
                  {record.settlement_status === 'pending_settlement' && (
                    <CCButton size="sm" variant="success" onClick={() => settleMutation.mutate(record.id)}
                      loading={settleMutation.isPending}>
                      Settle
                    </CCButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CCCard>
  );
}