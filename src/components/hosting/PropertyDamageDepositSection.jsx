/**
 * PropertyDamageDepositSection
 *
 * Host-side damage deposit configuration.
 * Feature-gated by `damage_deposits` flag.
 * Used inside PropertyForm.
 *
 * Props: deposit (object), onChange(updated)
 */
import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

const INPUT = "bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

export default function PropertyDamageDepositSection({ deposit = {}, onChange }) {
  const enabled = useFeatureFlag('damage_deposits');
  if (!enabled) return null;

  const set = (key, val) => onChange({ ...deposit, [key]: val });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4 text-[#F59E0B]" /> Damage Deposit
      </h3>

      <div className="bg-[#0B0F14] border border-[#263248] rounded-xl p-3 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-[#E8EEF9]">Require a damage deposit</p>
            <p className="text-xs text-[#6B7A94]">Guests are informed before booking. Collected at time of payment.</p>
          </div>
          <input
            type="checkbox"
            checked={deposit.enabled || false}
            onChange={e => set('enabled', e.target.checked)}
          />
        </label>

        {deposit.enabled && (
          <div className="space-y-3 pl-1 border-l border-[#263248]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9AA6BC] mb-1">Deposit Amount (USD)</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-[#9AA6BC]">$</span>
                  <input
                    type="number"
                    min={0}
                    value={deposit.amount || ''}
                    onChange={e => set('amount', parseFloat(e.target.value) || undefined)}
                    placeholder="e.g. 500"
                    className={INPUT + ' w-full'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#9AA6BC] mb-1">Refund Window (days)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={deposit.refund_window_days ?? 7}
                  onChange={e => set('refund_window_days', parseInt(e.target.value) || 7)}
                  className={INPUT + ' w-full'}
                />
                <p className="text-[10px] text-[#6B7A94] mt-1">Days after checkout to refund or dispute</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Collection Method</label>
              <select
                value={deposit.collection_method || 'platform'}
                onChange={e => set('collection_method', e.target.value)}
                className={INPUT + ' w-full'}
              >
                <option value="platform">Platform (future payment integration)</option>
                <option value="direct">Direct (host collects separately)</option>
                <option value="credit_card_hold">Credit Card Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Deposit Policy (shown to guests)</label>
              <textarea
                value={deposit.policy_notes || ''}
                onChange={e => set('policy_notes', e.target.value)}
                rows={2}
                placeholder="e.g. Deposit is fully refunded within 7 days of checkout, subject to property condition review."
                className={INPUT + ' w-full resize-none'}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}