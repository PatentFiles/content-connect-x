import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, MapPin, Users, DollarSign, Tag, ChevronDown, RotateCcw } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCSelect from '../ui-custom/CCSelect';
import CCInput from '../ui-custom/CCInput';
import CCBadge from '../ui-custom/CCBadge';
import { CCDrawer } from '../ui-custom/CCModal';

const roleOptions = [
  { value: 'creator', label: 'Creator' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'videographer', label: 'Videographer' },
  { value: 'agent', label: 'Agent' },
  { value: 'studio', label: 'Studio' },
];

const compensationOptions = [
  { value: 'paid', label: 'Paid' },
  { value: 'trade', label: 'Trade' },
  { value: 'free', label: 'Free' },
];

const genderOptions = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'trans_women', label: 'Trans Women' },
  { value: 'trans_men', label: 'Trans Men' },
];

const sortOptions = [
  { value: 'distance', label: 'Distance' },
  { value: 'recently_active', label: 'Recently Active' },
  { value: 'response_time', label: 'Response Time' },
];

export default function ProfileFilters({ filters, onChange, onReset }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeFilterCount = Object.values(filters).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length;

  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key, value) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateFilter(key, updated);
  };

  return (
    <>
      {/* Filter Button */}
      <CCButton
        variant="outline"
        size="sm"
        icon={Filter}
        onClick={() => setIsOpen(true)}
        className="relative"
      >
        Filters
        {activeFilterCount > 0 && (
          <CCBadge variant="accent" size="sm" className="ml-2">
            {activeFilterCount}
          </CCBadge>
        )}
      </CCButton>

      {/* Filter Drawer */}
      <CCDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Filters"
        side="bottom"
      >
        <div className="space-y-6 pb-20">
          {/* Role Type */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block">Role Type</label>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map(opt => (
                <CCButton
                  key={opt.value}
                  variant={filters.roleTypes?.includes(opt.value) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleArrayFilter('roleTypes', opt.value)}
                >
                  {opt.label}
                </CCButton>
              ))}
            </div>
          </div>

          {/* Looking For */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block">Looking For</label>
            <div className="flex flex-wrap gap-2">
              {genderOptions.map(opt => (
                <CCButton
                  key={opt.value}
                  variant={filters.lookingFor?.includes(opt.value) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleArrayFilter('lookingFor', opt.value)}
                >
                  {opt.label}
                </CCButton>
              ))}
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block">
              Distance: {filters.distance || 50} miles
            </label>
            <input
              type="range"
              min="5"
              max="500"
              value={filters.distance || 50}
              onChange={(e) => updateFilter('distance', parseInt(e.target.value))}
              className="w-full h-2 bg-[#263248] rounded-lg appearance-none cursor-pointer accent-[#4F8CFF]"
            />
            <div className="flex justify-between text-xs text-[#6B7A94] mt-1">
              <span>5 mi</span>
              <span>500 mi</span>
            </div>
          </div>

          {/* Compensation */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block">Compensation</label>
            <div className="flex flex-wrap gap-2">
              {compensationOptions.map(opt => (
                <CCButton
                  key={opt.value}
                  variant={filters.compensation?.includes(opt.value) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleArrayFilter('compensation', opt.value)}
                >
                  {opt.label}
                </CCButton>
              ))}
            </div>
          </div>

          {/* Travel Available */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block">Availability</label>
            <div className="flex gap-2">
              <CCButton
                variant={filters.travelAvailable ? 'primary' : 'outline'}
                size="sm"
                onClick={() => updateFilter('travelAvailable', !filters.travelAvailable)}
              >
                Willing to Travel
              </CCButton>
              <CCButton
                variant={filters.verifiedOnly ? 'primary' : 'outline'}
                size="sm"
                onClick={() => updateFilter('verifiedOnly', !filters.verifiedOnly)}
              >
                Verified Only
              </CCButton>
            </div>
          </div>

          {/* Sort */}
          <CCSelect
            label="Sort By"
            options={sortOptions}
            value={filters.sortBy || 'distance'}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
          />

          {/* Actions */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#151D2B] border-t border-[#263248] flex gap-3">
            <CCButton
              variant="outline"
              size="lg"
              className="flex-1"
              icon={RotateCcw}
              onClick={() => {
                onReset();
                setIsOpen(false);
              }}
            >
              Reset
            </CCButton>
            <CCButton
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              Apply Filters
            </CCButton>
          </div>
        </div>
      </CCDrawer>
    </>
  );
}