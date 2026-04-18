import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Save, RotateCcw } from 'lucide-react';
import CCCard, { CCCardTitle } from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';

const configFields = [
  { key: 'title_weight', label: 'Title Match Weight' },
  { key: 'city_weight', label: 'City Match Weight' },
  { key: 'description_weight', label: 'Description Match Weight' },
  { key: 'role_weight', label: 'Role Weight' },
  { key: 'exact_match_boost', label: 'Exact Match Boost' },
  { key: 'property_boost', label: 'Property Type Boost' },
  { key: 'profile_boost', label: 'Profile Type Boost' },
  { key: 'pro_host_boost', label: 'Pro Host Boost' },
  { key: 'high_reputation_boost', label: 'High Reputation Boost (4.5+)' },
  { key: 'rating_weight', label: 'Average Rating Weight' },
  { key: 'review_volume_weight', label: 'Review Volume Weight' },
];

export default function SearchRankingConfigPanel() {
  const [config, setConfig] = useState({});
  const queryClient = useQueryClient();

  // Load current config
  const { data: flags = [] } = useQuery({
    queryKey: ['rankingFlags'],
    queryFn: () => base44.asServiceRole.entities.PlatformFeatureFlag.list(),
  });

  useEffect(() => {
    const newConfig = {};
    configFields.forEach(({ key }) => {
      const flag = flags.find(f => f.flag_key === `search_ranking_${key}`);
      newConfig[key] = flag?.number_value ?? 0;
    });
    setConfig(newConfig);
  }, [flags]);

  const updateConfigMutation = useMutation({
    mutationFn: async (updates) => {
      const promises = Object.entries(updates).map(([key, value]) => {
        const flagKey = `search_ranking_${key}`;
        const existingFlag = flags.find(f => f.flag_key === flagKey);

        if (existingFlag) {
          return base44.asServiceRole.entities.PlatformFeatureFlag.update(
            existingFlag.id,
            { number_value: parseFloat(value) }
          );
        } else {
          return base44.asServiceRole.entities.PlatformFeatureFlag.create({
            flag_key: flagKey,
            label: configFields.find(f => f.key === key)?.label || key,
            value_type: 'number',
            number_value: parseFloat(value),
            category: 'marketplace',
          });
        }
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Ranking config updated');
      queryClient.invalidateQueries({ queryKey: ['rankingFlags'] });
    },
    onError: () => {
      toast.error('Failed to update config');
    },
  });

  const handleChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = () => {
    const defaults = {
      title_weight: 5,
      city_weight: 2,
      description_weight: 1,
      role_weight: 2,
      exact_match_boost: 5,
      property_boost: 0,
      profile_boost: 0,
      pro_host_boost: 2,
      high_reputation_boost: 2,
      rating_weight: 1,
      review_volume_weight: 0.5,
    };
    setConfig(defaults);
  };

  const handleSave = () => {
    updateConfigMutation.mutate(config);
  };

  return (
    <CCCard padding="lg">
      <CCCardTitle>Search Ranking Configuration</CCCardTitle>
      <p className="text-sm text-[#9AA6BC] mb-6">
        Configure weights for search result ranking. Changes apply immediately to all search queries.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {configFields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-[#E8EEF9] mb-1">
              {label}
            </label>
            <input
              type="number"
              step="0.1"
              value={config[key] ?? 0}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <CCButton
          variant="primary"
          onClick={handleSave}
          loading={updateConfigMutation.isPending}
          icon={Save}
        >
          Save Configuration
        </CCButton>
        <CCButton
          variant="outline"
          onClick={handleReset}
          icon={RotateCcw}
        >
          Reset to Defaults
        </CCButton>
      </div>
    </CCCard>
  );
}