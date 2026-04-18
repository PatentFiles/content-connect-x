/**
 * HostingPricingPanel — Admin tab for configuring all hosting marketplace pricing.
 * Lives in AdminDashboard under the "Hosting Pricing" tab.
 *
 * All values are stored as PlatformFeatureFlag numeric/text records so they
 * take effect globally without a redeploy and are visible in the Feature Flags tab too.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DEFAULT_FLAGS } from '@/lib/featureFlags';
import { HOSTING_PRICING_DEFAULTS } from '@/lib/hostingPricing';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';
import { DollarSign, Star, Shield, Clock, Zap, Save, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const PRICING_FLAGS = [
  {
    key: 'hosting_booking_fee_pct',
    label: 'Standard Booking Fee (%)',
    description: 'Platform take rate from every hosting booking (default hosts)',
    icon: DollarSign,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.hosting_booking_fee_pct,
    suffix: '%',
  },
  {
    key: 'pro_host_booking_fee_pct',
    label: 'Pro Host Booking Fee (%)',
    description: 'Reduced platform take rate for Pro Host subscribers',
    icon: Star,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.pro_host_booking_fee_pct,
    suffix: '%',
  },
  {
    key: 'pro_host_subscription_price',
    label: 'Pro Host Subscription Price ($/mo)',
    description: 'Monthly subscription cost for Pro Host tier',
    icon: DollarSign,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.pro_host_subscription_price,
    suffix: '$/mo',
  },
  {
    key: 'reserve_pct_default',
    label: 'Default Reserve (%)',
    description: 'Percentage of host payout held in reserve for dispute resolution',
    icon: Shield,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.reserve_pct_default,
    suffix: '%',
  },
  {
    key: 'reserve_pct_pro_host',
    label: 'Pro Host Reserve (%)',
    description: 'Reduced reserve % for Pro Host subscribers',
    icon: Shield,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.reserve_pct_pro_host,
    suffix: '%',
  },
  {
    key: 'payout_delay_hours_default',
    label: 'Default Payout Delay (hours)',
    description: 'Hours after session completion before host payout is released',
    icon: Clock,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.payout_delay_hours_default,
    suffix: 'hrs',
  },
  {
    key: 'payout_delay_hours_pro_host',
    label: 'Pro Host Payout Delay (hours)',
    description: 'Faster payout delay for Pro Host subscribers',
    icon: Zap,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.payout_delay_hours_pro_host,
    suffix: 'hrs',
  },
  {
    key: 'access_issue_sla_minutes',
    label: 'Access Issue SLA (minutes)',
    description: 'Maximum resolution time for reported access issues',
    icon: Clock,
    type: 'number',
    default: HOSTING_PRICING_DEFAULTS.access_issue_sla_minutes,
    suffix: 'min',
  },
];

const FEATURE_TOGGLES = [
  { key: 'hosting_pricing_enabled', label: 'Hosting Pricing', description: 'Show pricing breakdowns and fee disclosures to hosts and guests' },
  { key: 'pro_host_enabled',        label: 'Pro Host Tier',   description: 'Allow hosts to subscribe to Pro Host for reduced fees and benefits' },
  { key: 'reserve_system_enabled',  label: 'Reserve System',  description: 'Hold a % of each payout in reserve for dispute/chargeback protection' },
  { key: 'dynamic_payout_enabled',  label: 'Payout Timing',   description: 'Configure and apply payout delay windows per host tier' },
];

export default function HostingPricingPanel() {
  const queryClient = useQueryClient();
  const [localValues, setLocalValues] = useState({});
  const [saving, setSaving] = useState({});

  const { data: dbFlags = [], isLoading } = useQuery({
    queryKey: ['platformFeatureFlags'],
    queryFn: () => base44.entities.PlatformFeatureFlag.list(),
  });

  const dbMap = {};
  for (const r of dbFlags) dbMap[r.flag_key] = r;

  const getEffective = (key, defaultVal) => {
    const db = dbMap[key];
    if (db) return db.value_type === 'number' ? (db.number_value ?? defaultVal) : (db.bool_value ?? defaultVal);
    return localValues[key] ?? defaultVal;
  };

  const saveMutation = useMutation({
    mutationFn: async ({ key, value, type }) => {
      const def = DEFAULT_FLAGS[key] || { label: key, category: 'marketplace', value_type: type };
      const payload = {
        flag_key: key,
        label: def.label || key,
        category: def.category || 'marketplace',
        value_type: type,
        affects_nav: def.affects_nav || false,
        nav_pages: def.nav_pages || [],
        ...(type === 'number'  ? { number_value: value }
          : type === 'boolean' ? { bool_value: value }
          :                      { text_value: value }),
      };
      const existing = dbMap[key];
      return existing
        ? base44.entities.PlatformFeatureFlag.update(existing.id, payload)
        : base44.entities.PlatformFeatureFlag.create(payload);
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries(['platformFeatureFlags']);
      setSaving(s => ({ ...s, [key]: false }));
      toast.success('Saved');
    },
    onError: (err, { key }) => {
      setSaving(s => ({ ...s, [key]: false }));
      toast.error(err.message || 'Save failed');
    },
  });

  const saveValue = (key, value, type) => {
    setSaving(s => ({ ...s, [key]: true }));
    saveMutation.mutate({ key, value, type });
  };

  if (isLoading) return (
    <div className="flex items-center gap-2 text-[#6B7A94] py-8">
      <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-[#E8EEF9] mb-1 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#4F8CFF]" />
          Hosting Marketplace Pricing
        </h2>
        <p className="text-sm text-[#9AA6BC]">
          All values apply globally and take effect immediately. Changes are logged to AdminActionLog.
        </p>
      </div>

      {/* Feature Toggles */}
      <div>
        <CCBadge variant="success" className="mb-3">Module Toggles</CCBadge>
        <div className="space-y-2">
          {FEATURE_TOGGLES.map(ft => {
            const current = getEffective(ft.key, DEFAULT_FLAGS[ft.key]?.value ?? false);
            return (
              <CCCard key={ft.key} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#E8EEF9]">{ft.label}</p>
                    <p className="text-xs text-[#6B7A94] mt-0.5">{ft.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs ${current ? 'text-[#22C55E]' : 'text-[#6B7A94]'}`}>
                      {current ? 'ON' : 'OFF'}
                    </span>
                    <Switch
                      checked={Boolean(current)}
                      onCheckedChange={(v) => saveValue(ft.key, v, 'boolean')}
                      disabled={saving[ft.key]}
                      className="data-[state=checked]:bg-[#22C55E]"
                    />
                  </div>
                </div>
              </CCCard>
            );
          })}
        </div>
      </div>

      {/* Numeric Config */}
      <div>
        <CCBadge variant="primary" className="mb-3">Pricing Variables</CCBadge>
        <div className="grid sm:grid-cols-2 gap-4">
          {PRICING_FLAGS.map(pf => {
            const Icon = pf.icon;
            const current = getEffective(pf.key, pf.default);
            const localVal = localValues[pf.key] ?? current;
            return (
              <CCCard key={pf.key} padding="md">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#263248] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#4F8CFF]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#E8EEF9]">{pf.label}</p>
                    <p className="text-xs text-[#6B7A94]">{pf.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={localVal}
                    onChange={e => setLocalValues(s => ({ ...s, [pf.key]: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 bg-[#0B0F14] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                  />
                  <span className="text-xs text-[#6B7A94] w-8">{pf.suffix}</span>
                  <CCButton
                    variant="primary"
                    size="sm"
                    icon={Save}
                    loading={saving[pf.key]}
                    onClick={() => saveValue(pf.key, parseFloat(localVal), 'number')}
                  >
                    Save
                  </CCButton>
                </div>
                <p className="text-xs text-[#6B7A94] mt-1">
                  Current: <strong className="text-[#9AA6BC]">{current}{pf.suffix}</strong>
                  &nbsp;·&nbsp;Default: {pf.default}{pf.suffix}
                </p>
              </CCCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}