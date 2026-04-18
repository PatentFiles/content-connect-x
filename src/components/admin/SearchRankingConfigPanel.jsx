import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Save, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import CCCard, { CCCardTitle } from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';

// Numeric weight fields
const numericFields = [
  { key: 'title_weight', label: 'Title Match Weight', default: 5 },
  { key: 'city_weight', label: 'City Match Weight', default: 2 },
  { key: 'description_weight', label: 'Description Match Weight', default: 1 },
  { key: 'role_weight', label: 'Role Weight', default: 2 },
  { key: 'exact_match_boost', label: 'Exact Match Boost', default: 5 },
  { key: 'property_boost', label: 'Property Type Boost', default: 0 },
  { key: 'profile_boost', label: 'Profile Type Boost', default: 0 },
  { key: 'pro_host_boost', label: 'Pro Host Boost', default: 2 },
  { key: 'high_reputation_boost', label: 'High Reputation Boost (4.5+)', default: 2 },
  { key: 'rating_weight', label: 'Average Rating Weight', default: 1 },
  { key: 'review_volume_weight', label: 'Review Volume Weight', default: 0.5 },
  { key: 'featured_property_boost', label: 'Featured Property Boost', default: 5 },
  { key: 'verified_property_boost', label: 'Verified Property Boost', default: 3 },
  { key: 'freshness_boost', label: 'Freshness Boost (≤30 days)', default: 2 },
  { key: 'max_rating_score', label: 'Max Rating Score (cap)', default: 10 },
  { key: 'max_volume_score', label: 'Max Volume Score (cap)', default: 8 },
  { key: 'recency_weight_7_days', label: 'Recency Multiplier: ≤7 days', default: 1.5 },
  { key: 'recency_weight_30_days', label: 'Recency Multiplier: ≤30 days', default: 1.2 },
  { key: 'recency_weight_90_days', label: 'Recency Multiplier: ≤90 days', default: 1.0 },
  { key: 'recency_weight_default', label: 'Recency Multiplier: default (>90 days)', default: 0.7 },
];

// Boolean toggle fields
const booleanFields = [
  { key: 'review_recency_enabled', label: 'Review Recency Weighting', hint: 'Recent reviews rank higher', default: false },
  { key: 'review_integrity_enabled', label: 'Review Integrity Filtering', hint: 'Filter spam by integrity score', default: false },
  { key: 'ranking_boosts_enabled', label: 'Ranking Monetization Boosts', hint: 'Featured + verified property boosts', default: false },
];

const FLAG_PREFIX = 'search_ranking_';

export default function SearchRankingConfigPanel() {
  const [numericConfig, setNumericConfig] = useState({});
  const [booleanConfig, setBooleanConfig] = useState({});
  const queryClient = useQueryClient();

  const { data: flags = [] } = useQuery({
    queryKey: ['rankingFlags'],
    queryFn: () => base44.entities.PlatformFeatureFlag.list(),
  });

  useEffect(() => {
    const nums = {};
    numericFields.forEach(({ key, default: def }) => {
      const flag = flags.find(f => f.flag_key === `${FLAG_PREFIX}${key}`);
      nums[key] = flag?.number_value ?? def;
    });
    setNumericConfig(nums);

    const bools = {};
    booleanFields.forEach(({ key, default: def }) => {
      const flag = flags.find(f => f.flag_key === `${FLAG_PREFIX}${key}`);
      bools[key] = flag?.bool_value ?? def;
    });
    setBooleanConfig(bools);
  }, [flags]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allUpdates = [];

      // Save numeric fields
      numericFields.forEach(({ key }) => {
        const flagKey = `${FLAG_PREFIX}${key}`;
        const existing = flags.find(f => f.flag_key === flagKey);
        const value = parseFloat(numericConfig[key]);
        if (existing) {
          allUpdates.push(base44.entities.PlatformFeatureFlag.update(existing.id, { number_value: value }));
        } else {
          allUpdates.push(base44.entities.PlatformFeatureFlag.create({
            flag_key: flagKey,
            label: numericFields.find(f => f.key === key)?.label || key,
            value_type: 'number',
            number_value: value,
            category: 'marketplace',
          }));
        }
      });

      // Save boolean fields
      booleanFields.forEach(({ key }) => {
        const flagKey = `${FLAG_PREFIX}${key}`;
        const existing = flags.find(f => f.flag_key === flagKey);
        const value = booleanConfig[key];
        if (existing) {
          allUpdates.push(base44.entities.PlatformFeatureFlag.update(existing.id, { bool_value: value }));
        } else {
          allUpdates.push(base44.entities.PlatformFeatureFlag.create({
            flag_key: flagKey,
            label: booleanFields.find(f => f.key === key)?.label || key,
            value_type: 'boolean',
            bool_value: value,
            category: 'marketplace',
          }));
        }
      });

      await Promise.all(allUpdates);
    },
    onSuccess: () => {
      toast.success('Ranking config saved');
      queryClient.invalidateQueries({ queryKey: ['rankingFlags'] });
      queryClient.invalidateQueries({ queryKey: ['platformFeatureFlags'] });
    },
    onError: () => toast.error('Failed to save config'),
  });

  const handleReset = () => {
    const nums = {};
    numericFields.forEach(({ key, default: def }) => { nums[key] = def; });
    setNumericConfig(nums);
    const bools = {};
    booleanFields.forEach(({ key, default: def }) => { bools[key] = def; });
    setBooleanConfig(bools);
  };

  return (
    <CCCard padding="lg">
      <CCCardTitle>Search Ranking Configuration</CCCardTitle>
      <p className="text-sm text-[#9AA6BC] mb-6">
        Configure weights for search result ranking. Changes apply immediately. All rating data comes from stored Property aggregates (single source of truth).
      </p>

      {/* Boolean toggles */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Feature Toggles</h3>
        <div className="space-y-3">
          {booleanFields.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-[#121824] rounded-lg border border-[#263248]">
              <div>
                <p className="text-sm font-medium text-[#E8EEF9]">{label}</p>
                {hint && <p className="text-xs text-[#6B7A94]">{hint}</p>}
              </div>
              <button
                onClick={() => setBooleanConfig(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`transition-colors ${booleanConfig[key] ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'}`}
              >
                {booleanConfig[key]
                  ? <ToggleRight className="w-8 h-8" />
                  : <ToggleLeft className="w-8 h-8" />
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Numeric weights */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Ranking Weights & Caps</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {numericFields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-[#E8EEF9] mb-1">{label}</label>
              <input
                type="number"
                step="0.1"
                value={numericConfig[key] ?? 0}
                onChange={e => setNumericConfig(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <CCButton variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} icon={Save}>
          Save Configuration
        </CCButton>
        <CCButton variant="outline" onClick={handleReset} icon={RotateCcw}>
          Reset to Defaults
        </CCButton>
      </div>
    </CCCard>
  );
}