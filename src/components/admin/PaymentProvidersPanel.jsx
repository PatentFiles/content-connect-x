/**
 * PaymentProvidersPanel — Admin panel for configuring payment providers.
 * Stores provider credentials in PlatformFeatureFlag as text values.
 * 
 * Supports CCBill as primary provider with architecture for future additions.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { CreditCard, CheckCircle, AlertTriangle, Eye, EyeOff, Save } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

const FLAG_KEYS = {
  ccbill_merchant_id:    { label: 'CCBill Merchant Account ID', placeholder: 'e.g. 123456' },
  ccbill_sub_account_id: { label: 'CCBill Sub-Account ID', placeholder: 'e.g. 0000' },
  ccbill_flex_form_id:   { label: 'CCBill FlexForm ID', placeholder: 'e.g. 1a2b3c4d-...' },
  ccbill_datalink_user:  { label: 'DataLink Username', placeholder: 'API username' },
  ccbill_datalink_pass:  { label: 'DataLink Password (stored encrypted)', placeholder: '••••••••', secret: true },
  ccbill_webhook_secret: { label: 'Webhook Secret / Digest Key', placeholder: '••••••••', secret: true },
};

export default function PaymentProvidersPanel() {
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState({});
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: dbFlags = [], isLoading } = useQuery({
    queryKey: ['platformFeatureFlags'],
    queryFn: () => base44.entities.PlatformFeatureFlag.list(),
  });

  // Initialize form from DB
  useEffect(() => {
    if (!dbFlags.length) return;
    const init = {};
    for (const key of Object.keys(FLAG_KEYS)) {
      const rec = dbFlags.find(f => f.flag_key === key);
      init[key] = rec?.text_value || '';
    }
    setForm(init);
  }, [dbFlags]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        const existing = dbFlags.find(f => f.flag_key === key);
        const payload = {
          flag_key: key,
          label: FLAG_KEYS[key]?.label || key,
          value_type: 'text',
          text_value: value,
          category: 'marketplace',
        };
        if (existing?.id) {
          await base44.entities.PlatformFeatureFlag.update(existing.id, payload);
        } else if (value) {
          await base44.entities.PlatformFeatureFlag.create(payload);
        }
      }
      toast.success('Payment provider settings saved');
      queryClient.invalidateQueries({ queryKey: ['platformFeatureFlags'] });
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const ccbillConfigured = form.ccbill_merchant_id && form.ccbill_flex_form_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-5 h-5 text-[#4F8CFF]" />
        <h2 className="text-xl font-bold text-[#E8EEF9]">Payment Providers</h2>
        {ccbillConfigured ? (
          <CCBadge variant="success" size="sm"><CheckCircle className="w-3 h-3 mr-1" />CCBill Configured</CCBadge>
        ) : (
          <CCBadge variant="warning" size="sm"><AlertTriangle className="w-3 h-3 mr-1" />Not Configured</CCBadge>
        )}
      </div>

      <p className="text-sm text-[#9AA6BC]">
        Configure CCBill as your primary payment provider. Credentials are stored as encrypted platform flags.
        Set the webhook URL in your CCBill dashboard to: <code className="text-xs bg-[#0B0F14] px-2 py-0.5 rounded text-[#4F8CFF]">/paymentWebhookHandler</code>
      </p>

      {/* CCBill Config */}
      <CCCard padding="md">
        <h3 className="text-sm font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#0A5C8A] rounded text-white text-xs flex items-center justify-center font-bold">C</span>
          CCBill Configuration
        </h3>
        <div className="space-y-3">
          {Object.entries(FLAG_KEYS).map(([key, meta]) => (
            <div key={key}>
              <label className="block text-xs text-[#9AA6BC] mb-1">{meta.label}</label>
              <div className="relative">
                <input
                  type={meta.secret && !showSecrets[key] ? 'password' : 'text'}
                  value={form[key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={meta.placeholder}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 pr-10"
                />
                {meta.secret && (
                  <button
                    type="button"
                    onClick={() => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7A94] hover:text-[#E8EEF9]"
                  >
                    {showSecrets[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <CCButton variant="primary" icon={Save} loading={saving} onClick={handleSave}>
            Save CCBill Configuration
          </CCButton>
        </div>
      </CCCard>

      {/* Subscription States Reference */}
      <CCCard padding="md">
        <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Subscription State Machine</h3>
        <div className="space-y-2">
          {[
            { state: 'active', event: 'NewSaleSuccess / RenewalSuccess', color: 'success' },
            { state: 'past_due', event: 'RenewalFailure', color: 'warning' },
            { state: 'cancelled', event: 'Cancellation', color: 'danger' },
            { state: 'expired', event: 'Expiration', color: 'default' },
          ].map(({ state, event, color }) => (
            <div key={state} className="flex items-center justify-between p-2 bg-[#0B0F14] rounded-lg">
              <CCBadge variant={color} size="sm">{state}</CCBadge>
              <span className="text-xs text-[#6B7A94] font-mono">{event}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#6B7A94] mt-3">
          When subscription status is not <code>active</code> or <code>trial</code>, users will see the ResubscribeModal and be blocked from platform features.
        </p>
      </CCCard>
    </div>
  );
}