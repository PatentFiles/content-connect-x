/**
 * PropertyRulesManager
 * Structured host rules editor with property-type presets.
 * Drop-in replacement for the basic rules section in PropertyForm.
 * Props: rules (object), onChange(updatedRules), propertyType (string)
 */
import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

// ── Type-based presets ──────────────────────────────────────────────────────
const PRESETS = {
  studio: {
    verified_only: true, no_smoking: true, no_alcohol: false, music_allowed: true,
    no_outside_filming_equipment: false, no_window_visibility: false,
    no_overnight: true, furniture_movement_allowed: false, cleanup_required: true,
    parking_available: false, security_cameras_present: false,
    equipment_use_allowed: true,
  },
  studio_set: {
    verified_only: true, no_smoking: true, no_alcohol: false, music_allowed: true,
    no_outside_filming_equipment: false, no_window_visibility: false,
    no_overnight: true, furniture_movement_allowed: true, cleanup_required: true,
    parking_available: true, security_cameras_present: false,
    equipment_use_allowed: true,
  },
  house: {
    verified_only: true, no_smoking: true, no_alcohol: false, music_allowed: false,
    no_outside_filming_equipment: false, no_window_visibility: true,
    no_overnight: true, furniture_movement_allowed: false, cleanup_required: true,
    parking_available: true, security_cameras_present: true,
    equipment_use_allowed: false,
  },
  apartment: {
    verified_only: true, no_smoking: true, no_alcohol: false, music_allowed: false,
    no_outside_filming_equipment: false, no_window_visibility: true,
    no_overnight: true, furniture_movement_allowed: false, cleanup_required: true,
    parking_available: false, security_cameras_present: false,
    equipment_use_allowed: false,
  },
  dungeon: {
    verified_only: true, no_smoking: false, no_alcohol: false, music_allowed: true,
    no_outside_filming_equipment: false, no_window_visibility: true,
    no_overnight: false, furniture_movement_allowed: false, cleanup_required: true,
    parking_available: false, security_cameras_present: false,
    equipment_use_allowed: true,
  },
  dedicated_content_house: {
    verified_only: true, no_smoking: false, no_alcohol: false, music_allowed: true,
    no_outside_filming_equipment: false, no_window_visibility: false,
    no_overnight: false, furniture_movement_allowed: true, cleanup_required: true,
    parking_available: true, security_cameras_present: false,
    equipment_use_allowed: true,
  },
  warehouse: {
    verified_only: true, no_smoking: true, no_alcohol: false, music_allowed: true,
    no_outside_filming_equipment: false, no_window_visibility: false,
    no_overnight: true, furniture_movement_allowed: true, cleanup_required: true,
    parking_available: true, security_cameras_present: false,
    equipment_use_allowed: true,
  },
  hotel_suite: {
    verified_only: true, no_smoking: true, no_alcohol: false, music_allowed: false,
    no_outside_filming_equipment: false, no_window_visibility: true,
    no_overnight: true, furniture_movement_allowed: false, cleanup_required: false,
    parking_available: true, security_cameras_present: false,
    equipment_use_allowed: false,
  },
  commercial_space: {
    verified_only: true, no_smoking: true, no_alcohol: false, music_allowed: true,
    no_outside_filming_equipment: false, no_window_visibility: false,
    no_overnight: true, furniture_movement_allowed: false, cleanup_required: true,
    parking_available: true, security_cameras_present: false,
    equipment_use_allowed: false,
  },
};

// ── Rule definitions ─────────────────────────────────────────────────────────
const BOOL_RULES = [
  { key: 'verified_only',               label: 'Verified users only',              hint: null },
  { key: 'no_smoking',                  label: 'No smoking',                       hint: null },
  { key: 'no_alcohol',                  label: 'No alcohol',                       hint: null },
  { key: 'music_allowed',               label: 'Music allowed',                    hint: null },
  { key: 'no_outside_vendors',          label: 'No outside vendors',               hint: null },
  { key: 'no_outside_filming_equipment',label: 'No outside filming equipment',     hint: 'Guests must use in-house equipment only' },
  { key: 'no_window_visibility',        label: 'No content near windows',          hint: 'Public visibility prohibited' },
  { key: 'no_overnight',                label: 'No overnight stays',               hint: null },
  { key: 'furniture_movement_allowed',  label: 'Furniture movement allowed',       hint: null },
  { key: 'cleanup_required',            label: 'Cleanup required by guest',        hint: null },
  { key: 'parking_available',           label: 'Parking available',                hint: null },
  { key: 'security_cameras_present',    label: 'Security cameras on premises',     hint: 'Disclosure required' },
  { key: 'equipment_use_allowed',       label: 'In-house equipment use allowed',   hint: null },
];

const INPUT = "w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

