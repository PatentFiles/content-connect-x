/**
 * CancellationPolicySelector
 * Host-side component for creating/editing a cancellation policy on a property.
 * Writes to the CancellationPolicy entity. Used in PropertyForm (feature-gated).
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';

const PRESETS = {
  flexible: {
    label: 'Flexible',
    description: 'Full refund up to 24 hours before. No refund within 24 hours.',
    guest_cancellation: {
      full_refund_hours_before: 24,
      partial_refund_hours_before: 0,
      partial_refund_pct: 0,
      no_refund_hours_before: 24,
      credit_instead_of_refund: false,
      cleaning_fee_refundable: true,
    },
    host_cancellation: { guest_full_refund: true, host_penalty_applies: true, penalty_description: 'Warning issued on first occurrence.' },
    no_show_policy: { guest_no_show_refund_pct: 0, host_no_show_guest_refund_pct: 100, host_no_show_creates_incident: true },
    damage_deposit_linkage: { deposit_refundable_on_guest_cancel: true, deposit_withheld_on_no_show: false },
  },
  moderate: {
    label: 'Moderate',
    description: 'Full refund up to 5 days before. 50% refund 1–5 days before. No refund within 24 hours.',
    guest_cancellation: {
      full_refund_hours_before: 120,
      partial_refund_hours_before: 24,
      partial_refund_pct: 50,
      no_refund_hours_before: 24,
      credit_instead_of_refund: false,
      cleaning_fee_refundable: false,
    },
    host_cancellation: { guest_full_refund: true, host_penalty_applies: true, penalty_description: 'Warning on 1st, suspension risk on 3rd occurrence.' },
    no_show_policy: { guest_no_show_refund_pct: 0, host_no_show_guest_refund_pct: 100, host_no_show_creates_incident: true },
    damage_deposit_linkage: { deposit_refundable_on_guest_cancel: true, deposit_withheld_on_no_show: false },
  },
  strict: {
    label: 'Strict',
    description: 'Full refund up to 7 days before. 50% refund 2–7 days before. No refund within 48 hours.',
    guest_cancellation: {
      full_refund_hours_before: 168,
      partial_refund_hours_before: 48,
      partial_refund_pct: 50,
      no_refund_hours_before: 48,
      credit_instead_of_refund: false,
      cleaning_fee_refundable: false,
    },
    host_cancellation: { guest_full_refund: true, host_penalty_applies: true, penalty_description: 'Immediate strike; 3 strikes = suspension.' },
    no_show_policy: { guest_no_show_refund_pct: 0, host_no_show_guest_refund_pct: 100, host_no_show_creates_incident: true },
    damage_deposit_linkage: { deposit_refundable_on_guest_cancel: false, deposit_withheld_on_no_show: true },
  },
};

const INPUT = "w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50";

export default function CancellationPolicySelector({ policy, ownerUserId, propertyId, onChange }) {
  const [preset, setPreset] = useState(policy?.preset || 'moderate');
  const [form, setForm] = useState(policy || PRESETS.moderate);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preset !== 'custom') {
      const p = PRESETS[preset];
      setForm(prev => ({ ...prev, ...p, preset }));
    }
  }, [preset]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        preset,
        owner_user_id: ownerUserId,
        property_id: propertyId || null,
        version: (policy?.version || 0) + 1,
      };
      let saved;
      if (policy?.id) {
        saved = await base44.entities.CancellationPolicy.update(policy.id, payload);
      } else {
        saved = await base44.entities.CancellationPolicy.create(payload);
      }
      toast.success('Cancellation policy saved');
      onChange?.(saved);
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Cancellation Policy</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`p-2 rounded-lg border text-xs text-left transition-all ${
                preset === key ? 'border-[#4F8CFF] bg-[#4F8CFF]/10 text-[#4F8CFF]' : 'border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
              }`}
            >
              <p className="font-semibold capitalize">{p.label}</p>
              <p className="mt-0.5 text-[#6B7A94] text-[10px] leading-tight">{p.description.slice(0, 60)}…</p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset('custom')}
            className={`p-2 rounded-lg border text-xs text-left transition-all ${
              preset === 'custom' ? 'border-[#4F8CFF] bg-[#4F8CFF]/10 text-[#4F8CFF]' : 'border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
            }`}
          >
            <p className="font-semibold">Custom</p>
            <p className="mt-0.5 text-[#6B7A94] text-[10px] leading-tight">Define your own terms</p>
          </button>
        </div>
      </div>

      {/* Summary of selected preset */}
      {preset !== 'custom' && (
        <div className="bg-[#0B0F14] rounded-lg p-3 text-xs text-[#9AA6BC] space-y-1">
          <p>✅ Full refund: cancel {PRESETS[preset]?.guest_cancellation?.full_refund_hours_before}h+ before</p>
          {PRESETS[preset]?.guest_cancellation?.partial_refund_pct > 0 && (
            <p>⚠️ {PRESETS[preset]?.guest_cancellation?.partial_refund_pct}% refund: {PRESETS[preset]?.guest_cancellation?.partial_refund_hours_before}–{PRESETS[preset]?.guest_cancellation?.full_refund_hours_before}h before</p>
          )}
          <p>❌ No refund within {PRESETS[preset]?.guest_cancellation?.no_refund_hours_before}h of start</p>
          <p>🏠 Host cancel: full guest refund + penalty applies</p>
          <p>🚫 Guest no-show: no refund</p>
        </div>
      )}

      {/* Advanced / custom override */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="flex items-center gap-1 text-xs text-[#4F8CFF] hover:text-[#6BA8FF]"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showAdvanced ? 'Hide advanced' : 'Advanced / custom overrides'}
      </button>

      {showAdvanced && (
        <div className="space-y-3 border-t border-[#263248] pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#9AA6BC] block mb-1">Full refund window (hrs before)</label>
              <input type="number" value={form.guest_cancellation?.full_refund_hours_before ?? ''} onChange={e => setForm(p => ({ ...p, preset: 'custom', guest_cancellation: { ...p.guest_cancellation, full_refund_hours_before: Number(e.target.value) } }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-[#9AA6BC] block mb-1">Partial refund % </label>
              <input type="number" min={0} max={100} value={form.guest_cancellation?.partial_refund_pct ?? ''} onChange={e => setForm(p => ({ ...p, preset: 'custom', guest_cancellation: { ...p.guest_cancellation, partial_refund_pct: Number(e.target.value) } }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-[#9AA6BC] block mb-1">Partial refund window (hrs before)</label>
              <input type="number" value={form.guest_cancellation?.partial_refund_hours_before ?? ''} onChange={e => setForm(p => ({ ...p, preset: 'custom', guest_cancellation: { ...p.guest_cancellation, partial_refund_hours_before: Number(e.target.value) } }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-[#9AA6BC] block mb-1">No-refund within (hrs before)</label>
              <input type="number" value={form.guest_cancellation?.no_refund_hours_before ?? ''} onChange={e => setForm(p => ({ ...p, preset: 'custom', guest_cancellation: { ...p.guest_cancellation, no_refund_hours_before: Number(e.target.value) } }))} className={INPUT} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#E8EEF9] cursor-pointer">
            <input type="checkbox" checked={form.guest_cancellation?.cleaning_fee_refundable || false} onChange={e => setForm(p => ({ ...p, guest_cancellation: { ...p.guest_cancellation, cleaning_fee_refundable: e.target.checked } }))} />
            Cleaning fee refundable on cancellation
          </label>

          <label className="flex items-center gap-2 text-sm text-[#E8EEF9] cursor-pointer">
            <input type="checkbox" checked={form.guest_cancellation?.credit_instead_of_refund || false} onChange={e => setForm(p => ({ ...p, guest_cancellation: { ...p.guest_cancellation, credit_instead_of_refund: e.target.checked } }))} />
            Issue platform credit instead of cash refund
          </label>

          <label className="flex items-center gap-2 text-sm text-[#E8EEF9] cursor-pointer">
            <input type="checkbox" checked={form.damage_deposit_linkage?.deposit_withheld_on_no_show || false} onChange={e => setForm(p => ({ ...p, damage_deposit_linkage: { ...p.damage_deposit_linkage, deposit_withheld_on_no_show: e.target.checked } }))} />
            Damage deposit withheld on guest no-show
          </label>

          <div>
            <label className="text-xs text-[#9AA6BC] block mb-1">Policy display text (shown to guests)</label>
            <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className={INPUT + ' resize-none'} placeholder="Describe your policy in plain language..." />
          </div>
        </div>
      )}

      <CCButton variant="outline" size="sm" onClick={handleSave} loading={saving}>
        Save Policy
      </CCButton>
    </div>
  );
}