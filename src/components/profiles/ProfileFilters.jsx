import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, MapPin, Users, DollarSign, Tag, ChevronDown, RotateCcw, Star, Briefcase, Heart, Shield } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCSelect from '../ui-custom/CCSelect';
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

const availabilityOptions = [
  { value: 'onsite', label: 'On-site Only' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
];

const creatorSkillOptions = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'switch', label: 'Switch' },
  { value: 'dom', label: 'Dom' },
  { value: 'sub', label: 'Sub' },
  { value: 'group_experience', label: 'Group Experience' },
  { value: 'studio_experience', label: 'Studio Experience' },
];

const photographerSkillOptions = [
  { value: 'studio_shoots', label: 'Studio Shoots' },
  { value: 'outdoor_shoots', label: 'Outdoor Shoots' },
  { value: 'bts_footage', label: 'BTS Footage' },
  { value: 'editing_included', label: 'Editing Included' },
  { value: 'lighting_expertise', label: 'Lighting Expertise' },
  { value: 'fetish_friendly', label: 'Fetish Friendly' },
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
  const [expandedSections, setExpandedSections] = useState({
    orientation: true,
    niche: false,
    compensation: true,
    availability: false,
    skills: false,
    trust: false,
  });
  const dropdownRef = useRef(null);

  // Fetch approved tags for niche filtering
  const { data: tags = [] } = useQuery({
    queryKey: ['approvedTags'],
    queryFn: () => base44.entities.Tag.filter({ status: 'approved' }),
  });

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
    filters.orientations?.length > 0,
    filters.sceneTypes?.length > 0,
    filters.tags?.length > 0,
    filters.compensation?.length > 0,
    filters.availabilityMode?.length > 0,
    filters.skills?.length > 0,
    filters.travelAvailable,
    filters.recentlyActive,
    filters.city,
    filters.state,
    filters.country,
  ].filter(Boolean).length;

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Filter tags by selected scene types
  const filteredTags = React.useMemo(() => {
    if (!filters.sceneTypes || filters.sceneTypes.length === 0) return [];
    return tags.filter(tag => filters.sceneTypes.includes(tag.category));
  }, [tags, filters.sceneTypes]);

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

              {/* Orientation (Creators Only) */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('orientation')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2">
                    <Heart className="w-4 h-4" /> Creator Orientation
                  </span>
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
                  <span className="flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Scene Type & Niche
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.niche ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.niche && (
                  <div className="space-y-3 mt-2">
                    <div>
                      <p className="text-xs text-[#6B7A94] mb-2">High-level categories</p>
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
                    {filteredTags.length > 0 && (
                      <div>
                        <p className="text-xs text-[#6B7A94] mb-2">Specific niches</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {filteredTags.map(tag => (
                            <CCButton
                              key={tag.id}
                              variant={filters.tags?.includes(tag.id) ? 'accent' : 'outline'}
                              size="sm"
                              onClick={() => toggleArrayFilter('tags', tag.id)}
                            >
                              {tag.tag_text}
                            </CCButton>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Compensation */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('compensation')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Compensation Type
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.compensation ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.compensation && (
                  <div className="flex flex-wrap gap-2 mt-2">
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
                )}
              </div>

              {/* Availability & Location */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('availability')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Availability & Location
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.availability ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.availability && (
                  <div className="space-y-3 mt-2">
                    <div className="flex flex-wrap gap-2">
                      {availabilityOptions.map(opt => (
                        <CCButton
                          key={opt.value}
                          variant={filters.availabilityMode?.includes(opt.value) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayFilter('availabilityMode', opt.value)}
                        >
                          {opt.label}
                        </CCButton>
                      ))}
                      <CCButton
                        variant={filters.travelAvailable ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => updateFilter('travelAvailable', !filters.travelAvailable)}
                      >
                        Willing to Travel
                      </CCButton>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-[#6B7A94] mb-1 block">City</label>
                        <input
                          type="text"
                          placeholder="e.g., Los Angeles"
                          value={filters.city || ''}
                          onChange={(e) => updateFilter('city', e.target.value)}
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-1.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#6B7A94] mb-1 block">State</label>
                        <input
                          type="text"
                          placeholder="e.g., CA"
                          value={filters.state || ''}
                          onChange={(e) => updateFilter('state', e.target.value)}
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-1.5 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Skills (Role-Specific) */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('skills')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" /> Skills & Services
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.skills ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.skills && (
                  <div className="space-y-3 mt-2">
                    {filters.roleTypes?.includes('creator') && (
                      <div>
                        <p className="text-xs text-[#6B7A94] mb-2">Creator Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {creatorSkillOptions.map(opt => (
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
                    )}
                    {(filters.roleTypes?.includes('photographer') || filters.roleTypes?.includes('videographer')) && (
                      <div>
                        <p className="text-xs text-[#6B7A94] mb-2">Photographer/Videographer Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {photographerSkillOptions.map(opt => (
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
                    )}
                  </div>
                )}
              </div>

              {/* Verification & Trust */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('trust')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Verification & Trust
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.trust ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.trust && (
                  <div className="flex flex-wrap gap-2 mt-2">
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
                )}
              </div>

              {/* Sort */}
              <div className="border-t border-[#263248] pt-4">
                <CCSelect
                  label="Sort By"
                  options={sortOptions}
                  value={filters.sortBy || 'distance'}
                  onChange={(e) => updateFilter('sortBy', e.target.value)}
                />
              </div>

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