export default function PropertyRulesManager({ rules = {}, onChange, propertyType }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [restrictedInput, setRestrictedInput] = useState('');

  const set = (key, val) => onChange({ ...rules, [key]: val });

  const applyPreset = () => {
    const preset = PRESETS[propertyType] || PRESETS.studio;
    onChange({ ...rules, ...preset });
  };

  const addRestricted = () => {
    const val = restrictedInput.trim();
    if (!val) return;
    const existing = rules.restricted_content || [];
    if (!existing.includes(val)) onChange({ ...rules, restricted_content: [...existing, val] });
    setRestrictedInput('');
  };

  const removeRestricted = (item) => {
    onChange({ ...rules, restricted_content: (rules.restricted_content || []).filter(x => x !== item) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#4F8CFF]" /> House Rules
        </h3>
        {propertyType && (PRESETS[propertyType]) && (
          <button
            type="button"
            onClick={applyPreset}
            className="text-xs text-[#4F8CFF] hover:underline"
          >
            Load {propertyType.replace(/_/g, ' ')} preset
          </button>
        )}
      </div>

      {/* Max People */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Max People on Premises</label>
          <input
            type="number"
            value={rules.max_people || ''}
            onChange={e => set('max_people', parseInt(e.target.value) || undefined)}
            placeholder="e.g. 6"
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Quiet Hours Start</label>
          <input type="time" value={rules.quiet_hours_start || ''} onChange={e => set('quiet_hours_start', e.target.value)} className={INPUT} />
        </div>
      </div>

      {/* Bool rules grid */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {BOOL_RULES.map(({ key, label, hint }) => (
          <label key={key} className="flex items-start gap-2.5 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={rules[key] ?? false}
              onChange={e => set(key, e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <span className="text-sm text-[#E8EEF9]">{label}</span>
              {hint && <p className="text-xs text-[#6B7A94]">{hint}</p>}
            </div>
          </label>
        ))}
      </div>

      {/* Security camera notes — shown if cameras present */}
      {rules.security_cameras_present && (
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Camera Location / Scope (disclosed to guests)</label>
          <input
            value={rules.security_camera_notes || ''}
            onChange={e => set('security_camera_notes', e.target.value)}
            placeholder="e.g. Entry hallway only, no cameras in shooting areas"
            className={INPUT}
          />
        </div>
      )}

      {/* Parking notes */}
      {rules.parking_available && (
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Parking Notes</label>
          <input
            value={rules.parking_notes || ''}
            onChange={e => set('parking_notes', e.target.value)}
            placeholder="e.g. 2 spots in driveway, street parking available"
            className={INPUT}
          />
        </div>
      )}

      {/* Equipment notes */}
      {rules.equipment_use_allowed && (
        <div>
          <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Equipment Use Restrictions</label>
          <input
            value={rules.equipment_use_notes || ''}
            onChange={e => set('equipment_use_notes', e.target.value)}
            placeholder="e.g. Lighting rig OK, fog machine prohibited"
            className={INPUT}
          />
        </div>
      )}

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="flex items-center gap-1.5 text-xs text-[#6B7A94] hover:text-[#E8EEF9] transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showAdvanced ? 'Hide advanced rules' : 'Show advanced rules'}
      </button>

      {showAdvanced && (
        <div className="space-y-3 border-t border-[#263248] pt-3">
          {/* Restricted content */}
          <div>
            <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Restricted Content / Acts on Premises</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(rules.restricted_content || []).map(item => (
                <span key={item} className="flex items-center gap-1 px-2 py-0.5 bg-[#EF4444]/20 text-[#EF4444] rounded-full text-xs">
                  {item}
                  <button type="button" onClick={() => removeRestricted(item)} className="hover:opacity-70">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={restrictedInput}
                onChange={e => setRestrictedInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRestricted())}
                placeholder="e.g. no outdoor nudity, no fire play"
                className={INPUT + ' flex-1'}
              />
              <button
                type="button"
                onClick={addRestricted}
                className="px-3 py-2 bg-[#263248] hover:bg-[#3A4A6B] text-[#E8EEF9] rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Special restrictions */}
          <div>
            <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Special Restrictions</label>
            <textarea
              value={rules.special_restrictions || ''}
              onChange={e => set('special_restrictions', e.target.value)}
              rows={2}
              placeholder="Any other specific restrictions..."
              className={INPUT + ' resize-none'}
            />
          </div>

          {/* Custom rules */}
          <div>
            <label className="block text-xs font-medium text-[#9AA6BC] mb-1">Custom Rules (catch-all)</label>
            <textarea
              value={rules.custom_rules || ''}
              onChange={e => set('custom_rules', e.target.value)}
              rows={2}
              placeholder="Anything else guests need to know..."
              className={INPUT + ' resize-none'}
            />
          </div>
        </div>
      )}
    </div>
  );
}