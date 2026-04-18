/**
 * SuspensionManager — Admin component for suspending, unsuspending,
 * and converting suspensions to bans. Extends UserModerationPanel
 * without replacing any existing moderation architecture.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Clock, UserCheck, Ban, AlertTriangle, ShieldOff } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';

const DURATION_OPTIONS = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '6 Months', value: '6mo' },
  { label: '1 Year', value: '1yr' },
  { label: 'Custom Date', value: 'custom' },
];

const CATEGORY_OPTIONS = [
  { label: 'Policy Violation', value: 'policy_violation' },
  { label: 'Safety Review', value: 'safety_review' },
  { label: 'Identity Review', value: 'identity_review' },
  { label: 'Content Violation', value: 'content_violation' },
  { label: 'Solicitation', value: 'solicitation' },
  { label: 'Spam', value: 'spam' },
  { label: 'Other', value: 'other' },
];

async function callModerationAction(payload) {
  const res = await base44.functions.invoke('adminModerationAction', payload);
  if (!res.data || res.data.success === false) {
    throw new Error(res.data?.error || 'Admin action failed');
  }
  return res.data;
}

/**
 * SuspensionStatusBadge — inline badge showing current suspension state.
 * Used inside user rows in UserModerationPanel.
 */
export function SuspensionStatusBadge({ profile }) {
  if (profile.banned) return <CCBadge variant="danger" size="sm" icon={Ban}>Permanently Banned</CCBadge>;
  if (profile.suspended) {
    const endAt = profile.suspension_end_at;
    return (
      <CCBadge variant="warning" size="sm" icon={Clock}>
        Suspended{endAt ? ` until ${format(new Date(endAt), 'MMM d, yyyy')}` : ' (indefinite)'}
      </CCBadge>
    );
  }
  if (profile.on_probation) {
    const endAt = profile.probation_restrictions?.probation_end_at;
    return (
      <CCBadge variant="accent" size="sm" icon={AlertTriangle}>
        Probation{endAt ? ` until ${format(new Date(endAt), 'MMM d, yyyy')}` : ''}
      </CCBadge>
    );
  }
  return null;
}

/**
 * SuspensionActionButtons — button group inserted into admin expanded user row.
 * Replaces the old merged ban/suspend logic with discrete actions.
 */
