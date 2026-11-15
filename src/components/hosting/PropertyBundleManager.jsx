/**
 * PropertyBundleManager
 * Host-side bundle template editor.
 * Bundles let hosts offer named packages (Space Only, Production-Ready, etc.)
 * each with pre-selected equipment and an optional price modifier.
 * Used inside PropertyForm.
 * Props: bundles (array), equipment (array), onChange(updatedBundles)
 */
import React, { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, Package } from 'lucide-react';

const PRESET_TEMPLATES = [
  { name: 'Space Only', description: 'Bare space rental — no equipment included', included_equipment_ids: [], price_modifier: 0 },
  { name: 'Production-Ready', description: 'Space + lighting + audio included', included_equipment_ids: [], price_modifier: 0 },
  { name: 'Dungeon Package', description: 'Full specialty gear + furniture included', included_equipment_ids: [], price_modifier: 0 },
  { name: 'Custom Package', description: 'Define your own bundle', included_equipment_ids: [], price_modifier: 0 },
];

const INPUT = "bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

function genId() { return Math.random().toString(36).slice(2, 10); }

export default function PropertyBundleManager({ bundles = [], equipment = [], onChange }) {
  const [expanded, setExpanded] = useState({});

  const add = (template = null) => {
    const tpl = template || { name: '', description: '', included_equipment_ids: [], price_modifier: 0 };
    onChange([...bundles, { id: genId(), ...tpl, price_modifier_type: 'flat', is_default: bundles.length === 0, requires_liability_ack: false, liability_text: '' }]);
  };

  const remove = (id) => onChange(bundles.filter(b => b.id !== id));

  const update = (id, key, val) => onChange(bundles.map(b => b.id === id ? { ...b, [key]: val } : b));

  const setDefault = (id) => onChange(bundles.map(b => ({ ...b, is_default: b.id === id })));

  const toggleEquip = (bundleId, equipId) => {
    const bundle = bundles.find(b => b.id === bundleId);
    const ids = bundle.included_equipment_ids || [];
    update(bundleId, 'included_equipment_ids', ids.includes(equipId) ? ids.filter(x => x !== equipId) : [...ids, equipId]);
  };

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-[#E8EEF9] flex items-center gap-1.5">
          <Package className="w-4 h-4 text-[#FF2DAA]" /> Bundle Templates
        </h3>
        <div className="flex gap-2 flex-wrap">
          {PRESET_TEMPLATES.map(tpl => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => add(tpl)}
              className="text-xs px-2 py-1 bg-[#263248] hover:bg-[#3A4A6B] rounded text-[#9AA6BC] transition-colors"
            >
              + {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {bundles.length === 0 && (
        <p className="text-xs text-[#6B7A94] text-center py-4 border border-dashed border-[#263248] rounded-lg">
          No bundles yet. Add templates to let guests choose a package at booking.
        </p>
      )}

      {bundles.map((bundle) => (
        <div key={bundle.id} className="bg-[#0B0F14] border border-[#263248] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-3">
            <div className="flex-1 min-w-0">
              <input
                value={bundle.name}
                onChange={e => update(bundle.id, 'name', e.target.value)}
                placeholder="Bundle name"
                className={INPUT + ' w-full'}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {bundle.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B]">Default</span>}
              <button type="button" onClick={() => toggle(bundle.id)} className="p-1 text-[#6B7A94] hover:text-[#E8EEF9]">
                {expanded[bundle.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button type="button" onClick={() => remove(bundle.id)} className="p-1 text-[#6B7A94] hover:text-[#EF4444]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expanded[bundle.id] && (
            <div className="border-t border-[#263248] p-3 space-y-3">
              <div>
                <label className="block text-xs text-[#9AA6BC] mb-1">Description</label>
                <input value={bundle.description || ''} onChange={e => update(bundle.id, 'description', e.target.value)} placeholder="What's included..." className={INPUT + ' w-full'} />
              </div>

              {/* Price modifier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#9AA6BC] mb-1">Price Modifier</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={bundle.price_modifier ?? 0}
                      onChange={e => update(bundle.id, 'price_modifier', parseFloat(e.target.value) || 0)}
                      className={INPUT + ' flex-1'}
                    />
                    <select value={bundle.price_modifier_type || 'flat'} onChange={e => update(bundle.id, 'price_modifier_type', e.target.value)} className={INPUT}>
                      <option value="flat">$ flat</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-[#6B7A94] mt-1">Added to base rate. Negative = discount.</p>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={bundle.is_default} onChange={() => setDefault(bundle.id)} />
                    <span className="text-sm text-[#E8EEF9]">Set as default</span>
                  </label>
                </div>
              </div>

              {/* Equipment included in bundle */}
              {equipment.length > 0 && (
                <div>
                  <label className="block text-xs text-[#9AA6BC] mb-2">Included Equipment</label>
                  <div className="flex flex-wrap gap-2">
                    {equipment.map(eq => (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => toggleEquip(bundle.id, eq.id)}
                        className={`text-xs px-2 py-1 rounded transition-all ${
                          (bundle.included_equipment_ids || []).includes(eq.id)
                            ? 'bg-[#4F8CFF] text-white'
                            : 'bg-[#263248] text-[#9AA6BC] hover:bg-[#3A4A6B]'
                        }`}
                      >
                        {eq.name || eq.category}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Liability */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={bundle.requires_liability_ack} onChange={e => update(bundle.id, 'requires_liability_ack', e.target.checked)} />
                <span className="text-sm text-[#E8EEF9]">Require bundle-level liability acknowledgment</span>
              </label>
              {bundle.requires_liability_ack && (
                <textarea
                  rows={2}
                  value={bundle.liability_text || ''}
                  onChange={e => update(bundle.id, 'liability_text', e.target.value)}
                  placeholder="Bundle liability disclosure shown to guest..."
                  className={INPUT + ' w-full resize-none'}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}