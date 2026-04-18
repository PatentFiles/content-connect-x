/**
 * PropertyEquipmentManager
 * Host-side editor for property equipment inventory.
 * Each item: category, included/rentable toggle, price, deposit, liability text.
 * Used inside PropertyForm.
 * Props: equipment (array), onChange(updatedArray)
 */
import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['lighting','camera','audio','props','rigging','furniture','specialty','other'];
const CATEGORY_ICONS = { lighting:'💡', camera:'📷', audio:'🎙️', props:'🎭', rigging:'🪝', furniture:'🛋️', specialty:'⚙️', other:'📦' };

const INPUT = "bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

function genId() { return Math.random().toString(36).slice(2, 10); }

export default function PropertyEquipmentManager({ equipment = [], onChange }) {
  const [expanded, setExpanded] = useState({});

  const add = () => onChange([...equipment, {
    id: genId(), name: '', category: 'other', quantity: 1,
    included: true, rentable: false, rental_price: undefined,
    deposit_required: false, deposit_amount: undefined,
    requires_liability_ack: false, liability_text: '', notes: '',
  }]);

  const remove = (id) => onChange(equipment.filter(e => e.id !== id));

  const update = (id, key, val) => onChange(equipment.map(e => e.id === id ? { ...e, [key]: val } : e));

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#E8EEF9]">Equipment Inventory</h3>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#263248] hover:bg-[#3A4A6B] rounded-lg text-xs text-[#E8EEF9] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>

      {equipment.length === 0 && (
        <p className="text-xs text-[#6B7A94] text-center py-4 border border-dashed border-[#263248] rounded-lg">
          No equipment added. Click "Add Item" to list included or rentable gear.
        </p>
      )}

      {equipment.map((item) => (
        <div key={item.id} className="bg-[#0B0F14] border border-[#263248] rounded-xl overflow-hidden">
          {/* Row header */}
          <div className="flex items-center gap-2 p-3">
            <span className="text-lg">{CATEGORY_ICONS[item.category] || '📦'}</span>
            <div className="flex-1 min-w-0">
              <input
                value={item.name}
                onChange={e => update(item.id, 'name', e.target.value)}
                placeholder="Item name (e.g. Godox SL-60W)"
                className={INPUT + ' w-full'}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {item.included && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22C55E]/20 text-[#22C55E]">Included</span>}
              {item.rentable && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#4F8CFF]/20 text-[#4F8CFF]">Rentable</span>}
              <button type="button" onClick={() => toggle(item.id)} className="p-1 text-[#6B7A94] hover:text-[#E8EEF9]">
                {expanded[item.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button type="button" onClick={() => remove(item.id)} className="p-1 text-[#6B7A94] hover:text-[#EF4444]">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded detail */}
          {expanded[item.id] && (
            <div className="border-t border-[#263248] p-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#9AA6BC] mb-1">Category</label>
                  <select value={item.category} onChange={e => update(item.id, 'category', e.target.value)} className={INPUT + ' w-full'}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9AA6BC] mb-1">Quantity</label>
                  <input type="number" min={1} value={item.quantity} onChange={e => update(item.id, 'quantity', parseInt(e.target.value) || 1)} className={INPUT + ' w-full'} />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA6BC] mb-1">Notes</label>
                  <input value={item.notes || ''} onChange={e => update(item.id, 'notes', e.target.value)} placeholder="Optional" className={INPUT + ' w-full'} />
                </div>
              </div>

              {/* Included / Rentable toggles */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={item.included} onChange={e => update(item.id, 'included', e.target.checked)} />
                  <span className="text-sm text-[#E8EEF9]">Included with booking</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={item.rentable} onChange={e => update(item.id, 'rentable', e.target.checked)} />
                  <span className="text-sm text-[#E8EEF9]">Available as paid add-on</span>
                </label>
              </div>

              {/* Rental pricing (only when rentable) */}
              {item.rentable && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#9AA6BC] mb-1">Rental Price (USD)</label>
                    <input type="number" value={item.rental_price || ''} onChange={e => update(item.id, 'rental_price', parseFloat(e.target.value) || undefined)} placeholder="e.g. 50" className={INPUT + ' w-full'} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9AA6BC] mb-1">Deposit (optional)</label>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={item.deposit_required} onChange={e => update(item.id, 'deposit_required', e.target.checked)} />
                      <input
                        type="number"
                        disabled={!item.deposit_required}
                        value={item.deposit_amount || ''}
                        onChange={e => update(item.id, 'deposit_amount', parseFloat(e.target.value) || undefined)}
                        placeholder="Amount"
                        className={INPUT + ' flex-1 disabled:opacity-40'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Liability */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={item.requires_liability_ack} onChange={e => update(item.id, 'requires_liability_ack', e.target.checked)} />
                  <span className="text-sm text-[#E8EEF9] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" /> Require liability acknowledgment
                  </span>
                </label>
                {item.requires_liability_ack && (
                  <textarea
                    rows={2}
                    value={item.liability_text || ''}
                    onChange={e => update(item.id, 'liability_text', e.target.value)}
                    placeholder="e.g. Guest is responsible for any damage to this equipment during the rental period..."
                    className={INPUT + ' w-full resize-none'}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}