export function SuspensionActionButtons({ profile, onActionComplete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [action, setAction] = useState(''); // 'suspend' | 'unsuspend' | 'convert_to_ban' | 'set_probation'
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('policy_violation');
  const [duration, setDuration] = useState('30d');
  const [customEndDate, setCustomEndDate] = useState('');
  const [probationRestrictions, setProbationRestrictions] = useState({
    restricted_messaging: false,
    no_hosting: false,
    no_accelerated_payouts: false,
    elevated_moderation: true,
  });
  const [probationEndDate, setProbationEndDate] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload) => callModerationAction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('Action completed successfully');
      setModalOpen(false);
      setReason('');
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message || 'Action failed'),
  });

  const openModal = (act) => {
    setAction(act);
    setModalOpen(true);
  };

  const handleConfirm = () => {
    if (!reason.trim() && action !== 'unsuspend') {
      toast.error('Reason is required');
      return;
    }
    const payload = {
      action,
      targetUserId: profile.user_id,
      reason,
      suspensionCategory: category,
    };
    if (action === 'suspend') {
      if (duration === 'custom' && customEndDate) {
        payload.suspensionEndAt = new Date(customEndDate).toISOString();
      } else {
        payload.suspensionDuration = duration;
      }
    }
    if (action === 'set_probation') {
      payload.probationConfig = {
        ...probationRestrictions,
        probation_end_at: probationEndDate ? new Date(probationEndDate).toISOString() : null,
      };
    }
    mutation.mutate(payload);
  };

  const modalTitles = {
    suspend: `Suspend — ${profile.display_name}`,
    unsuspend: `Reinstate — ${profile.display_name}`,
    convert_to_ban: `Convert to Permanent Ban — ${profile.display_name}`,
    set_probation: `Set Probation — ${profile.display_name}`,
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {!profile.banned && !profile.suspended && (
          <CCButton variant="warning" size="sm" icon={Clock} onClick={() => openModal('suspend')}>
            Suspend
          </CCButton>
        )}
        {profile.suspended && !profile.banned && (
          <>
            <CCButton variant="success" size="sm" icon={UserCheck} onClick={() => openModal('unsuspend')}>
              Reinstate
            </CCButton>
            <CCButton variant="danger" size="sm" icon={Ban} onClick={() => openModal('convert_to_ban')}>
              Convert to Ban
            </CCButton>
          </>
        )}
        {profile.suspended && !profile.banned && (
          <CCButton variant="outline" size="sm" icon={AlertTriangle} onClick={() => openModal('set_probation')}>
            Reinstate w/ Probation
          </CCButton>
        )}
      </div>

      <CCModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitles[action] || 'Admin Action'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Current status summary */}
          {(profile.suspended || profile.banned) && (
            <div className="p-3 bg-[#151D2B] border border-[#263248] rounded-lg text-sm space-y-1">
              <p className="text-[#9AA6BC]">Current status: <span className="text-[#E8EEF9] font-medium">{profile.banned ? 'Permanently Banned' : 'Suspended'}</span></p>
              {profile.suspension_reason && <p className="text-[#9AA6BC]">Reason on file: <span className="text-[#E8EEF9]">{profile.suspension_reason}</span></p>}
              {profile.suspension_end_at && <p className="text-[#9AA6BC]">End date: <span className="text-[#E8EEF9]">{format(new Date(profile.suspension_end_at), 'MMM d, yyyy HH:mm')}</span></p>}
              {profile.suspension_start_at && <p className="text-[#9AA6BC]">Start: <span className="text-[#E8EEF9]">{format(new Date(profile.suspension_start_at), 'MMM d, yyyy')}</span></p>}
            </div>
          )}

          {action === 'convert_to_ban' && (
            <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-sm text-[#EF4444]">
              This will convert the temporary suspension into a <strong>permanent ban</strong>. This cannot be undone without admin reinstatement.
            </div>
          )}

          {action !== 'unsuspend' && (
            <>
              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Reason *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px] text-sm"
                  placeholder="Provide a clear reason visible to the user..."
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 text-sm"
                >
                  {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Duration selector for suspend */}
          {action === 'suspend' && (
            <div>
              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Duration</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      duration === opt.value
                        ? 'bg-[#4F8CFF] border-[#4F8CFF] text-white'
                        : 'border-[#263248] text-[#9AA6BC] hover:text-[#E8EEF9]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {duration === 'custom' && (
                <input
                  type="datetime-local"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 text-sm"
                />
              )}
            </div>
          )}

          {/* Probation config */}
          {action === 'set_probation' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#E8EEF9]">Probation Restrictions</label>
              {[
                { key: 'restricted_messaging', label: 'Restricted Messaging' },
                { key: 'no_hosting', label: 'No Hosting Access' },
                { key: 'no_accelerated_payouts', label: 'No Accelerated Payouts' },
                { key: 'elevated_moderation', label: 'Elevated Moderation Sensitivity' },
              ].map(r => (
                <label key={r.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={probationRestrictions[r.key] || false}
                    onChange={(e) => setProbationRestrictions(prev => ({ ...prev, [r.key]: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[#E8EEF9]">{r.label}</span>
                </label>
              ))}
              <div>
                <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Probation End Date (optional)</label>
                <input
                  type="datetime-local"
                  value={probationEndDate}
                  onChange={(e) => setProbationEndDate(e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-[#E8EEF9] focus:outline-none text-sm"
                />
              </div>
            </div>
          )}

          {action === 'unsuspend' && (
            <p className="text-sm text-[#9AA6BC]">
              This will immediately reinstate <strong className="text-[#E8EEF9]">{profile.display_name}</strong>'s account. The suspension will be cleared and a reinstatement log entry will be created.
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <CCButton variant="outline" onClick={() => setModalOpen(false)}>Cancel</CCButton>
            <CCButton
              variant={action === 'unsuspend' || action === 'set_probation' ? 'success' : 'danger'}
              onClick={handleConfirm}
              loading={mutation.isPending}
            >
              Confirm
            </CCButton>
          </div>
        </div>
      </CCModal>
    </>
  );
}