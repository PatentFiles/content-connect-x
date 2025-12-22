import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, MapPin, Users, DollarSign, Tag, ChevronDown, RotateCcw, Star, Briefcase } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCSelect from '../ui-custom/CCSelect';
import CCInput from '../ui-custom/CCInput';
import CCBadge from '../ui-custom/CCBadge';

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

const skillOptions = [
  { value: 'photo', label: 'Photography' },
  { value: 'video', label: 'Videography' },
  { value: 'editing', label: 'Editing' },
  { value: 'bts', label: 'BTS/Content' },
  { value: 'directing', label: 'Directing' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'wardrobe', label: 'Wardrobe' },
];

const workLocationOptions = [
  { value: 'remote', label: 'Remote Only' },
  { value: 'onsite', label: 'On-Site Only' },
  { value: 'hybrid', label: 'Hybrid' },
];

const sortOptions = [
  { value: 'distance', label: 'Distance' },
  { value: 'recently_active', label: 'Recently Active' },
  { value: 'response_time', label: 'Response Time' },
  { value: 'rating', label: 'Highest Rated' },
];

export default function ProfileFilters({ filters, onChange, onReset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Count only non-default filters
  const activeFilterCount = [
    filters.roleTypes?.length > 0,
    filters.lookingFor?.length > 0,
    filters.compensation?.length > 0,
    filters.skills?.length > 0,
    filters.workLocation?.length > 0,
    filters.travelAvailable,
    filters.minRating > 0,
    filters.city,
    filters.state,
    filters.country,
  ].filter(Boolean).length;

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
    <div className="relative" ref={dropdownRef}>
      {/* Filter Button */}
      <CCButton
        variant="outline"
        size="sm"
        icon={Filter}
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        Filters
        {activeFilterCount > 0 && (
          <CCBadge variant="accent" size="sm" className="ml-2">
            {activeFilterCount}
          </CCBadge>
        )}
      </CCButton>

      {/* Filter Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-[450px] max-w-[90vw] bg-[#151D2B] border border-[#263248] rounded-xl shadow-2xl z-[10000] max-h-[70vh] overflow-y-auto"
          >
            <div className="p-4 border-b border-[#263248] flex items-center justify-between sticky top-0 bg-[#151D2B]">
              <h3 className="text-lg font-semibold text-[#E8EEF9]">Filters</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#9AA6BC] hover:text-[#E8EEF9]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Role Type */}
              <div>
                <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">Role Type</label>
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

              {/* Compensation */}
              <div>
                <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">Compensation</label>
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

              {/* Availability */}
              <div>
                <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">Availability</label>
                <div className="flex flex-wrap gap-2">
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
              <div className="pt-3 border-t border-[#263248] flex gap-2">
                <CCButton
                  variant="outline"
                  size="md"
                  className="flex-1"
                  icon={RotateCcw}
                  onClick={() => {
                    onReset();
                  }}
                >
                  Reset
                </CCButton>
                <CCButton
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={() => setIsOpen(false)}
                >
                  Apply
                </CCButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}