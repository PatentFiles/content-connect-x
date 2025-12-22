import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, MapPin, Users, DollarSign, Tag, ChevronDown, RotateCcw, Star, Briefcase } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCSelect from '../ui-custom/CCSelect';
import CCInput from '../ui-custom/CCInput';
import CCBadge from '../ui-custom/CCBadge';
import CCModal from '../ui-custom/CCModal';

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

      {/* Filter Modal */}
      <CCModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Filters"
        size="2xl"
      >
        <div className="space-y-6 py-4">
          {/* Role Type */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">Role Type</label>
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
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">Looking For</label>
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
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">
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
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">Compensation</label>
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

          {/* Skills */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">Skills & Specialties</label>
            <div className="flex flex-wrap gap-2">
              {skillOptions.map(opt => (
                <CCButton
                  key={opt.value}
                  variant={filters.skills?.includes(opt.value) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleArrayFilter('skills', opt.value)}
                >
                  {opt.label}
                </CCButton>
              ))}
            </div>
          </div>

          {/* Work Location Type */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">Work Location</label>
            <div className="flex flex-wrap gap-2">
              {workLocationOptions.map(opt => (
                <CCButton
                  key={opt.value}
                  variant={filters.workLocation?.includes(opt.value) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleArrayFilter('workLocation', opt.value)}
                >
                  {opt.label}
                </CCButton>
              ))}
            </div>
          </div>

          {/* Rating Filter */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">
              Minimum Rating: {filters.minRating || 0} <Star className="w-4 h-4 inline text-[#F59E0B]" />
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={filters.minRating || 0}
              onChange={(e) => updateFilter('minRating', parseFloat(e.target.value))}
              className="w-full h-2 bg-[#263248] rounded-lg appearance-none cursor-pointer accent-[#4F8CFF]"
            />
            <div className="flex justify-between text-xs text-[#6B7A94] mt-1">
              <span>Any</span>
              <span>5.0</span>
            </div>
          </div>

          {/* Travel Available */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-3 block text-center">Availability</label>
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

          {/* Advanced Location */}
          <div>
            <button
              onClick={() => setShowAdvancedLocation(!showAdvancedLocation)}
              className="flex items-center justify-center gap-2 text-sm font-medium text-[#E8EEF9] mb-3 w-full"
            >
              <MapPin className="w-4 h-4" />
              Advanced Location Search
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedLocation ? 'rotate-180' : ''}`} />
            </button>
            
            {showAdvancedLocation && (
              <div className="space-y-3 pl-6">
                <CCInput
                  label="City"
                  placeholder="e.g., Los Angeles"
                  value={filters.city || ''}
                  onChange={(e) => updateFilter('city', e.target.value)}
                />
                <CCInput
                  label="State/Region"
                  placeholder="e.g., California"
                  value={filters.state || ''}
                  onChange={(e) => updateFilter('state', e.target.value)}
                />
                <CCInput
                  label="Country"
                  placeholder="e.g., United States"
                  value={filters.country || ''}
                  onChange={(e) => updateFilter('country', e.target.value)}
                />
                <div>
                  <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">
                    Search Radius: {filters.radius || 50} miles
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    value={filters.radius || 50}
                    onChange={(e) => updateFilter('radius', parseInt(e.target.value))}
                    className="w-full h-2 bg-[#263248] rounded-lg appearance-none cursor-pointer accent-[#4F8CFF]"
                  />
                  <div className="flex justify-between text-xs text-[#6B7A94] mt-1">
                    <span>5 mi</span>
                    <span>500 mi</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sort */}
          <CCSelect
            label="Sort By"
            options={sortOptions}
            value={filters.sortBy || 'distance'}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
          />

          {/* Actions */}
          <div className="pt-4 border-t border-[#263248] flex gap-3 mt-6">
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
      </CCModal>
    </>
  );
}