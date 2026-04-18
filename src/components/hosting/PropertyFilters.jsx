import React from 'react';

const COMMON_AMENITIES = ['WiFi', 'Parking', 'Lighting Rig', 'Backdrop', 'Green Room', 'Kitchen', 'AC', 'Bathroom', '4K Camera', 'Audio'];

export default function PropertyFilters({ filters, onChange }) {
  const update = (field, val) => onChange(prev => ({ ...prev, [field]: val }));

  const toggleAmenity = (a) => {
    const current = filters.amenities || [];
    onChange(prev => ({
      ...prev,
      amenities: current.includes(a) ? current.filter(x => x !== a) : [...current, a],
    }));
  };

  return (
    <div className="bg-[#121824] border border-[#263248] rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">City</label>
          <input
            value={filters.city}
            onChange={e => update('city', e.target.value)}
            placeholder="e.g. Los Angeles"
            className="w-full bg-[#0B0F14] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Min $/hr</label>
          <input
            type="number"
            value={filters.minPrice}
            onChange={e => update('minPrice', e.target.value)}
            placeholder="0"
            className="w-full bg-[#0B0F14] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Max $/hr</label>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={e => update('maxPrice', e.target.value)}
            placeholder="Any"
            className="w-full bg-[#0B0F14] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#9AA6BC] mb-2">Amenities</label>
        <div className="flex flex-wrap gap-2">
          {COMMON_AMENITIES.map(a => (
            <button
              key={a}
              onClick={() => toggleAmenity(a)}
              className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                filters.amenities?.includes(a)
                  ? 'bg-[#4F8CFF] text-white'
                  : 'bg-[#0B0F14] border border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onChange({ minPrice: '', maxPrice: '', city: '', amenities: [] })}
        className="text-xs text-[#6B7A94] hover:text-[#E8EEF9] transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}