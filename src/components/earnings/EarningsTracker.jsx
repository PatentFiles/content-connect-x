/**
 * EarningsTracker — Role-aware, auto-populated earnings view.
 *
 * - Shows auto-created records from collaborations
 * - Supports settlement lifecycle transitions via updateEarningsSettlement
 * - Allows manual record creation as fallback
 * - Role-aware: type labels differ for agents (commission) vs creators/studios
 * - Private — never visible to other users
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  DollarSign, Clock, CheckCircle, AlertTriangle,
  Plus, Zap, RefreshCw, ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  projected: { label: 'Projected', variant: 'outline', icon: Clock },
  pending_settlement: { label: 'Pending', variant: 'warning', icon: Clock },
  settled: { label: 'Settled', variant: 'success', icon: CheckCircle },
  disputed: { label: 'Disputed', variant: 'danger', icon: AlertTriangle },
};

const TYPE_LABELS = {
  confirmed: 'Earnings',
  projected: 'Projected',
  commission_paid: 'Commission Paid',
  commission_received: 'Commission',
};

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

function RecordRow({ record, collab, onSettle, onDispute, onAdvance, isUpdating }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[record.settlement_status] || STATUS_CONFIG.projected;
  const StatusIcon = cfg.icon;

  return (
    <CCCard padding="md" hover className="transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[#E8EEF9] truncate">
              {collab?.collaboration_name || 'Collaboration'}
            </p>
            {record.type === 'commission_received' && (
              <CCBadge variant="accent" size="sm">Commission</CCBadge>
            )}
            {record.notes?.includes('Auto-created') && (
              <CCBadge variant="primary" size="sm"><Zap className="w-2.5 h-2.5 mr-0.5 inline" />Auto</CCBadge>
            )}
          </div>
          <p className="text-xs text-[#6B7A94] mt-0.5">
            {TYPE_LABELS[record.type] || record.type}
            {record.split_percentage != null && ` · ${record.split_percentage}% split`}
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
          <CCBadge variant={cfg.variant} size="sm">
            <StatusIcon className="w-3 h-3 mr-1 inline" />{cfg.label}
          </CCBadge>
          <button onClick={() => setExpanded(!expanded)} className="text-[#6B7A94] hover:text-[#9AA6BC]">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#263248] space-y-2">
          {record.notes && (
            <p className="text-xs text-[#9AA6BC]">{record.notes}</p>
          )}
          {record.settled_at && (
            <p className="text-xs text-[#6B7A94]">
              Settled: {format(new Date(record.settled_at), 'MMM d, yyyy')}
            </p>
          )}
          {record.created_date && (
            <p className="text-xs text-[#6B7A94]">
              Created: {format(new Date(record.created_date), 'MMM d, yyyy')}
            </p>
          )}
          <div className="flex gap-2 flex-wrap mt-2">
            {record.settlement_status === 'projected' && (
              <CCButton size="sm" variant="outline" loading={isUpdating}
                onClick={() => onAdvance(record.id, 'pending_settlement')}>
                Mark Pending
              </CCButton>
            )}
            {record.settlement_status === 'pending_settlement' && (
              <>
                <CCButton size="sm" variant="success" loading={isUpdating}
                  onClick={() => onSettle(record.id)}>
                  Mark Settled
                </CCButton>
                <CCButton size="sm" variant="danger" loading={isUpdating}
                  onClick={() => onDispute(record.id)}>
                  Dispute
                </CCButton>
              </>
            )}
            {record.settlement_status === 'disputed' && (
              <CCButton size="sm" variant="outline" loading={isUpdating}
                onClick={() => onAdvance(record.id, 'pending_settlement')}>
                Re-open
              </CCButton>
            )}
          </div>
        </div>
      )}
    </CCCard>
  );
}

export default function EarningsTracker({ userId, compact = false }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecord, setNewRecord] = useState({
    gross_amount: '', net_amount: '', split_percentage: '', notes: '', settlement_status: 'projected',
  });
  const [selectedCollabId, setSelectedCollabId] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: earningsRecords = [], isLoading } = useQuery({
    queryKey: ['earningsRecords', userId],
    queryFn: () => base44.entities.EarningsRecord.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const { data: collabs = [] } = useQuery({
    queryKey: ['myCollabsForEarnings', userId],
    queryFn: () => base44.entities.Collaboration.filter({ participant_ids: { $in: [userId] } }),
    enabled: !!userId,
  });

  // Manual add mutation (fallback)
  const addMutation = useMutation({
    mutationFn: () => base44.entities.EarningsRecord.create({
      user_id: userId,
      collaboration_id: selectedCollabId,
      type: 'confirmed',
      gross_amount: parseFloat(newRecord.gross_amount) || 0,
      net_amount: parseFloat(newRecord.net_amount) || 0,
      split_percentage: parseFloat(newRecord.split_percentage) || 100,
      notes: newRecord.notes || 'Manually added',
      settlement_status: newRecord.settlement_status,
      currency: 'USD',
      visibility: 'private',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['earningsRecords'] });
      toast.success('Earnings record added');
      setShowAddModal(false);
      setNewRecord({ gross_amount: '', net_amount: '', split_percentage: '', notes: '', settlement_status: 'projected' });
      setSelectedCollabId('');
    },
    onError: (e) => toast.error(e.message || 'Failed to add record'),
  });

  // Settlement transition via backend
  const settleMutation = useMutation({
    mutationFn: ({ id, status, notes }) =>
      base44.functions.invoke('updateEarningsSettlement', { record_id: id, new_status: status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['earningsRecords'] });
      toast.success('Status updated');
      setUpdatingId(null);
    },
    onError: (e) => { toast.error(e.message || 'Update failed'); setUpdatingId(null); },
  });

  // Auto-backfill trigger (for completed collabs without records)
  const backfillMutation = useMutation({
    mutationFn: (collabId) =>
      base44.functions.invoke('autoCreateEarnings', {
        collaboration_id: collabId,
        admin_override: true,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['earningsRecords'] });
      const n = res?.data?.records_created?.length || 0;
      toast.success(n > 0 ? `${n} earnings record(s) created` : 'Already up to date');
    },
    onError: (e) => toast.error(e.message || 'Backfill failed'),
  });

  const handleSettle = (id) => { setUpdatingId(id); settleMutation.mutate({ id, status: 'settled' }); };
  const handleDispute = (id) => { setUpdatingId(id); settleMutation.mutate({ id, status: 'disputed' }); };
  const handleAdvance = (id, status) => { setUpdatingId(id); settleMutation.mutate({ id, status }); };

  // Stats
  const settled = earningsRecords.filter(r => r.settlement_status === 'settled');
  const projected = earningsRecords.filter(r => ['projected', 'pending_settlement'].includes(r.settlement_status));
  const disputed = earningsRecords.filter(r => r.settlement_status === 'disputed');
  const totalSettled = settled.reduce((s, r) => s + (r.net_amount || 0), 0);
  const totalProjected = projected.reduce((s, r) => s + (r.net_amount || 0), 0);

  // Filter
  const filtered = filterStatus === 'all' ? earningsRecords
    : earningsRecords.filter(r => r.settlement_status === filterStatus);

  // Completed collabs missing earnings records
  const completedWithoutRecords = collabs.filter(c =>
    c.status === 'completed' &&
    !earningsRecords.some(r => r.collaboration_id === c.id)
  );

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#0D1520] rounded-lg text-center">
            <p className="text-lg font-bold text-[#22C55E]">{fmt(totalSettled)}</p>
            <p className="text-xs text-[#6B7A94]">Settled</p>
          </div>
          <div className="p-3 bg-[#0D1520] rounded-lg text-center">
            <p className="text-lg font-bold text-[#F59E0B]">{fmt(totalProjected)}</p>
            <p className="text-xs text-[#6B7A94]">Projected</p>
          </div>
        </div>
        {earningsRecords.slice(0, 3).map(r => {
          const collab = collabs.find(c => c.id === r.collaboration_id);
          const cfg = STATUS_CONFIG[r.settlement_status] || STATUS_CONFIG.projected;
          return (
            <div key={r.id} className="flex items-center justify-between p-2 bg-[#0D1520] rounded-lg">
              <span className="text-xs text-[#9AA6BC] truncate flex-1">{collab?.collaboration_name || 'Collaboration'}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-bold text-[#E8EEF9]">{fmt(r.net_amount)}</span>
                <CCBadge variant={cfg.variant} size="sm">{cfg.label}</CCBadge>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <CCCard padding="md">
          <div className="text-center">
            <p className="text-xl font-bold text-[#22C55E]">{fmt(totalSettled)}</p>
            <p className="text-xs text-[#6B7A94] mt-1">Settled</p>
          </div>
        </CCCard>
        <CCCard padding="md">
          <div className="text-center">
            <p className="text-xl font-bold text-[#F59E0B]">{fmt(totalProjected)}</p>
            <p className="text-xs text-[#6B7A94] mt-1">Projected</p>
          </div>
        </CCCard>
        <CCCard padding="md">
          <div className="text-center">
            <p className="text-xl font-bold text-[disputed.length > 0 ? '#EF4444' : '#4F8CFF']">
              {earningsRecords.length}
            </p>
            <p className="text-xs text-[#6B7A94] mt-1">Records</p>
          </div>
        </CCCard>
      </div>

      {/* Privacy + auto note */}
      <div className="flex items-center gap-2 p-2 bg-[#151D2B] rounded-lg">
        <Lock className="w-3.5 h-3.5 text-[#6B7A94] flex-shrink-0" />
        <p className="text-xs text-[#6B7A94]">
          Earnings data is private. Records marked <strong className="text-[#4F8CFF]">Auto</strong> are system-generated on collaboration completion.
        </p>
      </div>

      {/* Backfill prompt */}
      {completedWithoutRecords.length > 0 && (
        <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg flex items-center justify-between gap-3">
          <p className="text-xs text-[#F59E0B]">
            {completedWithoutRecords.length} completed collaboration(s) have no earnings records yet.
          </p>
          <CCButton size="sm" variant="warning" icon={RefreshCw}
            loading={backfillMutation.isPending}
            onClick={() => completedWithoutRecords.forEach(c => backfillMutation.mutate(c.id))}>
            Generate
          </CCButton>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {['all', 'projected', 'pending_settlement', 'settled', 'disputed'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterStatus === s
                  ? 'bg-[#4F8CFF] text-white'
                  : 'bg-[#151D2B] text-[#6B7A94] hover:text-[#9AA6BC]'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
              {s !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({earningsRecords.filter(r => r.settlement_status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <CCButton variant="outline" size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Manual
        </CCButton>
      </div>

      {/* Records List */}
      {isLoading ? (
        <p className="text-center text-[#6B7A94] text-sm py-4">Loading…</p>
      ) : filtered.length === 0 ? (
        <CCCard padding="lg">
          <div className="text-center py-6">
            <DollarSign className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">
              {filterStatus === 'all' ? 'No earnings records yet' : `No ${filterStatus.replace('_', ' ')} records`}
            </p>
            <p className="text-xs text-[#6B7A94] mt-1">
              Records are auto-created when collaborations complete
            </p>
          </div>
        </CCCard>
      ) : (
        <div className="space-y-2">
          {filtered.map(record => (
            <RecordRow
              key={record.id}
              record={record}
              collab={collabs.find(c => c.id === record.collaboration_id)}
              onSettle={handleSettle}
              onDispute={handleDispute}
              onAdvance={handleAdvance}
              isUpdating={updatingId === record.id && settleMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Manual Add Modal */}
      <CCModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Earnings Record" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Collaboration</label>
            <select value={selectedCollabId} onChange={e => setSelectedCollabId(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none">
              <option value="">Select collaboration…</option>
              {collabs.map(c => (
                <option key={c.id} value={c.id}>{c.collaboration_name || c.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Gross Amount ($)</label>
              <input type="number" placeholder="1000" value={newRecord.gross_amount}
                onChange={e => setNewRecord(p => ({ ...p, gross_amount: e.target.value }))}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Your Net ($)</label>
              <input type="number" placeholder="700" value={newRecord.net_amount}
                onChange={e => setNewRecord(p => ({ ...p, net_amount: e.target.value }))}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Status</label>
            <select value={newRecord.settlement_status} onChange={e => setNewRecord(p => ({ ...p, settlement_status: e.target.value }))}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none">
              <option value="projected">Projected</option>
              <option value="pending_settlement">Pending Settlement</option>
              <option value="settled">Settled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Notes (optional)</label>
            <input type="text" placeholder="Trade shoot, rev share, etc." value={newRecord.notes}
              onChange={e => setNewRecord(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none" />
          </div>
          <CCButton variant="primary" fullWidth onClick={() => addMutation.mutate()} loading={addMutation.isPending}>
            Add Record
          </CCButton>
        </div>
      </CCModal>
    </div>
  );
}