import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, ChevronDown, RotateCcw } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import BottomSheetSelect from '../ui-custom/BottomSheetSelect';

const contentTypeOptions = [
  { value: 'gay', label: 'Gay Content' },
  { value: 'straight', label: 'Straight Content' },
  { value: 'trans', label: 'Trans Content' },
];

const commissionRanges = [
  { value: 'under_10', label: 'Under 10%' },
  { value: '10_20', label: '10-20%' },
  { value: '20_30', label: '20-30%' },
  { value: 'over_30', label: '30%+' },
];

const sortOptions = [
  { value: 'reputation', label: 'Highest Rated' },
  { value: 'roster_size', label: 'Largest Roster' },
  { value: 'recently_active', label: 'Recently Active' },
];

export default function AgentMarketplaceFilters({ filters, onChange, onReset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    content: true,
    commission: true,
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
    filters.contentTypes?.length > 0,
    filters.commissionRange?.length > 0,
    filters.minRosterSize,
    filters.verifiedOnly,
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
            className="absolute right-0 top-full mt-2 w-[420px] max-w-[95vw] bg-[#151D2B] border border-[#263248] rounded-xl shadow-2xl z-[10000] max-h-[80vh] overflow-y-auto"
          >
            <div className="p-4 border-b border-[#263248] flex items-center justify-between sticky top-0 bg-[#151D2B] z-10">
              <h3 className="text-lg font-semibold text-[#E8EEF9]">Agent Filters</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#9AA6BC] hover:text-[#E8EEF9]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Content Types */}
              <div>
                <button
                  onClick={() => toggleSection('content')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span>Specialties</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.content ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.content && (
                  <div className="flex flex-wrap gap-2">
                    {contentTypeOptions.map(opt => (
                      <CCButton
                        key={opt.value}
                        variant={filters.contentTypes?.includes(opt.value) ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => toggleArrayFilter('contentTypes', opt.value)}
                      >
                        {opt.label}
                      </CCButton>
                    ))}
                  </div>
                )}
              </div>

              {/* Commission Range */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('commission')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span>Commission Range</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.commission ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.commission && (
                  <div className="flex flex-wrap gap-2">
                    {commissionRanges.map(opt => (
                      <CCButton
                        key={opt.value}
                        variant={filters.commissionRange?.includes(opt.value) ? 'accent' : 'outline'}
                        size="sm"
                        onClick={() => toggleArrayFilter('commissionRange', opt.value)}
                      >
                        {opt.label}
                      </CCButton>
                    ))}
                  </div>
                )}
              </div>

              {/* Trust & Verification */}
              <div className="border-t border-[#263248] pt-4">
                <button
                  onClick={() => toggleSection('trust')}
                  className="w-full flex items-center justify-between text-sm font-medium text-[#E8EEF9] mb-2"
                >
                  <span>Trust & Verification</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.trust ? 'rotate-180' : ''}`} />
                </button>
                {expandedSections.trust && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.verifiedOnly || false}
                        onChange={(e) => updateFilter('verifiedOnly', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#E8EEF9]">Verified Only</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.highReputation || false}
                        onChange={(e) => updateFilter('highReputation', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-[#E8EEF9]">High Reputation (70+)</span>
                    </label>
                    <div>
                      <label className="text-xs text-[#6B7A94] mb-2 block">Min. Roster Size</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Any"
                        value={filters.minRosterSize || ''}
                        onChange={(e) => updateFilter('minRosterSize', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="border-t border-[#263248] pt-4">
                <BottomSheetSelect
                  label="Sort By"
                  value={filters.sortBy || 'reputation'}
                  onChange={(val) => updateFilter('sortBy', val)}
                  options={sortOptions}
                  placeholder="Sort By"
                />
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