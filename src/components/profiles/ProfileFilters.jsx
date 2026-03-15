import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, MapPin, Users, DollarSign, Tag, ChevronDown, RotateCcw, Heart, Shield } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
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

const orientationOptions = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bi', label: 'Bisexual' },
  { value: 'trans_woman', label: 'Trans Women' },
  { value: 'trans_man', label: 'Trans Men' },
];

const sceneTypeOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'fetish', label: 'Fetish' },
  { value: 'kink_edge', label: 'Kink / Edge' },
];

const sortOptions = [
  { value: 'distance', label: 'Distance' },
  { value: 'recently_active', label: 'Recently Active' },
  { value: 'response_time', label: 'Response Time' },
  { value: 'rating', label: 'Highest Rated' },
];

// Common countries list
const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Spain',
  'Italy', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland',
  'Austria', 'Portugal', 'Ireland', 'New Zealand', 'Japan', 'South Korea', 'Brazil', 'Mexico',
  'Argentina', 'Colombia', 'Chile', 'Peru', 'South Africa', 'India', 'Thailand', 'Philippines',
  'Indonesia', 'Singapore', 'Malaysia', 'Hong Kong', 'Taiwan', 'Israel', 'Turkey', 'Poland',
  'Czech Republic', 'Hungary', 'Romania', 'Greece', 'Croatia', 'Serbia', 'Ukraine', 'Russia',
].sort();

// US States
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

export default function ProfileFilters({ filters, onChange, onReset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    orientation: true,
    niche: true,
    compensation: true,
    availability: false,
    trust: false,
  });
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeFilterCount = [
    filters.roleTypes?.length > 0,
    filters.orientations?.length > 0,
    filters.sceneTypes?.length > 0,
    filters.compensation?.length > 0,
    filters.nearMe,
    filters.travelAvailable,
    filters.testingRequired,
    filters.recentlyActive,
    filters.country,
    filters.state,
    filters.city,
  ].filter(Boolean).length;

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = (key, value) => onChange({ ...filters, [key]: value });

  const toggleArrayFilter = (key, value) => {
    const current = filters[key] || [];
    const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    updateFilter(key, updated);
  };

  const isUS = filters.country === 'United States' || !filters.country;

  return (
    <div className="relative" ref={dropdownRef}>
      <CCButton
        variant="outline"
        size="sm"
        icon={Filter}
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        Filters
        {activeFilterCount > 0 && (
          <CCBadge variant="accent" size="sm" className="ml-2">{activeFilterCount}</CCBadge>
        )}
      </CCButton>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-[460px] max-w-[95vw] bg-[#151D2B] border border-[#263248] rounded-xl shadow-2xl z-[10000] max-h-[80vh] overflow-y-auto"
          >
            <div className="p-4 border-b border-[#263248] flex items-center justify-between sticky top-0 bg-[#151D2B] z-10">
              <h3 className="text-lg font-semibold text-[#E8EEF9]">Filters</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#9AA6BC] hover:text-[#E8EEF9]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Role Type */}
              <div>
                <label className="text-sm font-medium text-[#E8EEF9] mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Role Type
                </label>
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

              {/* Orientation */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('orientation')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2"><Heart className="w-4 h-4" /> Creator Orientation</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.orientation ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.orientation && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {orientationOptions.map(opt => (
                      <CCButton
                        key={opt.value}
                        variant={filters.orientations?.includes(opt.value) ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => toggleArrayFilter('orientations', opt.value)}
                      >
                        {opt.label}
                      </CCButton>
                    ))}
                  </div>
                )}
              </div>

              {/* Scene Type & Niche */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('niche')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2"><Tag className="w-4 h-4" /> Scene Type & Niche</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.niche ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.niche && (
                  <div className="mt-2">
                    <p className="text-xs text-[#6B7A94] mb-2">Applies to creators — profiles without acts set always show</p>
                    <div className="flex flex-wrap gap-2">
                      {sceneTypeOptions.map(opt => (
                        <CCButton
                          key={opt.value}
                          variant={filters.sceneTypes?.includes(opt.value) ? 'accent' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayFilter('sceneTypes', opt.value)}
                        >
                          {opt.label}
                        </CCButton>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Compensation */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('compensation')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Compensation Type</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.compensation ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.compensation && (
                  <div className="mt-2">
                    <p className="text-xs text-[#6B7A94] mb-2">Applies to creators — profiles without compensation set always show</p>
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
                )}
              </div>

              {/* Availability & Location */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('availability')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Availability & Location</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.availability ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.availability && (
                  <div className="space-y-3 mt-2">
                    <div className="flex flex-wrap gap-2">
                      <CCButton
                        variant={filters.nearMe ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => updateFilter('nearMe', !filters.nearMe)}
                      >
                        Near Me
                      </CCButton>
                      <CCButton
                        variant={filters.travelAvailable ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => updateFilter('travelAvailable', !filters.travelAvailable)}
                      >
                        Willing to Travel
                      </CCButton>
                    </div>

                    {/* Country */}
                    <div>
                      <label className="text-xs text-[#6B7A94] mb-1 block">Country</label>
                      <select
                        value={filters.country || ''}
                        onChange={(e) => {
                          updateFilter('country', e.target.value);
                          updateFilter('state', '');
                          updateFilter('city', '');
                        }}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                      >
                        <option value="">All Countries</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {/* State — only shown for US */}
                    {(isUS || filters.country === 'United States') && (
                      <div>
                        <label className="text-xs text-[#6B7A94] mb-1 block">State (US)</label>
                        <select
                          value={filters.state || ''}
                          onChange={(e) => {
                            updateFilter('state', e.target.value);
                            updateFilter('city', '');
                          }}
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        >
                          <option value="">All States</option>
                          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}

                    {/* City — free text */}
                    <div>
                      <label className="text-xs text-[#6B7A94] mb-1 block">City</label>
                      <input
                        type="text"
                        placeholder="e.g., Los Angeles"
                        value={filters.city || ''}
                        onChange={(e) => updateFilter('city', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Verification & Trust */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('trust')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Verification & Trust</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.trust ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.trust && (
                  <div className="space-y-3 mt-2">
                    <div className="flex flex-wrap gap-2">
                      <CCButton
                        variant={filters.verifiedOnly ? 'success' : 'outline'}
                        size="sm"
                        onClick={() => updateFilter('verifiedOnly', !filters.verifiedOnly)}
                      >
                        Verified Only
                      </CCButton>
                      <CCButton
                        variant={filters.recentlyActive ? 'success' : 'outline'}
                        size="sm"
                        onClick={() => updateFilter('recentlyActive', !filters.recentlyActive)}
                      >
                        Recently Active
                      </CCButton>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.testingRequired || false}
                        onChange={(e) => updateFilter('testingRequired', e.target.checked)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-[#E8EEF9]">Testing Required</span>
                        <p className="text-xs text-[#6B7A94] mt-0.5">Only show creators with verified, non-expired testing</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="border-t border-[#263248] pt-4">
                <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">Sort By</label>
                <select
                  value={filters.sortBy || 'distance'}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                >
                  {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#263248] flex gap-2">
                <CCButton variant="outline" size="md" className="flex-1" icon={RotateCcw} onClick={onReset}>
                  Reset
                </CCButton>
                <CCButton variant="primary" size="md" className="flex-1" onClick={() => setIsOpen(false)}>
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