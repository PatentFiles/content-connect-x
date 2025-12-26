import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import CCButton from '@/components/ui-custom/CCButton';

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