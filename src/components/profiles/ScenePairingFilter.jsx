import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import CCButton from '@/components/ui-custom/CCButton';

// Filter scene pairings based on user's gender identity
export function filterScenePairings(genderIdentity, allPairings) {
  if (!genderIdentity) return allPairings;

  const relevantPairings = [];

  allPairings.forEach(pairing => {
    const value = pairing.value || pairing;
    
    // Always show these to everyone
    if (['Group', 'Orgy', 'Interracial', 'Other'].some(term => value.includes(term))) {
      relevantPairings.push(pairing);
      return;
    }

    // Filter based on gender identity
    if (genderIdentity === 'woman') {
      if (value.includes('Girl') && !value.includes('Trans')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'man') {
      if (value.includes('Boy') && !value.includes('Trans') && !value.includes('Girl / Girl')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'trans_woman') {
      if (value.includes('Trans Female')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'trans_man') {
      if (value.includes('Trans Male')) {
        relevantPairings.push(pairing);
      }
    } else if (genderIdentity === 'non_binary') {
      relevantPairings.push(pairing);
    }
  });

  return relevantPairings;
}

export default function ScenePairingFilter({ selected = [], onChange }) {
  const { data: catalogItems = [] } = useQuery({
    queryKey: ['catalogItems'],
    queryFn: () => base44.entities.ContentCatalogItem.filter({ status: 'active' }),
  });

  const scenePairings = catalogItems
    .filter(item => item.category === 'scene_pairing')
    .map(item => item.value);

  const togglePairing = (pairing) => {
    if (selected.includes(pairing)) {
      onChange(selected.filter(p => p !== pairing));
    } else {
      onChange([...selected, pairing]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#E8EEF9]">Scene Pairings</p>
      <div className="flex flex-wrap gap-2">
        {scenePairings.map(pairing => (
          <CCButton
            key={pairing}
            variant={selected.includes(pairing) ? 'primary' : 'outline'}
            size="sm"
            onClick={() => togglePairing(pairing)}
          >
            {pairing}
          </CCButton>
        ))}
      </div>
    </div>
  );
}