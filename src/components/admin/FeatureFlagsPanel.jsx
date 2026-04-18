/**
 * FeatureFlagsPanel — Admin tab for managing platform feature flags.
 * Lives inside AdminDashboard under the "Feature Flags" tab.
 *
 * Behaviour:
 *   - Reads existing PlatformFeatureFlag records from DB.
 *   - Merges with DEFAULT_FLAGS to show every known flag even if not yet
 *     persisted (shows current in-code default, saves on first toggle).
 *   - Supports boolean toggles, number inputs, and text inputs.
 *   - Groups flags by category.
 */

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DEFAULT_FLAGS } from '@/lib/featureFlags';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings2, RefreshCw } from 'lucide-react';

const CATEGORY_ORDER = ['core', 'safety', 'compliance', 'marketplace', 'experimental'];
const CATEGORY_LABELS = {
  core:         'Core Platform',
  safety:       'Safety & Moderation',
  compliance:   'Compliance',
  marketplace:  'Marketplace / Upcoming',
  experimental: 'Experimental',
};
const CATEGORY_COLORS = {
  core:         'primary',
  safety:       'danger',
  compliance:   'warning',
  marketplace:  'success',
  experimental: 'accent',
};

export default function FeatureFlagsPanel() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState({});

  const { data: dbFlags = [], isLoading } = useQuery({
    queryKey: ['platformFeatureFlags'],
    queryFn: () => base44.entities.PlatformFeatureFlag.list(),
  });

  // Merge DEFAULT_FLAGS with DB overrides → unified display list
  const mergedFlags = useMemo(() => {
    const dbMap = {};
    for (const rec of dbFlags) dbMap[rec.flag_key] = rec;

    return Object.entries(DEFAULT_FLAGS).map(([key, def]) => {
      const dbRec = dbMap[key];
      return {
        key,
        label: dbRec?.label || def.label,
        description: dbRec?.description || def.description || '',
        category: dbRec?.category || def.category,
        value_type: def.value_type,
        affects_nav: def.affects_nav,
        nav_pages: def.nav_pages,
        is_system: dbRec?.is_system ?? false,
        // Current effective value
        current: dbRec
          ? (def.value_type === 'number' ? dbRec.number_value ?? def.value
            : def.value_type === 'text'   ? dbRec.text_value ?? def.value
            : dbRec.bool_value ?? def.value)
          : def.value,
        // DB record id (null = not yet persisted)
        dbId: dbRec?.id ?? null,
      };
    });
  }, [dbFlags]);

  const grouped = useMemo(() => {
    const g = {};
    for (const f of mergedFlags) {
      if (!g[f.category]) g[f.category] = [];
      g[f.category].push(f);
    }
    return g;
  }, [mergedFlags]);

  const saveFlagMutation = useMutation({
    mutationFn: async ({ flag, newValue }) => {
      const payload = {
        flag_key: flag.key,
        label: flag.label,
        category: flag.category,
        value_type: flag.value_type,
        affects_nav: !!flag.affects_nav,
        nav_pages: flag.nav_pages || [],
        ...(flag.value_type === 'boolean' ? { bool_value: newValue }
          : flag.value_type === 'number'  ? { number_value: newValue }
          : { text_value: newValue }),
      };
      if (flag.dbId) {
        return base44.entities.PlatformFeatureFlag.update(flag.dbId, payload);
      } else {
        return base44.entities.PlatformFeatureFlag.create(payload);
      }
    },
    onSuccess: (_, { flag, newValue }) => {
      queryClient.invalidateQueries({ queryKey: ['platformFeatureFlags'] });
      setSaving(s => ({ ...s, [flag.key]: false }));
      toast.success(`${flag.label} ${flag.value_type === 'boolean' ? (newValue ? 'enabled' : 'disabled') : 'updated'}`);
    },
    onError: (err, { flag }) => {
      setSaving(s => ({ ...s, [flag.key]: false }));
      toast.error(`Failed to save ${flag.label}: ${err.message}`);
    },
  });

  const handleToggle = (flag, newValue) => {
    setSaving(s => ({ ...s, [flag.key]: true }));
    saveFlagMutation.mutate({ flag, newValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#6B7A94]">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading flags...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="w-5 h-5 text-[#4F8CFF]" />
          <h2 className="text-xl font-bold text-[#E8EEF9]">Feature Flags</h2>
        </div>
        <p className="text-sm text-[#9AA6BC]">
          Enable or disable platform modules. Changes take effect within 2 minutes for all users.
          Disabling a flag hides related nav items, UI components, and pages automatically.
        </p>
      </div>

      {/* Flag groups */}
      {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-3">
            <CCBadge variant={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat]}</CCBadge>
          </div>
          <div className="space-y-2">
            {grouped[cat].map(flag => (
              <CCCard key={flag.key} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#E8EEF9]">{flag.label}</span>
                      {flag.affects_nav && (
                        <CCBadge variant="outline" size="sm">affects nav</CCBadge>
                      )}
                      {flag.is_system && (
                        <CCBadge variant="warning" size="sm">system</CCBadge>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A94] mt-0.5 font-mono">{flag.key}</p>
                    {flag.description && (
                      <p className="text-xs text-[#9AA6BC] mt-1">{flag.description}</p>
                    )}
                    {flag.affects_nav && flag.nav_pages?.length > 0 && (
                      <p className="text-xs text-[#6B7A94] mt-1">
                        Hides: {flag.nav_pages.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-3">
                    {flag.value_type === 'boolean' && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${flag.current ? 'text-[#22C55E]' : 'text-[#6B7A94]'}`}>
                          {flag.current ? 'ON' : 'OFF'}
                        </span>
                        <Switch
                          checked={Boolean(flag.current)}
                          onCheckedChange={(val) => handleToggle(flag, val)}
                          disabled={saving[flag.key]}
                          className="data-[state=checked]:bg-[#22C55E]"
                        />
                      </div>
                    )}

                    {flag.value_type === 'number' && (
                      <input
                        type="number"
                        defaultValue={flag.current}
                        className="w-24 bg-[#121824] border border-[#263248] rounded-lg px-3 py-1.5 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val !== flag.current) {
                            handleToggle(flag, val);
                          }
                        }}
                      />
                    )}

                    {flag.value_type === 'text' && (
                      <input
                        type="text"
                        defaultValue={flag.current}
                        className="w-32 bg-[#121824] border border-[#263248] rounded-lg px-3 py-1.5 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val !== flag.current) handleToggle(flag, val);
                        }}
                      />
                    )}
                  </div>
                </div>
              </CCCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}