/**
 * EarningsTracker
 *
 * Shows projected and confirmed earnings from collaborations.
 * Uses EarningsRecord entity + contract revenue split data.
 * Private by default — never publicly visible.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DollarSign, TrendingUp, Clock, CheckCircle, AlertTriangle, Plus } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  projected: { label: 'Projected', variant: 'outline', icon: Clock },
  pending_settlement: { label: 'Pending Settlement', variant: 'warning', icon: Clock },
  settled: { label: 'Settled', variant: 'success', icon: CheckCircle },
  disputed: { label: 'Disputed', variant: 'danger', icon: AlertTriangle },
};

export default function EarningsTracker({ userId }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecord, setNewRecord] = useState({ gross_amount: '', net_amount: '', split_percentage: '', notes: '', settlement_status: 'projected' });
  const [selectedCollabId, setSelectedCollabId] = useState('');
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

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.EarningsRecord.create({
      user_id: userId,
      collaboration_id: selectedCollabId,
      type: 'confirmed',
      gross_amount: parseFloat(data.gross_amount) || 0,
      net_amount: parseFloat(data.net_amount) || 0,
      split_percentage: parseFloat(data.split_percentage) || 100,
      notes: data.notes,
      settlement_status: data.settlement_status,
      currency: 'USD',
      visibility: 'private',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['earningsRecords'] });
      toast.success('Earnings record added');
      setShowAddModal(false);
      setNewRecord({ gross_amount: '', net_amount: '', split_percentage: '', notes: '', settlement_status: 'projected' });
    },
    onError: (e) => toast.error(e.message || 'Failed to add record'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.EarningsRecord.update(id, { settlement_status: status, settled_at: status === 'settled' ? new Date().toISOString() : undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['earningsRecords'] }),
  });

  // Aggregate stats
  const totalProjected = earningsRecords.filter(r => ['projected', 'pending_settlement'].includes(r.settlement_status)).reduce((sum, r) => sum + (r.net_amount || 0), 0);
  const totalSettled = earningsRecords.filter(r => r.settlement_status === 'settled').reduce((sum, r) => sum + (r.net_amount || 0), 0);
  const totalRecords = earningsRecords.length;

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
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
            <p className="text-xl font-bold text-[#4F8CFF]">{totalRecords}</p>
            <p className="text-xs text-[#6B7A94] mt-1">Records</p>
          </div>
        </CCCard>
      </div>

      {/* Privacy note */}
      <div className="flex items-center gap-2 p-2 bg-[#151D2B] rounded-lg">
        <DollarSign className="w-3.5 h-3.5 text-[#6B7A94] flex-shrink-0" />
        <p className="text-xs text-[#6B7A94]">Earnings data is private — never visible to other users</p>
      </div>

      {/* Add Record */}
      <div className="flex justify-end">
        <CCButton variant="outline" size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Record
        </CCButton>
      </div>

      {/* Records List */}
      {isLoading ? (
        <p className="text-center text-[#6B7A94] text-sm py-4">Loading...</p>
      ) : earningsRecords.length === 0 ? (
        <CCCard padding="lg">
          <div className="text-center py-6">
            <DollarSign className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No earnings records yet</p>
            <p className="text-xs text-[#6B7A94] mt-1">Add a record after completing a collaboration</p>
          </div>
        </CCCard>
      ) : (
        <div className="space-y-2">
          {earningsRecords.map(record => {
            const cfg = STATUS_CONFIG[record.settlement_status] || STATUS_CONFIG.projected;
            const collab = collabs.find(c => c.id === record.collaboration_id);
            return (
              <CCCard key={record.id} padding="md" hover>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E8EEF9] truncate">
                      {collab?.collaboration_name || 'Collaboration'}
                    </p>
                    <p className="text-xs text-[#6B7A94] mt-0.5">{record.notes || record.type}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#E8EEF9]">{fmt(record.net_amount)}</p>
                      {record.gross_amount && record.gross_amount !== record.net_amount && (
                        <p className="text-xs text-[#6B7A94]">of {fmt(record.gross_amount)}</p>
                      )}
                    </div>
                    <CCBadge variant={cfg.variant} icon={cfg.icon} size="sm">{cfg.label}</CCBadge>
                    {record.settlement_status === 'pending_settlement' && (
                      <CCButton variant="success" size="sm" onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'settled' })}>
                        Mark Settled
                      </CCButton>
                    )}
                  </div>
                </div>
              </CCCard>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <CCModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Earnings Record" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Collaboration</label>
            <select
              value={selectedCollabId}
              onChange={e => setSelectedCollabId(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none"
            >
              <option value="">Select collaboration...</option>
              {collabs.map(c => (
                <option key={c.id} value={c.id}>{c.collaboration_name || c.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Gross Amount ($)</label>
              <input type="number" placeholder="1000" value={newRecord.gross_amount} onChange={e => setNewRecord(p => ({...p, gross_amount: e.target.value}))} className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Your Net ($)</label>
              <input type="number" placeholder="700" value={newRecord.net_amount} onChange={e => setNewRecord(p => ({...p, net_amount: e.target.value}))} className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Status</label>
            <select value={newRecord.settlement_status} onChange={e => setNewRecord(p => ({...p, settlement_status: e.target.value}))} className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none">
              <option value="projected">Projected</option>
              <option value="pending_settlement">Pending Settlement</option>
              <option value="settled">Settled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Notes (optional)</label>
            <input type="text" placeholder="Trade shoot, rev share, etc." value={newRecord.notes} onChange={e => setNewRecord(p => ({...p, notes: e.target.value}))} className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none" />
          </div>
          <CCButton variant="primary" fullWidth onClick={() => addMutation.mutate(newRecord)} loading={addMutation.isPending}>
            Add Record
          </CCButton>
        </div>
      </CCModal>
    </div>
  );
}