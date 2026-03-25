/**
 * EarningsAdminPanel
 *
 * Admin-only view:
 * - Inspect all EarningsRecords across users
 * - Trigger manual backfill for a collaboration
 * - View audit trail via ContractAuditLog
 * - Force settlement status changes
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  DollarSign, RefreshCw, CheckCircle, AlertTriangle, Clock, Search, Zap
} from 'lucide-react';
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

export default function EarningsAdminPanel() {
  const [searchUser, setSearchUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [backfillCollabId, setBackfillCollabId] = useState('');
  const queryClient = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['adminAllEarningsRecords'],
    queryFn: () => base44.entities.EarningsRecord.list('-created_date', 200),
  });

  const { data: collabs = [] } = useQuery({
    queryKey: ['adminCollabsForEarnings'],
    queryFn: () => base44.entities.Collaboration.filter({ status: 'completed' }),
  });

  const backfillMutation = useMutation({
    mutationFn: (collabId) =>
      base44.functions.invoke('autoCreateEarnings', {
        collaboration_id: collabId,
        admin_override: true,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminAllEarningsRecords'] });
      const n = res?.data?.records_created?.length || 0;
      const s = res?.data?.records_skipped?.length || 0;
      toast.success(`Created: ${n}, Skipped (already exist): ${s}`);
      setBackfillCollabId('');
    },
    onError: (e) => toast.error(e.message),
  });

  const settleAllMutation = useMutation({
    mutationFn: (id) =>
      base44.functions.invoke('updateEarningsSettlement', {
        record_id: id,
        new_status: 'settled',
        admin_override: true,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminAllEarningsRecords'] }),
    onError: (e) => toast.error(e.message),
  });

  // Backfill all completed collabs at once
  const backfillAllMutation = useMutation({
    mutationFn: async () => {
      let total = 0;
      for (const c of collabs) {
        const res = await base44.functions.invoke('autoCreateEarnings', {
          collaboration_id: c.id,
          admin_override: true,
        });
        total += res?.data?.records_created?.length || 0;
      }
      return total;
    },
    onSuccess: (total) => {
      queryClient.invalidateQueries({ queryKey: ['adminAllEarningsRecords'] });
      toast.success(`Backfill complete — ${total} record(s) created`);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = records.filter(r => {
    const statusOk = filterStatus === 'all' || r.settlement_status === filterStatus;
    const userOk = !searchUser || r.user_id.toLowerCase().includes(searchUser.toLowerCase());
    return statusOk && userOk;
  });

  const totalByStatus = {
    projected: records.filter(r => r.settlement_status === 'projected').reduce((s, r) => s + (r.net_amount || 0), 0),
    pending_settlement: records.filter(r => r.settlement_status === 'pending_settlement').reduce((s, r) => s + (r.net_amount || 0), 0),
    settled: records.filter(r => r.settlement_status === 'settled').reduce((s, r) => s + (r.net_amount || 0), 0),
    disputed: records.filter(r => r.settlement_status === 'disputed').reduce((s, r) => s + (r.net_amount || 0), 0),
  };

  // Completed collabs with no earnings records
  const collabsNeedingBackfill = collabs.filter(c =>
    !records.some(r => r.collaboration_id === c.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#E8EEF9] mb-1">Earnings Administration</h2>
        <p className="text-sm text-[#6B7A94]">
          Inspect all earnings records, trigger backfill for completed collaborations, and manage settlement status.
        </p>
      </div>

      {/* Platform totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(totalByStatus).map(([status, amount]) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <CCCard key={status} padding="md">
              <p className="text-lg font-bold text-[#E8EEF9]">{fmt(amount)}</p>
              <CCBadge variant={cfg.variant} size="sm" className="mt-1">{cfg.label}</CCBadge>
            </CCCard>
          );
        })}
      </div>

      {/* Backfill zone */}
      {collabsNeedingBackfill.length > 0 && (
        <CCCard padding="md" className="border-[#F59E0B]/30 bg-[#F59E0B]/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#F59E0B]" />
              <p className="text-sm text-[#F59E0B]">
                {collabsNeedingBackfill.length} completed collaboration(s) have no earnings records.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex gap-2">
                <input
                  className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-1.5 text-xs text-[#E8EEF9] w-48 focus:outline-none"
                  placeholder="Paste collaboration ID…"
                  value={backfillCollabId}
                  onChange={e => setBackfillCollabId(e.target.value)}
                />
                <CCButton size="sm" variant="warning" icon={RefreshCw}
                  loading={backfillMutation.isPending}
                  disabled={!backfillCollabId}
                  onClick={() => backfillMutation.mutate(backfillCollabId)}>
                  Backfill One
                </CCButton>
              </div>
              <CCButton size="sm" variant="warning" icon={RefreshCw}
                loading={backfillAllMutation.isPending}
                onClick={() => backfillAllMutation.mutate()}>
                Backfill All ({collabsNeedingBackfill.length})
              </CCButton>
            </div>
          </div>
        </CCCard>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7A94]" />
          <input
            className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-9 pr-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none"
            placeholder="Filter by user ID…"
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'projected', 'pending_settlement', 'settled', 'disputed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterStatus === s ? 'bg-[#4F8CFF] text-white' : 'bg-[#151D2B] text-[#6B7A94]'
              }`}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
              <span className="ml-1 opacity-60">
                ({s === 'all' ? records.length : records.filter(r => r.settlement_status === s).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Records table */}
      {isLoading ? (
        <p className="text-center text-[#6B7A94] text-sm py-8">Loading…</p>
      ) : filtered.length === 0 ? (
        <CCCard padding="lg">
          <div className="text-center py-8">
            <DollarSign className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No records found</p>
          </div>
        </CCCard>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map(record => {
            const collab = collabs.find(c => c.id === record.collaboration_id);
            const cfg = STATUS_CONFIG[record.settlement_status] || STATUS_CONFIG.projected;
            const isAuto = record.notes?.includes('Auto-created');
            return (
              <CCCard key={record.id} padding="md">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-[#E8EEF9] truncate">
                        {record.user_id}
                      </span>
                      <CCBadge variant={record.type === 'commission_received' ? 'accent' : 'primary'} size="sm">
                        {record.type}
                      </CCBadge>
                      {isAuto && <CCBadge variant="default" size="sm"><Zap className="w-2.5 h-2.5 mr-0.5 inline" />Auto</CCBadge>}
                    </div>
                    <p className="text-xs text-[#6B7A94]">
                      {collab?.collaboration_name || record.collaboration_id?.slice(0, 10)}
                      {record.split_percentage != null && ` · ${record.split_percentage}%`}
                      {record.agent_commission_rate != null && ` · ${record.agent_commission_rate}% agent`}
                      {record.studio_split_rate != null && ` · ${record.studio_split_rate}% studio`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#E8EEF9]">{fmt(record.net_amount)}</p>
                      {record.gross_amount && record.gross_amount !== record.net_amount && (
                        <p className="text-xs text-[#6B7A94]">of {fmt(record.gross_amount)}</p>
                      )}
                    </div>
                    <CCBadge variant={cfg.variant} size="sm">{cfg.label}</CCBadge>
                    {record.settlement_status === 'pending_settlement' && (
                      <CCButton size="sm" variant="success"
                        onClick={() => settleAllMutation.mutate(record.id)}
                        loading={settleAllMutation.isPending}>
                        Settle
                      </CCButton>
                    )}
                  </div>
                </div>
              </CCCard>
            );
          })}
        </div>
      )}
    </div>
  );
}